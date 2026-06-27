from django.core.management.base import BaseCommand
from django.contrib.auth import get_user_model

User = get_user_model()

class Command(BaseCommand):
    help = 'Creates a default admin user if none exists'

    def handle(self, *args, **kwargs):
        if User.objects.filter(user_type='1').exists():
            self.stdout.write('Admin user already exists, skipping.')
            return

        User.objects.create_superuser(
            email='admin@schoolfleet.com',
            name='Admin',
            password='Admin1234!',
            user_type='1',
        )
        self.stdout.write(self.style.SUCCESS('Default admin created successfully.'))