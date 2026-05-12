# apps/users/views.py
from django.contrib.auth import get_user_model
from rest_framework import status
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework.response import Response
from rest_framework.viewsets import ModelViewSet
from rest_framework_simplejwt.tokens import RefreshToken

from apps.users.serializers import (
    UserSerializer,
    UserCreateSerializer,
    ChangePasswordSerializer,
)
from apps.users.permissions import IsAdminOrDirector, IsSelfOrAdminOrDirector

User = get_user_model()


class AuthViewSet(ModelViewSet):
    """
    Handles JWT login and token refresh.
    POST /auth/login/   - obtain access + refresh tokens
    POST /auth/refresh/ - exchange refresh token for a new access token
    """

    authentication_classes = []
    permission_classes = [AllowAny]
    http_method_names = ['post']

    @action(detail=False, methods=['post'], url_path='login')
    def login(self, request):
        email = request.data.get('email', '').strip().lower()
        password = request.data.get('password', '')

        if not email or not password:
            return Response(
                {'detail': 'Email and password are required.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            user = User.objects.get(email=email)
        except User.DoesNotExist:
            return Response(
                {'detail': 'No account found with this email.'},
                status=status.HTTP_404_NOT_FOUND,
            )

        if not user.check_password(password):
            return Response(
                {'detail': 'Incorrect password.'},
                status=status.HTTP_401_UNAUTHORIZED,
            )

        if not user.is_active:
            return Response(
                {'detail': 'This account has been deactivated.'},
                status=status.HTTP_403_FORBIDDEN,
            )

        refresh = RefreshToken.for_user(user)
        return Response({
            'access': str(refresh.access_token),
            'refresh': str(refresh),
            'user': UserSerializer(user).data,
        })

    @action(detail=False, methods=['post'], url_path='refresh')
    def refresh(self, request):
        token = request.data.get('refresh')
        if not token:
            return Response(
                {'detail': 'Refresh token is required.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        try:
            refresh = RefreshToken(token)
            return Response({'access': str(refresh.access_token)})
        except Exception:
            return Response(
                {'detail': 'Invalid or expired refresh token.'},
                status=status.HTTP_401_UNAUTHORIZED,
            )


class UserViewSet(ModelViewSet):
    """
    GET    /users/               - list all users in school
    POST   /users/               - create a new user
    GET    /users/{id}/          - retrieve a user
    PATCH  /users/{id}/          - update a user
    DELETE /users/{id}/          - deactivate a user (soft delete)
    GET    /users/me/            - current user's profile
    PATCH  /users/me/            - update current user's profile
    POST   /users/me/change-password/ - change own password
    GET    /users/drivers/       - list all drivers in the school
    """
    permission_classes = [IsAuthenticated]
    http_method_names = ['get', 'post', 'patch', 'delete']

    def get_queryset(self):
        user = self.request.user
        # Admins see all users; others see only their school's users
        if user.user_type == '1':
            return User.objects.all().order_by('name')
        school = getattr(user, 'school', None)
        if school is None:
            return User.objects.none()
        return User.objects.filter(school=school).order_by('name')

    def get_serializer_class(self):
        if self.action == 'create':
            return UserCreateSerializer
        return UserSerializer

    def get_permissions(self):
        if self.action == 'create':
            return [IsAuthenticated(), IsAdminOrDirector()]
        if self.action in ['update', 'partial_update', 'destroy']:
            return [IsAuthenticated(), IsSelfOrAdminOrDirector()]
        return [IsAuthenticated()]

    def destroy(self, request, *args, **kwargs):
        """Soft delete - deactivate instead of removing from DB."""
        user = self.get_object()
        user.is_active = False
        user.save(update_fields=['is_active'])
        return Response(
            {'detail': 'User deactivated successfully.'},
            status=status.HTTP_200_OK,
        )

    # ------------------------------------------------------------------
    # /users/me/
    # ------------------------------------------------------------------
    @action(detail=False, methods=['get', 'patch'], url_path='me',
            permission_classes=[IsAuthenticated])
    def me(self, request):
        if request.method == 'GET':
            return Response(UserSerializer(request.user).data)

        serializer = UserSerializer(
            request.user, data=request.data, partial=True,
            context={'request': request},
        )
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data)

    # ------------------------------------------------------------------
    # /users/me/change-password/
    # ------------------------------------------------------------------
    @action(detail=False, methods=['post'], url_path='me/change-password',
            permission_classes=[IsAuthenticated])
    def change_password(self, request):
        serializer = ChangePasswordSerializer(
            data=request.data, context={'request': request}
        )
        serializer.is_valid(raise_exception=True)
        request.user.set_password(serializer.validated_data['new_password'])
        request.user.save(update_fields=['password'])
        return Response({'detail': 'Password updated successfully.'})

    # ------------------------------------------------------------------
    # /users/drivers/
    # ------------------------------------------------------------------
    @action(detail=False, methods=['get'], url_path='drivers',
            permission_classes=[IsAuthenticated])
    def drivers(self, request):
        qs = self.get_queryset().filter(user_type='5', is_active=True)
        return Response(UserSerializer(qs, many=True).data)