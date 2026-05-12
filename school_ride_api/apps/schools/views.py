# apps/schools/views.py
from rest_framework.permissions import IsAuthenticated
from rest_framework.viewsets import ModelViewSet

from apps.schools.models import School
from apps.schools.serializers import SchoolSerializer
from apps.users.permissions import IsAdmin


class SchoolViewSet(ModelViewSet):
    """
    GET    /schools/        - list schools (Admin: all; others: own school)
    POST   /schools/        - create a school (Admin only)
    GET    /schools/{id}/   - retrieve a school
    PATCH  /schools/{id}/   - update a school (Admin only)
    DELETE /schools/{id}/   - deactivate a school (Admin only)
    """
    queryset = School.objects.order_by('name')
    serializer_class = SchoolSerializer
    permission_classes = [IsAuthenticated]
    http_method_names = ['get', 'post', 'patch', 'delete']

    def get_queryset(self):
        user = self.request.user
        if user.user_type == '1':
            return School.objects.all().order_by('name')
        school = getattr(user, 'school', None)
        if school is None:
            return School.objects.none()
        return School.objects.filter(pk=school.pk)

    def get_permissions(self):
        if self.action in ['create', 'partial_update', 'destroy']:
            return [IsAuthenticated(), IsAdmin()]
        return [IsAuthenticated()]

    def destroy(self, request, *args, **kwargs):
        """Soft delete - deactivate instead of removing from DB."""
        from rest_framework.response import Response
        from rest_framework import status
        school = self.get_object()
        school.is_active = False
        school.save(update_fields=['is_active'])
        return Response(
            {'detail': 'School deactivated successfully.'},
            status=status.HTTP_200_OK,
        )