# apps/students/views.py
from rest_framework import status
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.viewsets import ModelViewSet

from mixins import SchoolScopedMixin
from apps.students.models import Student, StudentRoute
from apps.students.serializers import StudentSerializer, StudentRouteSerializer
from apps.users.permissions import IsAdminOrDirectorOrManager


class StudentViewSet(SchoolScopedMixin, ModelViewSet):
    """
    GET    /students/                          — list students in school
    POST   /students/                          — create a student
    GET    /students/{id}/                     — retrieve a student
    PATCH  /students/{id}/                     — update a student
    DELETE /students/{id}/                     — deactivate a student
    POST   /students/{id}/generate-code/       — regenerate QR/PIN code
    GET    /students/{id}/routes/              — list route assignments
    POST   /students/{id}/routes/              — assign a route
    GET    /students/{id}/routes/{assignment_id}/ — retrieve assignment
    PATCH  /students/{id}/routes/{assignment_id}/ — update assignment
    DELETE /students/{id}/routes/{assignment_id}/ — remove assignment
    """
    queryset = Student.objects.select_related(
        'school', 'guardian'
    ).prefetch_related('route_assignments').order_by('full_name')
    serializer_class = StudentSerializer
    permission_classes = [IsAuthenticated]
    http_method_names = ['get', 'post', 'patch', 'delete']

    def get_permissions(self):
        if self.action in ['create', 'partial_update', 'destroy',
                           'generate_code', 'routes_create',
                           'route_detail']:
            return [IsAuthenticated(), IsAdminOrDirectorOrManager()]
        return [IsAuthenticated()]

    def destroy(self, request, *args, **kwargs):
        """Soft delete — deactivate instead of removing from DB."""
        student = self.get_object()
        student.is_active = False
        student.save(update_fields=['is_active'])
        return Response(
            {'detail': 'Student deactivated successfully.'},
            status=status.HTTP_200_OK,
        )

    # ------------------------------------------------------------------
    # /students/{id}/generate-code/
    # ------------------------------------------------------------------
    @action(detail=True, methods=['post'], url_path='generate-code',
            permission_classes=[IsAuthenticated, IsAdminOrDirectorOrManager])
    def generate_code(self, request, pk=None):
        import uuid
        student = self.get_object()
        student.student_code = uuid.uuid4().hex[:8].upper()
        student.save(update_fields=['student_code'])
        return Response({
            'detail': 'Check-in code regenerated.',
            'student_code': student.student_code,
        })

    # ------------------------------------------------------------------
    # /students/{id}/routes/
    # ------------------------------------------------------------------
    @action(detail=True, methods=['get', 'post'], url_path='routes')
    def routes(self, request, pk=None):
        student = self.get_object()

        if request.method == 'GET':
            qs = student.route_assignments.select_related('route', 'stop')
            return Response(StudentRouteSerializer(qs, many=True).data)

        # POST — assign a route
        serializer = StudentRouteSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        serializer.save(student=student)
        return Response(serializer.data, status=status.HTTP_201_CREATED)

    # ------------------------------------------------------------------
    # /students/{id}/routes/{assignment_id}/
    # ------------------------------------------------------------------
    @action(detail=True, methods=['get', 'patch', 'delete'],
            url_path=r'routes/(?P<assignment_id>\d+)')
    def route_detail(self, request, pk=None, assignment_id=None):
        student = self.get_object()
        try:
            assignment = student.route_assignments.get(pk=assignment_id)
        except StudentRoute.DoesNotExist:
            return Response(
                {'detail': 'Route assignment not found.'},
                status=status.HTTP_404_NOT_FOUND,
            )

        if request.method == 'GET':
            return Response(StudentRouteSerializer(assignment).data)

        if request.method == 'PATCH':
            serializer = StudentRouteSerializer(
                assignment, data=request.data, partial=True
            )
            serializer.is_valid(raise_exception=True)
            serializer.save()
            return Response(serializer.data)

        # DELETE
        assignment.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)