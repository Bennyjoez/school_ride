from django.db import models
from django.contrib.auth.models import AbstractUser, BaseUserManager

class UserManager(BaseUserManager):
    def create_user(self, email, password=None, **extra_fields):
        if not email:
            raise ValueError('The Email field must be set')
        email = self.normalize_email(email)
        user = self.model(email=email, **extra_fields)
        user.set_password(password)
        user.save(using=self._db)
        return user

    def create_superuser(self, email, password=None, **extra_fields):
        extra_fields.setdefault('is_staff', True)
        extra_fields.setdefault('is_superuser', True)
        return self.create_user(email, password, **extra_fields)


# Create your models here.
class User(AbstractUser):
    class UserType(models.TextChoices):
        ADMIN = '1', 'Admin'
        DIRECTOR = '2', 'Director'
        MANAGER = '3', 'Manager'
        TEACHER = '4', 'Teacher'
        DRIVER = '5', 'Driver'
        GUARDIAN = '6', 'Guardian'
        STUDENT = '7', 'Student'
    username = None 
    email = models.EmailField(unique=True, max_length=255)

    objects = UserManager()
    
    name = models.CharField(max_length=100)
    phone_number = models.CharField(max_length=15)
    user_type = models.CharField(max_length=1, choices=UserType.choices)
    last_login = models.DateTimeField(blank=True, null=True)

    # Use email as the unique identifier for login
    USERNAME_FIELD = 'email' 
    
    # REQUIRED_FIELDS are what 'createsuperuser' will ask for (besides email/password)
    REQUIRED_FIELDS = ["name", "phone_number", "user_type"]

    def __str__(self):
        return self.name
class Profile(models.Model):
    user = models.OneToOneField(User, on_delete=models.CASCADE)
    bio = models.TextField(blank=True)
    profile_picture = models.ImageField(upload_to='profile_pictures/', blank=True)

    def __str__(self):
        return f"{self.user.name}'s Profile"