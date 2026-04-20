from django.db import models


class Vehicle(models.Model):
    class VehicleType(models.TextChoices):
        BUS = '1', 'Bus'
        VAN = '2', 'Van'
        CAR = '3', 'Car'

    class VehicleStatus(models.TextChoices):
        AVAILABLE   = 'available',   'Available'
        IN_SERVICE  = 'in_service',  'In Service'
        MAINTENANCE = 'maintenance', 'Maintenance'

    school = models.ForeignKey('schools.School', on_delete=models.CASCADE, related_name='vehicles')
    vehicle_type = models.CharField(max_length=1, choices=VehicleType.choices)
    license_plate = models.CharField(max_length=20, unique=True)
    capacity = models.PositiveIntegerField()
    driver = models.ForeignKey('users.User', on_delete=models.SET_NULL, null=True, blank=True, limit_choices_to={'user_type': '5'}, related_name='vehicles')
    status = models.CharField(max_length=20, choices=VehicleStatus.choices, default=VehicleStatus.AVAILABLE)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"{self.get_vehicle_type_display()} — {self.license_plate}"


class Route(models.Model):
    class Direction(models.TextChoices):
        MORNING = 'AM', 'Morning'
        AFTERNOON = 'PM', 'Afternoon'
        BOTH = 'BOTH', 'Both'

    school = models.ForeignKey('schools.School', on_delete=models.CASCADE, related_name='routes')
    vehicle = models.ForeignKey(Vehicle, on_delete=models.SET_NULL, null=True, blank=True, related_name='routes')
    driver = models.ForeignKey('users.User', on_delete=models.SET_NULL, null=True, blank=True, limit_choices_to={'user_type': '5'}, related_name='routes')
    name = models.CharField(max_length=100)
    direction = models.CharField(max_length=4, choices=Direction.choices, default=Direction.BOTH)
    scheduled_start = models.TimeField(null=True, blank=True)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.name} ({self.get_direction_display()})"


class Stop(models.Model):
    route = models.ForeignKey(Route, on_delete=models.CASCADE, related_name='stops')
    name = models.CharField(max_length=100)
    latitude = models.DecimalField(max_digits=9, decimal_places=6)
    longitude = models.DecimalField(max_digits=9, decimal_places=6)
    sequence = models.PositiveSmallIntegerField()
    eta_minutes = models.PositiveSmallIntegerField(default=0, help_text='Minutes from route start')

    class Meta:
        ordering = ['sequence']

    def __str__(self):
        return f"{self.route.name} — Stop {self.sequence}: {self.name}"