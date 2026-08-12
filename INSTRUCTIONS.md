# 🧭 Guía de construcción — EnergyMonitor

Esta guía te lleva paso a paso desde cero hasta tener el proyecto funcionando localmente.

---

## 0. Requisitos previos

- Node.js 18+
- Python 3.10+
- Cuenta gratuita en [supabase.com](https://supabase.com)
- Git

---

## 1. Configurar Supabase (Auth + DB + Realtime)

### 1.1 Crear el proyecto
Ve a [supabase.com](https://supabase.com) → **New Project** → guarda la **Project URL** y la **anon key** (Settings → API). Las usarás en el frontend.

### 1.2 Crear las tablas

Abre el **SQL Editor** de Supabase y ejecuta:

```sql
-- Perfiles con rol (device o dashboard)
create table profiles (
  id uuid references auth.users on delete cascade primary key,
  role text check (role in ('device', 'dashboard')) not null,
  device_name text,
  created_at timestamp with time zone default now()
);

-- Lecturas de consumo energético
create table energy_readings (
  id bigint generated always as identity primary key,
  user_id uuid references profiles(id) not null,
  device_name text not null,
  consumption_kwh numeric not null,
  voltage numeric,
  current_amps numeric,
  notes text,
  created_at timestamp with time zone default now()
);
```

### 1.3 Activar Row Level Security (RLS)

```sql
alter table profiles enable row level security;
alter table energy_readings enable row level security;

-- Cada usuario ve y edita solo su propio perfil
create policy "Ver mi perfil" on profiles
  for select using (auth.uid() = id);

create policy "Crear mi perfil" on profiles
  for insert with check (auth.uid() = id);

-- Un 'device' solo puede insertar SUS propias lecturas
create policy "Device inserta sus lecturas" on energy_readings
  for insert with check (auth.uid() = user_id);

-- Un 'device' puede ver sus propias lecturas
create policy "Device ve sus lecturas" on energy_readings
  for select using (auth.uid() = user_id);

-- Un 'dashboard' puede ver TODAS las lecturas
create policy "Dashboard ve todo" on energy_readings
  for select using (
    exists (
      select 1 from profiles
      where profiles.id = auth.uid() and profiles.role = 'dashboard'
    )
  );
```

### 1.4 Activar Realtime

En el panel de Supabase: **Database → Replication → habilita la tabla `energy_readings`** para que el dashboard reciba actualizaciones en vivo.

---

## 2. Frontend en React

### 2.1 Crear el proyecto

```bash
npm create vite@latest frontend -- --template react
cd frontend
npm install @supabase/supabase-js react-router-dom recharts
```

### 2.2 Cliente de Supabase

`src/supabaseClient.js`:
```javascript
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY

export const supabase = createClient(supabaseUrl, supabaseKey)
```

`.env` en `frontend/`:
```
VITE_SUPABASE_URL=https://TU-PROYECTO.supabase.co
VITE_SUPABASE_ANON_KEY=tu-anon-key
```

### 2.3 Registro con rol

Al registrar un usuario, después del `signUp`, inserta su fila en `profiles` con el rol elegido (`device` o `dashboard`) — normalmente con un selector en el formulario de registro.

```javascript
const { data, error } = await supabase.auth.signUp({ email, password })

if (data.user) {
  await supabase.from('profiles').insert({
    id: data.user.id,
    role: selectedRole, // 'device' o 'dashboard'
    device_name: selectedRole === 'device' ? deviceName : null,
  })
}
```

### 2.4 Vista "Device" — formulario de envío

Después de iniciar sesión, consulta el `role` en `profiles`. Si es `device`, muestra un formulario:

```javascript
async function enviarConsumo(e) {
  e.preventDefault()
  await supabase.from('energy_readings').insert({
    user_id: user.id,
    device_name: deviceName,
    consumption_kwh: parseFloat(kwh),
    voltage: parseFloat(voltage),
    current_amps: parseFloat(amps),
  })
}
```

### 2.5 Vista "Dashboard" — tiempo real

```javascript
useEffect(() => {
  // Carga inicial
  supabase.from('energy_readings')
    .select('*')
    .order('created_at', { ascending: false })
    .then(({ data }) => setReadings(data))

  // Suscripción en tiempo real
  const channel = supabase
    .channel('energy_readings_changes')
    .on('postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'energy_readings' },
      (payload) => setReadings((prev) => [payload.new, ...prev])
    )
    .subscribe()

  return () => supabase.removeChannel(channel)
}, [])
```

Usa **Recharts** (`LineChart`, `BarChart`) para graficar `readings` por dispositivo y en el tiempo.

### 2.6 Ruteo por rol

Con `react-router-dom`, redirige tras el login según `profiles.role`:
- `device` → `/device`
- `dashboard` → `/dashboard`

---

## 3. Backend de análisis en Django

Este servicio **no maneja autenticación de usuarios finales** (eso ya lo hace Supabase) — su función es leer los datos ya guardados y exponer análisis agregados (promedios, picos, alertas) para que el dashboard los consuma como complemento.

### 3.1 Crear el proyecto

```bash
django-admin startproject config analytics-backend
cd analytics-backend
python -m venv venv && source venv/bin/activate
pip install django djangorestframework psycopg2-binary python-dotenv django-cors-headers
django-admin startapp analytics
```

### 3.2 Conectar a la base de datos de Supabase

Supabase es PostgreSQL puro, así que Django se conecta directo. En `config/settings.py`:

```python
import os
from dotenv import load_dotenv
load_dotenv()

DATABASES = {
    'default': {
        'ENGINE': 'django.db.backends.postgresql',
        'NAME': 'postgres',
        'USER': 'postgres',
        'PASSWORD': os.getenv('SUPABASE_DB_PASSWORD'),
        'HOST': os.getenv('SUPABASE_DB_HOST'),  # db.xxxx.supabase.co
        'PORT': '5432',
    }
}

INSTALLED_APPS += ['rest_framework', 'corsheaders', 'analytics']
MIDDLEWARE.insert(0, 'corsheaders.middleware.CorsMiddleware')
CORS_ALLOW_ALL_ORIGINS = True  # ajusta en producción
```

> 💡 Usa la contraseña y host de la base de datos que Supabase te da en **Settings → Database**.

### 3.3 Modelo (mapeado a la tabla existente, sin migrarla)

```python
# analytics/models.py
from django.db import models

class EnergyReading(models.Model):
    id = models.BigAutoField(primary_key=True)
    user_id = models.UUIDField()
    device_name = models.TextField()
    consumption_kwh = models.FloatField()
    voltage = models.FloatField(null=True)
    current_amps = models.FloatField(null=True)
    created_at = models.DateTimeField()

    class Meta:
        managed = False  # la tabla ya existe, creada por Supabase
        db_table = 'energy_readings'
```

### 3.4 Vista de análisis

```python
# analytics/views.py
from rest_framework.decorators import api_view
from rest_framework.response import Response
from django.db.models import Avg, Max
from .models import EnergyReading

@api_view(['GET'])
def resumen_consumo(request):
    datos = EnergyReading.objects.aggregate(
        promedio=Avg('consumption_kwh'),
        pico=Max('consumption_kwh'),
    )
    alerta = datos['pico'] and datos['pico'] > 5  # umbral ejemplo
    return Response({**datos, 'alerta_consumo_alto': bool(alerta)})
```

```python
# analytics/urls.py
from django.urls import path
from .views import resumen_consumo

urlpatterns = [path('resumen/', resumen_consumo)]
```

Conecta esta URL en `config/urls.py` bajo `api/analytics/`.

### 3.5 Ejecutar

```bash
python manage.py runserver
```

El dashboard de React puede hacer `fetch('http://localhost:8000/api/analytics/resumen/')` para mostrar el análisis adicional junto a las gráficas en tiempo real.

---

## 4. Variables de entorno — resumen

**`frontend/.env`**
```
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
```

**`analytics-backend/.env`**
```
SUPABASE_DB_HOST=
SUPABASE_DB_PASSWORD=
```

---

## 5. Flujo completo (resumen)

1. Un usuario se registra eligiendo rol `device` o `dashboard`.
2. El usuario `device` inicia sesión → ve el formulario → envía datos de consumo → se inserta en `energy_readings`.
3. Gracias a Supabase Realtime, el usuario `dashboard` recibe ese nuevo dato al instante y actualiza sus gráficas.
4. Opcionalmente, el dashboard también consulta la API de Django para ver promedios, picos y alertas calculadas sobre el histórico.

---

## 6. Próximos pasos sugeridos

- Agregar botón "simular envío automático" que dispare inserciones periódicas (setInterval) para no depender solo del formulario manual.
- Agregar notificaciones cuando el consumo supere un umbral.
- Desplegar frontend en Vercel/Netlify y backend Django en Railway/Render.
