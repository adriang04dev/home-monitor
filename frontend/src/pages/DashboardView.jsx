import { useEffect, useMemo, useState } from 'react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { supabase } from '../supabaseClient'

const PERIOD_OPTIONS = {
  hours: { label: 'Horas', amount: 24, unit: 'hours' },
  days: { label: 'Dias', amount: 7, unit: 'days' },
  month: { label: 'Mes', amount: 30, unit: 'days' },
}

const READING_DATE_FIELDS = ['creado_en', 'created_at', 'fecha', 'timestamp']

function getPeriodStart(period) {
  const selectedPeriod = PERIOD_OPTIONS[period]
  const start = new Date()

  if (selectedPeriod.unit === 'hours') {
    start.setHours(start.getHours() - selectedPeriod.amount)
  } else {
    start.setDate(start.getDate() - selectedPeriod.amount)
  }

  return start.toISOString()
}

function getReadingDate(reading) {
  const dateField = READING_DATE_FIELDS.find((field) => reading[field])
  return dateField ? new Date(reading[dateField]) : null
}

function getReadingDevice(reading) {
  return reading.dispositivo_id || 'Sin dispositivo'
}

export default function DashboardView() {
  const [readings, setReadings] = useState([])
  const [period, setPeriod] = useState('hours')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true

    async function loadReadings() {
      const { data, error: queryError } = await supabase
        .from('mediciones_energia')
        .select('*')
        .limit(1000)

      if (active && queryError) {
        setError(queryError.message || 'No se pudieron cargar las mediciones.')
      }
      if (active && data) {
        setReadings(data)
        setError('')
      }
      if (active) setLoading(false)
    }

    loadReadings()

    const channel = supabase
      .channel('mediciones_energia_changes')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'mediciones_energia' },
        (payload) => {
          setReadings((prev) => [payload.new, ...prev].slice(0, 1000))
        },
      )
      .subscribe((subscriptionStatus) => {
        if (subscriptionStatus === 'CHANNEL_ERROR' && active) {
          setError('No se pudo activar la actualizacion en tiempo real. Ejecuta el esquema SQL de mediciones.')
        }
      })

    return () => {
      active = false
      supabase.removeChannel(channel)
    }
  }, [period])

  const filteredReadings = useMemo(() => {
    const periodStart = new Date(getPeriodStart(period)).getTime()
    return readings.filter((reading) => {
      const readingDate = getReadingDate(reading)
      return !readingDate || readingDate.getTime() >= periodStart
    })
  }, [readings, period])

  const chartData = useMemo(() => {
    return [...filteredReadings]
      .sort((left, right) => {
        const leftDate = getReadingDate(left)?.getTime() || 0
        const rightDate = getReadingDate(right)?.getTime() || 0
        return leftDate - rightDate
      })
      .map((item) => ({
        timestamp: getReadingDate(item)?.toLocaleString([], {
          day: '2-digit',
          month: '2-digit',
          hour: '2-digit',
          minute: '2-digit',
        }) || 'Sin fecha',
        dispositivo: getReadingDevice(item),
        potencia_w: Number(item.potencia) || 0,
        voltaje_v: Number(item.voltaje) || 0,
        corriente_a: Number(item.corriente) || 0,
      }))
  }, [filteredReadings])

  const deviceTotals = useMemo(() => {
    const map = new Map()

    for (const reading of filteredReadings) {
      const key = getReadingDevice(reading)
      const current = map.get(key) || 0
      map.set(key, current + (Number(reading.potencia) || 0))
    }

    return [...map.entries()].map(([device, total]) => ({ device, total: Number(total.toFixed(2)) }))
  }, [filteredReadings])

  const analytics = useMemo(() => {
    if (!filteredReadings.length) {
      return { promedio: null, pico: null, alerta_consumo_alto: false }
    }

    const values = filteredReadings.map((item) => Number(item.potencia) || 0)
    const total = values.reduce((acc, value) => acc + value, 0)
    const promedio = total / values.length
    const pico = Math.max(...values)
    const voltajes = filteredReadings.map((item) => Number(item.voltaje) || 0)
    const corrientes = filteredReadings.map((item) => Number(item.corriente) || 0)
    const alarmas = filteredReadings.filter((item) => item.alarma_activa).length

    return {
      promedio,
      pico,
      voltaje_promedio: voltajes.reduce((acc, value) => acc + value, 0) / values.length,
      corriente_promedio: corrientes.reduce((acc, value) => acc + value, 0) / values.length,
      alarmas,
      alerta_consumo_alto: alarmas > 0,
    }
  }, [filteredReadings])

  async function cerrarSesion() {
    await supabase.auth.signOut()
  }

  return (
    <main className="page">
      <header className="topbar">
        <div>
          <h1>Dashboard en tiempo real</h1>
          <p className="subtitle">Lecturas recientes de consumo energetico del hogar</p>
        </div>
        <button type="button" onClick={cerrarSesion}>
          Cerrar sesion
        </button>
      </header>

      <section className="card metrics-grid">
        <article>
          <h3>Potencia promedio</h3>
          <p>{analytics.promedio !== null ? `${Number(analytics.promedio).toFixed(2)} W` : 'N/A'}</p>
        </article>
        <article>
          <h3>Voltaje promedio</h3>
          <p>{analytics.promedio !== null ? `${Number(analytics.voltaje_promedio).toFixed(2)} V` : 'N/A'}</p>
        </article>
        <article>
          <h3>Corriente promedio</h3>
          <p>{analytics.promedio !== null ? `${Number(analytics.corriente_promedio).toFixed(2)} A` : 'N/A'}</p>
        </article>
        <article>
          <h3>Potencia pico</h3>
          <p>{analytics.pico !== null ? `${Number(analytics.pico).toFixed(2)} W` : 'N/A'}</p>
        </article>
        <article>
          <h3>Alarmas activas</h3>
          <p>{analytics.alarmas ?? 0}</p>
        </article>
      </section>

      <section className="card period-filter" aria-label="Periodo de mediciones">
        <h2>Periodo</h2>
        <div className="period-options" role="group" aria-label="Filtrar por periodo">
          {Object.entries(PERIOD_OPTIONS).map(([value, option]) => (
            <button
              key={value}
              type="button"
              className={period === value ? 'active' : ''}
              aria-pressed={period === value}
              onClick={() => setPeriod(value)}
            >
              {option.label}
            </button>
          ))}
        </div>
      </section>

      {error && <p className="status">Error al cargar mediciones_energia: {error}</p>}

      <section className="card">
        <h2>Linea temporal de potencia</h2>
        {loading ? (
          <p>Cargando datos...</p>
        ) : !filteredReadings.length ? (
          <p>No hay mediciones en este periodo.</p>
        ) : (
          <div className="chart-wrap">
            <ResponsiveContainer width="100%" height={320}>
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="4 4" />
                <XAxis dataKey="timestamp" minTickGap={24} />
                <YAxis />
                <Tooltip />
                <Legend />
                <Line type="monotone" dataKey="potencia_w" stroke="#177245" name="Potencia (W)" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </section>

      <section className="card">
        <h2>Voltaje y corriente</h2>
        {loading ? (
          <p>Cargando datos...</p>
        ) : !filteredReadings.length ? (
          <p>No hay mediciones en este periodo.</p>
        ) : (
          <div className="chart-wrap">
            <ResponsiveContainer width="100%" height={320}>
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="4 4" />
                <XAxis dataKey="timestamp" minTickGap={24} />
                <YAxis yAxisId="voltaje" label={{ value: 'V', angle: -90, position: 'insideLeft' }} />
                <YAxis
                  yAxisId="corriente"
                  orientation="right"
                  label={{ value: 'A', angle: 90, position: 'insideRight' }}
                />
                <Tooltip />
                <Legend />
                <Line yAxisId="voltaje" type="monotone" dataKey="voltaje_v" stroke="#2563eb" name="Voltaje (V)" />
                <Line yAxisId="corriente" type="monotone" dataKey="corriente_a" stroke="#9333ea" name="Corriente (A)" />
                
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </section>

      <section className="card">
        <h2>Potencia acumulada por dispositivo</h2>
        <div className="chart-wrap">
          <ResponsiveContainer width="100%" height={320}>
            <BarChart data={deviceTotals}>
              <CartesianGrid strokeDasharray="4 4" />
              <XAxis dataKey="device" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Bar dataKey="total" fill="#c05a00" name="Potencia (W)" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </section>
    </main>
  )
}
