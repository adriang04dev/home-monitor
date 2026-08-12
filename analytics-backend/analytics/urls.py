from django.urls import path

from .views import resumen_consumo

urlpatterns = [path('resumen/', resumen_consumo)]
