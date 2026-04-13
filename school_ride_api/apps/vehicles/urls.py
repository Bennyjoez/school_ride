from django.urls import path
from . import views

urlpatterns = [
    path('list/', views.vehicles_list, name='vehicles-list'),
    path('create/', views.vehicle_create, name='vehicles-create'),
    path('<int:pk>/', views.vehicle_detail, name='vehicles-detail'),
    path('<int:pk>/update/', views.vehicle_update, name='vehicles-update'),
    path('<int:pk>/delete/', views.vehicle_delete, name='vehicles-delete'),
]