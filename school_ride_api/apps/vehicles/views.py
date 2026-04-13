import json
from django.http import JsonResponse
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from django.forms.models import model_to_dict

from utils import successResponse, errorResponse, validate_plate
from .models import Vehicle
from rest_framework.views import csrf_exempt

# Create your views here.

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def vehicles_list(request):
    vehicles = Vehicle.objects.all()
    return successResponse('Vehicles retrieved successfully', [model_to_dict(vehicle) for vehicle in vehicles])


@api_view(['POST'])
@permission_classes([IsAuthenticated])
@csrf_exempt
def vehicle_create(request):
    if request.method != 'POST':
        return JsonResponse({'error': 'Method not allowed'}, status=405)

    try:
        data = json.loads(request.body)
    except json.JSONDecodeError:
        return JsonResponse({'error': 'Invalid JSON'}, status=400)

    try:
        if not validate_plate(data['license_plate']):
            return JsonResponse({'error': 'Invalid license plate format'}, status=400)
        if Vehicle.objects.filter(license_plate=data['license_plate'].upper()).exists():
            return JsonResponse({'error': 'License plate already exists'}, status=400)
        if data['capacity'] <= 0:
            return JsonResponse({'error': 'Capacity must be a positive integer'}, status=400)
        if data['status'] not in [choice[0] for choice in Vehicle.VehicleStatus.choices]:
            return JsonResponse({'error': 'Invalid status value'}, status=400)
        vehicle = Vehicle.objects.create(
            vehicle_type=data['vehicle_type'],
            license_plate=data['license_plate'].upper(),
            capacity=data['capacity'],
            driver_id=data['driver_id'],
            status=data['status']
        )
        return JsonResponse(model_to_dict(vehicle), status=201)
    except KeyError as e:
        return JsonResponse({'error': f'Missing field: {str(e)}'}, status=400)
    except Exception as e:
        return JsonResponse({'error': str(e)}, status=400)
    

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def vehicle_detail(request, pk):
    try:
        vehicle = Vehicle.objects.get(pk=pk)
        return JsonResponse(model_to_dict(vehicle))
    except Vehicle.DoesNotExist:
        return errorResponse("Vehicle not found", 404)
    

@api_view(['PUT'])
@permission_classes([IsAuthenticated])
@csrf_exempt
def vehicle_update(request, pk):
    if not request.user.is_staff:
        return errorResponse("You do not have permission to perform this action", 403)
    try:
        vehicle = Vehicle.objects.get(pk=pk)
    except Vehicle.DoesNotExist:
        return errorResponse("Vehicle not found", 404)

    try:
        data = json.loads(request.body)
    except json.JSONDecodeError:
        return errorResponse("Invalid JSON", 400)

    to_update = False
    for field in ['vehicle_type', 'license_plate', 'capacity', 'driver_id']:
        if field in data:
            setattr(vehicle, field, data[field])
    
    if to_update:
        vehicle.save()
    return successResponse('Vehicle updated successfully', model_to_dict(vehicle))


@api_view(['DELETE'])
@permission_classes([IsAuthenticated])
def vehicle_delete(request, pk):
    if not request.user.is_staff:
        return errorResponse("You do not have permission to perform this action", 403)
    try:
        vehicle = Vehicle.objects.get(pk=pk)
        vehicle.delete()
        return successResponse('Vehicle deleted successfully')
    except Vehicle.DoesNotExist:
        return errorResponse("Vehicle not found", 404)