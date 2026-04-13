
import re
from django.http import JsonResponse

def validate_email(email):
    # Basic regex for email validation
    if not re.match(r"[^@]+@[^@]+\.[^@]+", email):
        return False
    return True

def validate_plate(plate):
    # Basic regex for license plate validation (adjust as needed)
    if not re.match(r"^[K][A-Z]{2}\s\d{3}[A-Z]$", plate):
        return False
    return True

def successResponse(message, data=None):
    response = {'message': message}
    if data is not None:
        response['data'] = data
    return JsonResponse(response)

def errorResponse(message, status_code=400):
    return JsonResponse({'error': message}, status=status_code)