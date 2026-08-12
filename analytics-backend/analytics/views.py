from django.db.models import Avg, Max
from rest_framework.decorators import api_view
from rest_framework.response import Response

from .models import EnergyReading


@api_view(['GET'])
def resumen_consumo(_request):
	datos = EnergyReading.objects.aggregate(
		promedio=Avg('consumption_kwh'),
		pico=Max('consumption_kwh'),
	)
	alerta = datos['pico'] and datos['pico'] > 5
	return Response({**datos, 'alerta_consumo_alto': bool(alerta)})
