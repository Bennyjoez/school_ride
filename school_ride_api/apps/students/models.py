from django.db import models
from django.conf import settings
import uuid

class Student(models.Model):
    school = models.ForeignKey('schools.School', on_delete=models.CASCADE, related_name='students')
    guardian = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, limit_choices_to={'user_type': '6'}, related_name='students')
    full_name = models.CharField(max_length=150)
    grade = models.CharField(max_length=20)
    student_code = models.CharField(max_length=12, unique=True, editable=False)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def save(self, *args, **kwargs):
        if not self.student_code:
            self.student_code = uuid.uuid4().hex[:8].upper()
        super().save(*args, **kwargs)

    def __str__(self):
        return self.full_name


class StudentRoute(models.Model):
    class Direction(models.TextChoices):
        MORNING = 'AM', 'Morning'
        AFTERNOON = 'PM', 'Afternoon'

    student = models.ForeignKey(Student, on_delete=models.CASCADE, related_name='route_assignments')
    route = models.ForeignKey('vehicles.Route', on_delete=models.CASCADE, related_name='student_assignments')
    stop = models.ForeignKey('vehicles.Stop', on_delete=models.SET_NULL, null=True, related_name='student_assignments')
    direction = models.CharField(max_length=2, choices=Direction.choices)
    is_active = models.BooleanField(default=True)

    class Meta:
        unique_together = ['student', 'route', 'direction']

    def __str__(self):
        return f"{self.student.full_name} on {self.route.name} ({self.get_direction_display()})"