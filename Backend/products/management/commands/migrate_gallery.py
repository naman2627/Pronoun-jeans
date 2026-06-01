"""
Management command: migrate_gallery
=====================================
Reads products.csv (WooCommerce export) and imports secondary gallery
images into the ProductImage table.

Usage:
    python manage.py migrate_gallery --csv path/to/products.csv
    python manage.py migrate_gallery --csv path/to/products.csv --dry-run
    python manage.py migrate_gallery --csv path/to/products.csv --skip-existing
"""
import csv
import os
import time
import requests
from io import BytesIO

from django.core.files.base import ContentFile
from django.core.management.base import BaseCommand, CommandError

from products.models import Product, ProductImage

# Seconds to wait between image downloads to be polite to the source server
DOWNLOAD_DELAY = 0.3
REQUEST_TIMEOUT = 15


def download_image(url):
    """Download image bytes from URL. Returns (filename, bytes) or raises."""
    resp = requests.get(url.strip(), timeout=REQUEST_TIMEOUT)
    resp.raise_for_status()
    # Derive filename from URL path
    filename = os.path.basename(url.strip().split('?')[0]) or 'image.jpg'
    return filename, resp.content


class Command(BaseCommand):
    help = 'Import WooCommerce gallery images from products.csv into ProductImage table'

    def add_arguments(self, parser):
        parser.add_argument('--csv',   required=True, help='Path to products.csv')
        parser.add_argument('--dry-run',      action='store_true', help='Preview without saving')
        parser.add_argument('--skip-existing', action='store_true',
                            help='Skip products that already have gallery images')

    def handle(self, *args, **options):
        csv_path      = options['csv']
        dry_run       = options['dry_run']
        skip_existing = options['skip_existing']

        if not os.path.exists(csv_path):
            raise CommandError(f"CSV file not found: {csv_path}")

        if dry_run:
            self.stdout.write(self.style.WARNING('DRY RUN — no images will be saved.\n'))

        total_imported = 0
        total_skipped  = 0
        total_errors   = 0

        with open(csv_path, newline='', encoding='utf-8-sig') as f:
            reader = csv.DictReader(f)

            for row in reader:
                row_type = row.get('Type', '').strip().lower()

                # Only process parent/simple products, not variations
                if row_type not in ('simple', 'variable', 'product', ''):
                    continue

                images_raw = row.get('Images', '').strip()
                if not images_raw:
                    continue

                all_urls = [u.strip() for u in images_raw.split(',') if u.strip()]

                # Index 0 is the main featured image — already on Product.image
                # We only want index 1 onwards
                gallery_urls = all_urls[1:]
                if not gallery_urls:
                    continue

                # Match product by Name or SKU
                name = row.get('Name', '').strip()
                sku  = row.get('SKU',  '').strip()

                product = None
                if sku:
                    product = Product.objects.filter(
                        variations__sku=sku
                    ).first()
                if not product and name:
                    product = Product.objects.filter(name=name).first()

                if not product:
                    self.stdout.write(
                        self.style.WARNING(f'  SKIP (not found): "{name}" / SKU "{sku}"')
                    )
                    total_skipped += 1
                    continue

                if skip_existing and product.gallery_images.exists():
                    self.stdout.write(f'  SKIP (has gallery): "{product.name}"')
                    total_skipped += 1
                    continue

                self.stdout.write(f'  Product: "{product.name}" — {len(gallery_urls)} gallery image(s)')

                for idx, url in enumerate(gallery_urls):
                    if dry_run:
                        self.stdout.write(f'    WOULD import [{idx+1}]: {url}')
                        continue

                    try:
                        filename, image_bytes = download_image(url)
                        gallery_image = ProductImage(
                            product  = product,
                            alt_text = f"{product.name} — view {idx + 1}",
                            order    = idx,
                        )
                        gallery_image.image.save(
                            filename,
                            ContentFile(image_bytes),
                            save=True,
                        )
                        self.stdout.write(
                            self.style.SUCCESS(f'    ✓ [{idx+1}] {filename}')
                        )
                        total_imported += 1
                        time.sleep(DOWNLOAD_DELAY)

                    except requests.exceptions.HTTPError as e:
                        self.stdout.write(
                            self.style.ERROR(f'    ✗ [{idx+1}] HTTP error: {e} — {url}')
                        )
                        total_errors += 1
                    except requests.exceptions.RequestException as e:
                        self.stdout.write(
                            self.style.ERROR(f'    ✗ [{idx+1}] Network error: {e} — {url}')
                        )
                        total_errors += 1
                    except Exception as e:
                        self.stdout.write(
                            self.style.ERROR(f'    ✗ [{idx+1}] Unexpected error: {e} — {url}')
                        )
                        total_errors += 1

        self.stdout.write('')
        if dry_run:
            self.stdout.write(self.style.WARNING('Dry run complete — no changes written.'))
        else:
            self.stdout.write(self.style.SUCCESS(
                f'Done. Imported: {total_imported} | Skipped: {total_skipped} | Errors: {total_errors}'
            ))