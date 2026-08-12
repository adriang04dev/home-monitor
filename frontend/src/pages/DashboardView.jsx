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

const ANALYTICS_URL = import.meta.env.VITE_ANALYTICS_API_URL || 'http://localhost:8000/api/analytics/resumen/'

export default function DashboardView() {
  const [readings, setReadings] = useState([])
  const [analytics, setAnalytics] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true

    async function loadReadings() {
      const { data } = await supabase
        .from('energy_readings')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100)

      if (active && data) {
        setReadings(data)
      }
      if (active) setLoading(false)
    }

    async function loadAnalytics() {
      try {
        const response = await fetch(ANALYTICS_URL)
        if (!response.ok) return
        const data = await response.json()
        if (active) setAnalytics(data)
      } catch {
        if (active) setAnalytics(null)
      }
    }

    loadReadings()
    loadAnalytics()

    const channel = supabase
      .channel('energy_readings_changes')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'energy_readings' },
        (payload) => {
          setReadings((prev) => [payload.new, ...prev].slice(0, 100))
          loadAnalytics()
        },
      )
      .subscribe()

    return () => {
      active = false
      supabase.removeChannel(channel)
    }
  }, [])

  const chartData = useMemo(() => {
    return [...readings]
      .reverse()
      .map((item) => ({
        timestamp: new Date(item.created_at).toLocaleTimeString(),
        device_name: item.device_name,
        consumption_kwh: Number(item.consumption_kwh),
      }))
  }, [readings])

  const deviceTotals = useMemo(() => {
    const map = new Map()

    for (const reading of readings) {
      const key = reading.device_name
      const current = map.get(key) || 0
      map.set(key, current + Number(reading.consumption_kwh))
    }

    return [...map.entries()].map(([device, total]) => ({ device, total: Number(total.toFixed(2)) }))
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

      {analytics && (
        <section className="card metrics-grid">
          <article>
            <h3>Promedio kWh</h3>
            <p>{analytics.promedio ? Number(analytics.promedio).toFixed(2) : 'N/A'}</p>
          </article>
          <article>
            <h3>Pico kWh</h3>
            <p>{analytics.pico ? Number(analytics.pico).toFixed(2) : 'N/A'}</p>
          </article>
          <article>
            <h3>Alerta</h3>
            <p>{analytics.alerta_consumo_alto ? 'Consumo alto' : 'Normal'}</p>
          </article>
        </section>
      )}

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
                <Line type="monotone" dataKey="consumption_kwh" stroke="#177245" name="kWh" />
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
