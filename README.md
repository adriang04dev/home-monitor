# ⚡ EnergyMonitor — Simulador de Consumo Energético del Hogar

Proyecto educativo que simula un sistema de monitoreo de consumo energético doméstico. La aplicación tiene dos tipos de usuarios con roles distintos:

- 🔌 **Usuario Dispositivo**: simula un medidor de energía. Al iniciar sesión, reporta manualmente (vía formulario) los datos de consumo de un electrodoméstico o del hogar.
- 📊 **Usuario Dashboard**: monitorea en tiempo real todos los datos enviados por los dispositivos, visualizados en gráficas y métricas.

## 🧠 Idea del proyecto

En lugar de conectar un sensor físico real, este proyecto **simula** el comportamiento de un dispositivo IoT usando autenticación de usuarios: cada "dispositivo" es en realidad una cuenta con rol `device`, y cada vez que esa cuenta inicia sesión y llena su formulario, se genera un nuevo registro de consumo que aparece automáticamente en el dashboard gracias a las suscripciones en tiempo real de Supabase.

## 🏗️ Arquitectura

```
┌─────────────────────┐        ┌──────────────────────────┐
│   React (Frontend)  │◄──────►│   Supabase                │
│  - Login/Registro   │        │  - Auth (roles)           │
│  - Vista "Device"   │        │  - PostgreSQL              │
│  - Vista "Dashboard"│◄──────►│  - Realtime (subs)         │
│  - Gráficas (charts)│        │  - Row Level Security      │
└─────────────────────┘        └──────────┬────────────────┘
                                           │
                                           │ lectura de datos
                                           ▼
                                ┌──────────────────────────┐
                                │   Django (API de análisis)│
                                │  - Promedios, picos       │
                                │  - Detección de anomalías │
                                │  - Reportes agregados      │
                                └──────────────────────────┘
```

## 👥 Roles de usuario

| Rol         | ¿Qué hace?                                                                 |
|-------------|------------------------------------------------------------------------------|
| `device`    | Al iniciar sesión, ve un formulario para reportar su consumo (kWh, voltaje, corriente, electrodoméstico). Cada envío crea un registro en la base de datos. |
| `dashboard` | Al iniciar sesión, ve un panel en tiempo real con gráficas de consumo por dispositivo, totales, picos de uso y alertas. |

## 🚀 Funcionalidades

- [x] Autenticación con Supabase Auth (correo/contraseña)
- [x] Roles diferenciados (device / dashboard) mediante tabla `profiles`
- [x] Formulario de envío de consumo simulado
- [x] Dashboard en tiempo real con Supabase Realtime (websockets)
- [x] Gráficas de consumo (línea, barras) con Recharts
- [x] API de análisis en Django (promedios, picos de consumo, alertas de consumo alto)
- [x] Row Level Security: cada dispositivo solo puede insertar sus propios datos; el dashboard puede leer todos

## 🛠️ Tecnologías

- **Frontend:** React + Vite, React Router, Recharts, supabase-js
- **Backend de datos / Auth:** Supabase (PostgreSQL + Auth + Realtime)
- **Backend de análisis:** Django + Django REST Framework
- **Base de datos:** PostgreSQL (gestionada por Supabase)

## 📁 Estructura del repositorio

```
proyecto-energia/
├── frontend/               # App en React
│   ├── src/
│   │   ├── pages/
│   │   │   ├── Login.jsx
│   │   │   ├── DeviceView.jsx
│   │   │   └── DashboardView.jsx
│   │   ├── components/
│   │   ├── supabaseClient.js
│   │   └── App.jsx
│   └── package.json
├── analytics-backend/      # API en Django
│   ├── analytics/
│   │   ├── models.py
│   │   ├── views.py
│   │   └── urls.py
│   ├── manage.py
│   └── requirements.txt
├── supabase/
│   └── schema.sql          # Definición de tablas y RLS
├── INSTRUCTIONS.md         # Guía paso a paso de construcción
└── README.md
```

## ⚙️ Configuración rápida

1. Clona el repositorio
2. Crea un proyecto en [Supabase](https://supabase.com) y ejecuta `supabase/schema.sql`
3. Configura las variables de entorno (ver `INSTRUCTIONS.md`)
4. Instala dependencias del frontend: `cd frontend && npm install && npm run dev`
5. Instala dependencias del backend de análisis: `cd analytics-backend && pip install -r requirements.txt && python manage.py runserver`

Para la guía completa y detallada, revisa **[INSTRUCTIONS.md](./INSTRUCTIONS.md)**.

## 📌 Estado del proyecto

Proyecto en desarrollo con fines de aprendizaje / portafolio — simula un sistema de monitoreo IoT sin necesidad de hardware real.

## 📄 Licencia

MIT