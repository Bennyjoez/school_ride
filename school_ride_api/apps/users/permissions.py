# apps/users/permissions.py
from rest_framework.permissions import BasePermission


class IsAdmin(BasePermission):
    """Only system-wide Admins (user_type='1')."""
    def has_permission(self, request, view):
        return bool(request.user and request.user.is_authenticated
                    and request.user.user_type == '1')


class IsAdminOrDirector(BasePermission):
    """Admins and Directors (user_type '1' or '2')."""
    def has_permission(self, request, view):
        return bool(request.user and request.user.is_authenticated
                    and request.user.user_type in ('1', '2'))


class IsAdminOrDirectorOrManager(BasePermission):
    """Admins, Directors, and Managers (user_type '1', '2', or '3')."""
    def has_permission(self, request, view):
        return bool(request.user and request.user.is_authenticated
                    and request.user.user_type in ('1', '2', '3'))


class IsSelfOrAdminOrDirector(BasePermission):
    """
    Object-level: allow if the request user is the target user,
    or is an Admin/Director.
    """
    def has_object_permission(self, request, view, obj):
        if not request.user or not request.user.is_authenticated:
            return False
        if request.user.user_type in ('1', '2'):
            return True
        return obj.pk == request.user.pk


class IsDriverOfTrip(BasePermission):
    """
    Object-level: the authenticated user must be the driver assigned
    to the trip, or be an Admin/Director/Manager.
    """
    def has_permission(self, request, view):
        return bool(request.user and request.user.is_authenticated)

    def has_object_permission(self, request, view, obj):
        if request.user.user_type in ('1', '2', '3'):
            return True
        return obj.driver_id == request.user.pk