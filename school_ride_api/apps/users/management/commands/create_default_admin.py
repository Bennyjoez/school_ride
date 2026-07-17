import os
from django.core.management.base import BaseCommand
from django.contrib.auth import get_user_model

User = get_user_model()

class Command(BaseCommand):
    help = 'Creates a default admin user if none exists'

    def handle(self, *args, **kwargs):
        if User.objects.filter(user_type='1').exists():
            self.stdout.write('Admin user already exists, skipping.')
            return

        # Fetch credentials from environment variables
        admin_email = os.environ.get('DEFAULT_ADMIN_EMAIL', 'admin@schoolfleet.com')
        admin_name = os.environ.get('DEFAULT_ADMIN_NAME', 'Admin')
        admin_password = os.environ.get('DEFAULT_ADMIN_PASSWORD')

        if not admin_password:
            self.stdout.write(self.style.ERROR('Error: DEFAULT_ADMIN_PASSWORD environment variable is not set.'))
            return

        User.objects.create_superuser(
            email=admin_email,
            name=admin_name,
            password=admin_password,
            user_type='1',
        )
        self.stdout.write(self.style.SUCCESS('Default admin created successfully.'))