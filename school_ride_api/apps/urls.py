from django.urls import path, include
from rest_framework.routers import DefaultRouter
 
from apps.users.views import AuthViewSet, UserViewSet
from apps.schools.views import SchoolViewSet
from apps.vehicles.views import VehicleViewSet, RouteViewSet
from apps.students.views import StudentViewSet
from apps.trips.views import TripViewSet
 
router = DefaultRouter()
router.register(r'auth',     AuthViewSet,    basename='auth')
router.register(r'users',    UserViewSet,    basename='users')
router.register(r'schools',  SchoolViewSet,  basename='schools')
router.register(r'vehicles', VehicleViewSet, basename='vehicles')
router.register(r'routes',   RouteViewSet,   basename='routes')
router.register(r'students', StudentViewSet, basename='students')
router.register(r'trips',    TripViewSet,    basename='trips')
 
urlpatterns = [
    path('', include(router.urls)),
]