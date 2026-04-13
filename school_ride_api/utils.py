
import re

def validate_email(email):
    # Basic regex for email validation
    if not re.match(r"[^@]+@[^@]+\.[^@]+", email):
        return False
    return True