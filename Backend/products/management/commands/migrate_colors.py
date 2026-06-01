"""
Management command: migrate_colors
===================================
Run once after applying migrations to populate the new Color master table
and link every existing ProductVariation to its Color record.

Usage:
    python manage.py migrate_colors
    python manage.py migrate_colors --dry-run   # preview without saving
"""
from django.core.management.base import BaseCommand
from products.models import ProductVariation, Color


# Default hex assigned to auto-created colors.
# Admins can update individual hex codes in Django Admin afterward.
DEFAULT_HEX = '#CCCCCC'


class Command(BaseCommand):
    help = 'Migrate ProductVariation.color (CharField) → Color FK (color_palette)'

    def add_arguments(self, parser):
        parser.add_argument(
            '--dry-run',
            action='store_true',
            help='Preview what would be created/linked without writing to the database.',
        )

    def handle(self, *args, **options):
        dry_run    = options['dry_run']
        variations = ProductVariation.objects.select_related('color_palette').all()
        total      = variations.count()

        if dry_run:
            self.stdout.write(self.style.WARNING(f'DRY RUN — {total} variations found, no changes will be saved.\n'))
        else:
            self.stdout.write(f'Processing {total} variations…\n')

        created_colors = 0
        linked         = 0
        skipped        = 0

        for v in variations:
            color_name = (v.color or '').strip()

            if not color_name:
                self.stdout.write(self.style.WARNING(f'  SKIP  #{v.pk} (empty color string)'))
                skipped += 1
                continue

            if not dry_run:
                color_obj, created = Color.objects.get_or_create(
                    name=color_name,
                    defaults={'hex_code': DEFAULT_HEX},
                )
                if created:
                    created_colors += 1
                    self.stdout.write(self.style.SUCCESS(f'  CREATE Color "{color_name}" ({DEFAULT_HEX})'))

                v.color_palette = color_obj
                v.save(update_fields=['color_palette'])
                linked += 1
            else:
                self.stdout.write(f'  WOULD link variation #{v.pk} "{v.sku}" → Color "{color_name}"')

        self.stdout.write('')
        if dry_run:
            self.stdout.write(self.style.WARNING('Dry run complete — no changes written.'))
        else:
            self.stdout.write(self.style.SUCCESS(
                f'Done. Colors created: {created_colors} | Variations linked: {linked} | Skipped: {skipped}'
            ))
        self.stdout.write(self.style.NOTICE(
            '\nRemember to update hex codes for each Color in Django Admin:\n'
            '  https://your-domain.com/admin/products/color/'
        ))