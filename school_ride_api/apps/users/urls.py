from django.urls import path
from . import views

urlpatterns = [
    path('login/', views.login_user, name='login'),
    path('list/', views.user_list, name='user-list'),
    path('create/', views.user_create, name='user-create'),
    path('<int:pk>/', views.user_detail, name='user-detail'),
    path('<int:pk>/update/', views.user_update, name='user-update'),
    path('<int:pk>/delete/', views.user_delete, name='user-delete'),
]