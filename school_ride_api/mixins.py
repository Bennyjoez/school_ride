from rest_framework.exceptions import PermissionDenied


class SchoolScopedMixin:
    """
    Restricts all querysets to the current user's school.
    Admins (user_type='1') retain cross-school visibility.

    Usage:
        class VehicleViewSet(SchoolScopedMixin, ModelViewSet):
            queryset = Vehicle.objects.all()
            ...

    The mixin overrides get_queryset() and perform_create() so views
    never need to manually filter by school or inject school on save.
    """

    def _is_admin(self):
        return self.request.user.user_type == '1'

    def get_queryset(self):
        qs = super().get_queryset()
        if self._is_admin():
            return qs
        school = getattr(self.request.user, 'school', None)
        if school is None:
            # User has no school assigned — return nothing rather than leak data
            return qs.none()
        return qs.filter(school=school)

    def perform_create(self, serializer):
        if self._is_admin():
            # Admin must explicitly pass school_id in the request body
            serializer.save()
            return
        school = getattr(self.request.user, 'school', None)
        if school is None:
            raise PermissionDenied('Your account is not assigned to a school.')
        serializer.save(school=school)