import { useState } from 'react'
import { supabase } from '../supabaseClient'

export default function DeviceView({ user, profile }) {
  const [kwh, setKwh] = useState('')
  const [voltage, setVoltage] = useState('')
  const [amps, setAmps] = useState('')
  const [notes, setNotes] = useState('')
  const [status, setStatus] = useState('')
  const [busy, setBusy] = useState(false)

  async function enviarConsumo(event) {
    event.preventDefault()
    setBusy(true)
    setStatus('')

    const voltageValue = Number.parseFloat(voltage)
    const ampsValue = Number.parseFloat(amps)
    const payload = {
      dispositivo: profile?.device_name || 'dispositivo-sin-nombre',
      corriente_a: ampsValue,
      voltaje_v: voltageValue,
      potencia_w: voltageValue * ampsValue,
      energia_kwh: Number.parseFloat(kwh),
      estado: notes || 'normal',
    }

    const { error } = await supabase.from('mediciones').insert(payload)

    if (error) {
      setStatus(error.message)
    } else {
      setStatus('Lectura enviada correctamente.')
      setKwh('')
      setVoltage('')
      setAmps('')
      setNotes('')
    }

    setBusy(false)
  }

  async function cerrarSesion() {
    await supabase.auth.signOut()
  }

  return (
    <main className="page">
      <header className="topbar">
        <div>
          <h1>Panel Device</h1>
          <p className="subtitle">Dispositivo: {profile?.device_name || 'sin nombre'}</p>
        </div>
        <button type="button" onClick={cerrarSesion}>
          Cerrar sesion
        </button>
      </header>

      <section className="card">
        <h2>Enviar consumo</h2>
        <form className="form-grid" onSubmit={enviarConsumo}>
          <label>
            Consumo (kWh)
            <input
              required
              type="number"
              min="0"
              step="0.01"
              value={kwh}
              onChange={(event) => setKwh(event.target.value)}
            />
          </label>

          <label>
            Voltaje
            <input
              required
              type="number"
              min="0"
              step="0.01"
              value={voltage}
              onChange={(event) => setVoltage(event.target.value)}
            />
          </label>

          <label>
            Corriente (A)
            <input
              required
              type="number"
              min="0"
              step="0.01"
              value={amps}
              onChange={(event) => setAmps(event.target.value)}
            />
          </label>

          <label>
            Notas
            <textarea
              rows="4"
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              placeholder="Ejemplo: Lavadora en ciclo completo"
            />
          </label>

          <button className="primary" type="submit" disabled={busy}>
            {busy ? 'Enviando...' : 'Enviar lectura'}
          </button>
        </form>

        {status && <p className="status">{status}</p>}
      </section>
    </main>
  )
}
