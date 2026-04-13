from django.http import JsonResponse
from django.forms.models import model_to_dict
from psycopg2 import IntegrityError
from rest_framework.permissions import IsAuthenticated
from rest_framework.views import csrf_exempt

from utils import validate_email
from .models import User
from django.contrib.auth import login
import json
from rest_framework.decorators import api_view, permission_classes

@csrf_exempt
def login_user(request):
    if request.method == 'POST':
        data = json.loads(request.body)
        try:
            email = data['email']
        except KeyError:
            return JsonResponse({'error': 'Email is required'}, status=400)
        try:
            user = User.objects.get(email=email)
            if user:
                login(request, user)
                from rest_framework_simplejwt.tokens import RefreshToken
                refresh = RefreshToken.for_user(user)
                user.save()
                resp = {
                    'name': user.name,
                    'email': user.email,
                    'refresh': str(refresh),
                    'access': str(refresh.access_token),
                }
                return JsonResponse({'message': 'Login successful', 'user': resp})
            else:
                return JsonResponse({'error': 'Invalid credentials'}, status=400)
        except User.DoesNotExist:
            return JsonResponse({'error': 'User not found'}, status=404)
    return JsonResponse({'error': 'Invalid request method'}, status=400)


# Create your views here.
@api_view(['GET'])
@permission_classes([IsAuthenticated])
def user_list(request):
    users = User.objects.all()
    return JsonResponse([model_to_dict(user) for user in users], safe=False)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
@csrf_exempt
def user_create(request):
    if request.method != 'POST':
        return JsonResponse({'error': 'Method not allowed'}, status=405)

    try:
        data = json.loads(request.body)
    except json.JSONDecodeError:
        return JsonResponse({'error': 'Invalid JSON'}, status=400)

    # 1. Check for missing fields
    required_fields = ['name', 'phone_number', 'email', 'user_type']
    missing_fields = [field for field in required_fields if field not in data]
    if missing_fields:
        return JsonResponse({'error': f'Missing fields: {", ".join(missing_fields)}'}, status=400)

    # 2. Basic Email Validation
    email = data['email'].strip().lower()
    if not validate_email(email):
        return JsonResponse({'error': 'Invalid email format'}, status=400)

    # 3. User Type Validation (matching your model choices)
    valid_types = [choice[0] for choice in User.UserType.choices]
    if data['user_type'] not in valid_types:
        return JsonResponse({'error': 'Invalid user type'}, status=400)

    # 4. Create User and handle IntegrityErrors (Unique email)
    try:
        # Use create_user instead of create to handle password hashing
        user = User.objects.create_user(
            email=email,
            name=data['name'],
            phone_number=data['phone_number'],
            user_type=data['user_type'],
            is_staff=data['user_type'] in ['1', '2', '3', '4', '5']
        )
        return JsonResponse({'message': 'User created', 'user': model_to_dict(user, exclude=['password'])}, status=201)
    
    except IntegrityError:
        return JsonResponse({'error': 'A user with this email already exists'}, status=400)
    except Exception as e:
        print(f"Unexpected error: ", e)
        return JsonResponse({'error': 'An unexpected error occurred. ' + str(e).split('\n')[1]}, status=500)


def user_detail(request, pk):
    try:
        user = User.objects.get(pk=pk)
        return JsonResponse({'user': model_to_dict(user)})
    except User.DoesNotExist:
        return JsonResponse({'error': 'User not found'}, status=404)


def user_update(request, pk):
    try:
        if not request.user.is_staff:
            return JsonResponse({'error': 'Permission denied.'}, status=403)
        user = User.objects.get(pk=pk)
        if request.method == 'PUT':
            data = json.loads(request.body)
            user.name = data.get('name', user.name)
            user.phone_number = data.get('phone_number', user.phone_number)
            user.email = data.get('email', user.email)
            user.password = data.get('password', user.password)
            user.user_type = data.get('user_type', user.user_type)
            user.save()
            return JsonResponse({'user': model_to_dict(user)})
        return JsonResponse({'error': 'Invalid request method'}, status=400)
    except User.DoesNotExist:
        return JsonResponse({'error': 'User not found'}, status=404)


def user_delete(request, pk):
    try:
        if not request.user.is_staff:
            return JsonResponse({'error': 'Permission denied'}, status=403)
        user = User.objects.get(pk=pk)
        if(request.user._user_type not in ['1', '2']):
            return JsonResponse({'error': 'Permission denied.'}, status=403)
        if request.method == 'DELETE':
            user.delete()
            return JsonResponse({'message': 'User deleted successfully'})
        return JsonResponse({'error': 'Invalid request method'}, status=400)
    except User.DoesNotExist:
        return JsonResponse({'error': 'User not found'}, status=404)