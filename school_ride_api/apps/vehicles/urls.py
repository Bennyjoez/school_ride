from django.urls import path
from . import views

urlpatterns = [
    path('list/', views.vehicles_list, name='vehicles-list'),
    path('create/', views.vehicles_create, name='vehicles-create'),
    path('<int:pk>/', views.vehicles_detail, name='vehicles-detail'),
    path('<int:pk>/update/', views.vehicles_update, name='vehicles-update'),
    path('<int:pk>/delete/', views.vehicles_delete, name='vehicles-delete'),
]