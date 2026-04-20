# Backend/products/management/commands/migrate_woo_data.py

import csv
import os
import re
from django.core.management.base import BaseCommand, CommandError
from django.utils.text import slugify
from accounts.models import CustomUser
from products.models import Category, Product, ProductVariation


class Command(BaseCommand):
    help = "Migrate WooCommerce exported CSV data into Django models."

    def add_arguments(self, parser):
        parser.add_argument('--users',    type=str, help='Path to users CSV file')
        parser.add_argument('--products', type=str, help='Path to products CSV file')

    def handle(self, *args, **options):
        if options['users']:
            self.migrate_users(options['users'])
        if options['products']:
            self.migrate_products(options['products'])
        self.stdout.write(self.style.SUCCESS("\nMigration complete."))

    # ------------------------------------------------------------------ #
    # USERS                                                                #
    # ------------------------------------------------------------------ #
    def migrate_users(self, filepath):
        self._check_file(filepath)
        created = skipped = 0

        with open(filepath, newline='', encoding='utf-8') as f:
            reader = csv.DictReader(f)
            for row in reader:
                email = row.get('user_email', '').strip().lower()
                if not email:
                    self.stdout.write(self.style.WARNING("  Skipping row — no email."))
                    continue

                if CustomUser.objects.filter(email=email).exists():
                    skipped += 1
                    continue

                user = CustomUser(
                    email=email,
                    username=email,
                    first_name=row.get('first_name', '').strip(),
                    last_name=row.get('last_name', '').strip(),
                    company_name=row.get('billing_company', '').strip() or None,
                    phone_number=row.get('billing_phone', '').strip() or None,
                    gst_number=None,
                    is_verified_b2b=True,
                )
                user.set_unusable_password()
                user.save()
                created += 1

        self.stdout.write(self.style.SUCCESS(
            f"  Users — created: {created}, skipped (already exist): {skipped}"
        ))
        self.stdout.write(self.style.WARNING(
            "  NOTE: All imported users have unusable passwords. "
            "They must reset via 'Forgot Password' before first login."
        ))

    # ------------------------------------------------------------------ #
    # PRODUCTS, CATEGORIES & VARIATIONS                                   #
    # ------------------------------------------------------------------ #
    def migrate_products(self, filepath):
        self._check_file(filepath)
        prod_created = var_created = var_skipped = 0

        # ---- Pass 1: Build parent lookup map from 'variable' rows ----- #
        # WooCommerce variation rows reference parent via the Parent column,
        # which can contain:
        #   - The numeric WC post ID (e.g. "6114")
        #   - "id:6114" (prefixed)
        #   - A SKU-style string (e.g. "774", "URBANRISE_218", "URBAN RISE 217")
        # We map ALL of: numeric ID, "id:NNN" normalised, and SKU -> Product.
        parent_lookup = {}

        with open(filepath, newline='', encoding='utf-8-sig') as f:
            reader = csv.DictReader(f)
            for row in reader:
                if row.get('Type', '').strip().lower() != 'variable':
                    continue

                name = row.get('Name', '').strip()
                if not name or name.upper() == 'AUTO-DRAFT':
                    continue

                # ---- Category ---------------------------------------- #
                raw_cats = row.get('Categories', '').strip()
                first_cat_entry = raw_cats.split(',')[0].strip()
                category_name = first_cat_entry.split('>')[0].strip() or 'Uncategorised'
                category, _ = Category.objects.get_or_create(
                    slug=slugify(category_name),
                    defaults={'name': category_name}
                )

                # ---- Product ----------------------------------------- #
                slug = self._unique_slug(name)
                product, p_created = Product.objects.get_or_create(
                    slug=slug,
                    defaults={
                        'name': name,
                        'category': category,
                        'description': self._strip_html(row.get('Description', '')),
                        'fabric_details': row.get('Short description', '').strip() or None,
                        'is_active': row.get('Published', '1').strip() == '1',
                    }
                )
                if p_created:
                    prod_created += 1

                # ---- Build lookup keys: numeric ID, id:NNN, and SKU -- #
                wc_id  = row.get('ID', '').strip()
                wc_sku = row.get('SKU', '').strip()

                if wc_id:
                    parent_lookup[wc_id]         = product
                    parent_lookup[f"id:{wc_id}"] = product
                if wc_sku:
                    parent_lookup[wc_sku]         = product

        self.stdout.write(self.style.SUCCESS(
            f"  Products  — created: {prod_created} | "
            f"Parent map built: {len(parent_lookup)} keys"
        ))

        # ---- Pass 2: Process variation rows --------------------------- #
        with open(filepath, newline='', encoding='utf-8-sig') as f:
            reader = csv.DictReader(f)
            for row in reader:
                if row.get('Type', '').strip().lower() != 'variation':
                    continue

                name       = row.get('Name', '').strip()
                sku        = row.get('SKU', '').strip()
                size       = row.get('Attribute 1 value(s)', '').strip() or 'One Size'
                color      = row.get('Attribute 2 value(s)', '').strip() or 'Default'
                price      = row.get('Regular price', '0').strip() or '0'
                parent_ref = row.get('Parent', '').strip()

                if 'AUTO-DRAFT' in name.upper():
                    var_skipped += 1
                    continue

                try:
                    if not sku:
                        raise ValueError(f"Missing SKU for variation '{name}'")

                    product = parent_lookup.get(parent_ref)
                    if not product:
                        raise ValueError(
                            f"No parent product found for Parent='{parent_ref}' (SKU: {sku})"
                        )

                    _, v_created = ProductVariation.objects.get_or_create(
                        sku=sku,
                        defaults={
                            'product':        product,
                            'size':           size,
                            'color':          color,
                            'b2b_price':      float(price),
                            'stock_quantity': 0,
                        }
                    )
                    if v_created:
                        var_created += 1
                    else:
                        var_skipped += 1

                except Exception as e:
                    var_skipped += 1
                    self.stdout.write(self.style.WARNING(f"  Variation skipped — {e}"))

        self.stdout.write(self.style.SUCCESS(
            f"  Variations — created: {var_created}, skipped: {var_skipped}"
        ))

    # ------------------------------------------------------------------ #
    # HELPERS                                                              #
    # ------------------------------------------------------------------ #
    def _check_file(self, filepath):
        if not os.path.exists(filepath):
            raise CommandError(f"File not found: {filepath}")

    def _unique_slug(self, name):
        base_slug = slugify(name)[:200]
        slug, counter = base_slug, 1
        while Product.objects.filter(slug=slug).exists():
            slug = f"{base_slug}-{counter}"
            counter += 1
        return slug

    def _strip_html(self, text):
        return re.sub(r'<[^>]+>', '', text).strip()