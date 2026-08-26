import { useEffect, useMemo, useState } from 'react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { supabase } from '../supabaseClient'

export default function DashboardView() {
  const [readings, setReadings] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true

    async function loadReadings() {
      const { data, error: queryError } = await supabase
        .from('mediciones')
        .select('*')
        .order('creado_en', { ascending: false })
        .limit(100)

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
      .channel('mediciones_changes')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'mediciones' },
        (payload) => {
          setReadings((prev) => [payload.new, ...prev].slice(0, 100))
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
  }, [])

  const chartData = useMemo(() => {
    return [...readings]
      .reverse()
      .map((item) => ({
        timestamp: new Date(item.creado_en).toLocaleTimeString(),
        dispositivo: item.dispositivo,
        energia_kwh: Number(item.energia_kwh),
      }))
  }, [readings])

  const deviceTotals = useMemo(() => {
    const map = new Map()

    for (const reading of readings) {
      const key = reading.dispositivo
      const current = map.get(key) || 0
      map.set(key, current + Number(reading.energia_kwh))
    }

    return [...map.entries()].map(([device, total]) => ({ device, total: Number(total.toFixed(2)) }))
  }, [readings])

  const analytics = useMemo(() => {
    if (!readings.length) {
      return { promedio: null, pico: null, alerta_consumo_alto: false }
    }

    const values = readings.map((item) => Number(item.energia_kwh) || 0)
    const total = values.reduce((acc, value) => acc + value, 0)
    const promedio = total / values.length
    const pico = Math.max(...values)

    return {
      promedio,
      pico,
      alerta_consumo_alto: pico > 5,
    }
  }, [readings])

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
          <h3>Promedio kWh</h3>
          <p>{analytics.promedio !== null ? Number(analytics.promedio).toFixed(2) : 'N/A'}</p>
        </article>
        <article>
          <h3>Pico kWh</h3>
          <p>{analytics.pico !== null ? Number(analytics.pico).toFixed(2) : 'N/A'}</p>
        </article>
        <article>
          <h3>Alerta</h3>
          <p>{analytics.alerta_consumo_alto ? 'Consumo alto' : 'Normal'}</p>
        </article>
      </section>

      {error && <p className="status">Error al cargar mediciones: {error}</p>}

      <section className="card">
        <h2>Linea temporal de consumo</h2>
        {loading ? (
          <p>Cargando datos...</p>
        ) : (
          <div className="chart-wrap">
            <ResponsiveContainer width="100%" height={320}>
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="4 4" />
                <XAxis dataKey="timestamp" minTickGap={24} />
                <YAxis />
                <Tooltip />
                <Legend />
                <Line type="monotone" dataKey="energia_kwh" stroke="#177245" name="kWh" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </section>

      <section className="card">
        <h2>Total por dispositivo</h2>
        <div className="chart-wrap">
          <ResponsiveContainer width="100%" height={320}>
            <BarChart data={deviceTotals}>
              <CartesianGrid strokeDasharray="4 4" />
              <XAxis dataKey="device" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Bar dataKey="total" fill="#c05a00" name="kWh acumulado" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </section>
    </main>
  )
}
