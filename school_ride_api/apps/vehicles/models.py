from django.db import models

# Create your models here.
class Vehicle(models.Model):
    class VehicleType(models.TextChoices):
        BUS = '1', 'Bus'
        VAN = '2', 'Van'
        CAR = '3', 'Car'
    class VehicleStatus(models.TextChoices):
        AVAILABLE = 'available', 'Available'
        IN_SERVICE = 'in_service', 'In Service'
        MAINTENANCE = 'maintenance', 'Maintenance'
    vehicle_type = models.CharField(max_length=1, choices=VehicleType.choices)
    license_plate = models.CharField(max_length=20, unique=True)
    capacity = models.PositiveIntegerField()
    driver = models.ForeignKey('users.User', on_delete=models.SET_NULL, null=True, blank=True, limit_choices_to={'user_type': '5'})  # Only drivers
    status = models.CharField(max_length=20, choices=VehicleStatus.choices, default='available')  # e.g., available, in_service, maintenance
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)


    def __str__(self):
        return f"{self.get_vehicle_type_display()} - {self.license_plate}"
    
class Route(models.Model):
    name = models.CharField(max_length=100)
    stops = models.TextField(help_text="Comma-separated list of stops")
    vehicle = models.ForeignKey(Vehicle, on_delete=models.SET_NULL, null=True, blank=True)

    def __str__(self):
        return self.name
    
class Schedule(models.Model):
    route = models.ForeignKey(Route, on_delete=models.CASCADE)
    departure_time = models.DateTimeField()
    arrival_time = models.DateTimeField()

    def __str__(self):
        return f"{self.route.name} - {self.departure_time.strftime('%Y-%m-%d %H:%M')}"