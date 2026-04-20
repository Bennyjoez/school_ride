from django.db import models

class School(models.Model):
    name = models.CharField(max_length=200)
    region = models.CharField(max_length=100)
    timezone = models.CharField(max_length=50)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.name