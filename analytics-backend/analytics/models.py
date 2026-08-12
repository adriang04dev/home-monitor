from django.db import models


class EnergyReading(models.Model):
	id = models.BigAutoField(primary_key=True)
	user_id = models.UUIDField()
	device_name = models.TextField()
	consumption_kwh = models.FloatField()
	voltage = models.FloatField(null=True)
	current_amps = models.FloatField(null=True)
	notes = models.TextField(null=True)
	created_at = models.DateTimeField()

	class Meta:
		managed = False
		db_table = 'energy_readings'
