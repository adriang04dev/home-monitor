import { useState } from 'react'
import { supabase } from '../supabaseClient'

const MODES = {
  login: 'login',
  signup: 'signup',
}

function formatAuthError(error, mode) {
  const message = error?.message || ''
  const status = error?.status
  const isRateLimit = status === 429 || /rate limit|too many requests/i.test(message)

  if (isRateLimit && mode === MODES.signup) {
    return 'Limite de registro alcanzado temporalmente (429). Espera unos minutos y usa Iniciar sesion si la cuenta ya fue creada.'
  }

  return message || 'No se pudo completar la accion.'
}

export default function Login() {
  const [mode, setMode] = useState(MODES.login)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [role, setRole] = useState('device')
  const [deviceName, setDeviceName] = useState('')
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)

  async function handleSubmit(event) {
    event.preventDefault()
    setBusy(true)
    setMessage('')

    try {
      if (mode === MODES.login) {
        const { error } = await supabase.auth.signInWithPassword({ email, password })
        if (error) throw error
        setMessage('Inicio de sesion correcto.')
      } else {
        const { data, error } = await supabase.auth.signUp({ email, password })
        if (error) throw error

        if (data.user) {
          const { error: profileError } = await supabase.from('profiles').insert({
            id: data.user.id,
            role,
            device_name: role === 'device' ? deviceName : null,
          })

          if (profileError) {
            throw profileError
          }
        }

        setMessage('Registro completado. Inicia sesion para continuar.')
        setMode(MODES.login)
      }
    } catch (error) {
      const friendlyError = formatAuthError(error, mode)
      setMessage(friendlyError)

      if (/Limite de registro/i.test(friendlyError)) {
        setMode(MODES.login)
      }
    } finally {
      setBusy(false)
    }
  }

  return (
    <main className="page auth-page">
      <div className="card auth-card">
        <h1>EnergyMonitor</h1>
        <p className="subtitle">Autenticacion por rol para simulador IoT domestico.</p>

        <div className="switcher" role="tablist" aria-label="Modo de autenticacion">
          <button
            type="button"
            className={mode === MODES.login ? 'active' : ''}
            onClick={() => setMode(MODES.login)}
          >
            Iniciar sesion
          </button>
          <button
            type="button"
            className={mode === MODES.signup ? 'active' : ''}
            onClick={() => setMode(MODES.signup)}
          >
            Registrarme
          </button>
        </div>

        <form onSubmit={handleSubmit} className="form-grid">
          <label>
            Correo
            <input
              required
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="tu-correo@ejemplo.com"
            />
          </label>

          <label>
            Contrasena
            <input
              required
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="********"
            />
          </label>

          {mode === MODES.signup && (
            <>
              <label>
                Rol
                <select value={role} onChange={(event) => setRole(event.target.value)}>
                  <option value="device">device</option>
                  <option value="dashboard">dashboard</option>
                </select>
              </label>

              {role === 'device' && (
                <label>
                  Nombre del dispositivo
                  <input
                    required
                    value={deviceName}
                    onChange={(event) => setDeviceName(event.target.value)}
                    placeholder="Cocina / Lavadora / Medidor Sala"
                  />
                </label>
              )}
            </>
          )}

          <button className="primary" type="submit" disabled={busy}>
            {busy ? 'Procesando...' : mode === MODES.login ? 'Entrar' : 'Crear cuenta'}
          </button>
        </form>

        {message && <p className="status">{message}</p>}
      </div>
    </main>
  )
}
