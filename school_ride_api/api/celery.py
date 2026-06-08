import os
from celery import Celery
 
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'api.settings')
 
app = Celery('schoolfleet')
 
# Pull config from Django settings, namespace all Celery keys with CELERY_
app.config_from_object('django.conf:settings', namespace='CELERY')
 
# Auto-discover tasks in all INSTALLED_APPS
app.autodiscover_tasks()
