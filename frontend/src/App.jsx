import { useEffect, useMemo, useState } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { supabase } from './supabaseClient'
import DashboardView from './pages/DashboardView'
import DeviceView from './pages/DeviceView'
import Login from './pages/Login'

function App() {
  const [session, setSession] = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)
  const [profileLoading, setProfileLoading] = useState(false)
  const [profileError, setProfileError] = useState('')

  useEffect(() => {
    let isMounted = true

    supabase.auth.getSession().then(({ data }) => {
      if (!isMounted) return
      setSession(data.session)
      setLoading(false)
    })

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, currentSession) => {
      setSession(currentSession)
      if (!currentSession) {
        setProfile(null)
        setProfileError('')
        setProfileLoading(false)
      }
    })

    return () => {
      isMounted = false
      subscription.unsubscribe()
    }
  }, [])

  useEffect(() => {
    async function loadProfile(userId) {
      setProfileLoading(true)
      setProfileError('')

      const { data, error } = await supabase
        .from('profiles')
        .select('id, role, device_name')
        .eq('id', userId)
        .maybeSingle()

      if (error) {
        setProfile(null)
        setProfileError(error.message || 'No se pudo cargar el perfil.')
        setProfileLoading(false)
        return
      }

      if (!data) {
        setProfile(null)
        setProfileError('No existe perfil para este usuario en la tabla profiles.')
        setProfileLoading(false)
        return
      }

      setProfile(data)
      setProfileLoading(false)
    }

    if (session?.user?.id) {
      loadProfile(session.user.id)
    } else {
      setProfile(null)
      setProfileLoading(false)
      setProfileError('')
    }
  }, [session?.user?.id])

  const landingPath = useMemo(() => {
    if (!session) return '/login'
    if (profile?.role === 'dashboard') return '/dashboard'
    return '/device'
  }, [profile?.role, session])

  if (loading) {
    return <div className="page center">Cargando sesion...</div>
  }

  return (
    <Routes>
      <Route
        path="/login"
        element={session ? <Navigate to={landingPath} replace /> : <Login />}
      />
      <Route
        path="/device"
        element={
          <RoleGate
            session={session}
            profile={profile}
            role="device"
            profileLoading={profileLoading}
            profileError={profileError}
            onProfileCreated={setProfile}
          >
            <DeviceView user={session?.user} profile={profile} />
          </RoleGate>
        }
      />
      <Route
        path="/dashboard"
        element={
          <RoleGate
            session={session}
            profile={profile}
            role="dashboard"
            profileLoading={profileLoading}
            profileError={profileError}
            onProfileCreated={setProfile}
          >
            <DashboardView user={session?.user} />
          </RoleGate>
        }
      />
      <Route path="*" element={<Navigate to={landingPath} replace />} />
    </Routes>
  )
}

function RoleGate({ session, profile, role, profileLoading, profileError, onProfileCreated, children }) {
  const [selectedRole, setSelectedRole] = useState('device')
  const [deviceName, setDeviceName] = useState('')
  const [creatingProfile, setCreatingProfile] = useState(false)
  const [createMessage, setCreateMessage] = useState('')

  if (!session) {
    return <Navigate to="/login" replace />
  }

  if (profileLoading) {
    return <div className="page center">Cargando perfil...</div>
  }

  if (!profile) {
    async function crearPerfil() {
      setCreatingProfile(true)
      setCreateMessage('')

      const payload = {
        id: session.user.id,
        role: selectedRole,
        device_name: selectedRole === 'device' ? deviceName || 'Mi dispositivo' : null,
      }

      const { data, error } = await supabase
        .from('profiles')
        .insert(payload)
        .select('id, role, device_name')
        .single()

      if (error) {
        setCreateMessage(error.message || 'No se pudo crear el perfil.')
        setCreatingProfile(false)
        return
      }

      onProfileCreated(data)
      setCreatingProfile(false)
    }

    return (
      <main className="page center">
        <section className="card" style={{ maxWidth: '560px' }}>
          <h2>Perfil no disponible</h2>
          <p className="subtitle">
            No se encontro tu fila en la tabla profiles o hubo un error al consultarla.
          </p>
          {profileError && <p className="status">Detalle: {profileError}</p>}
          <p className="subtitle">Puedes crear el perfil aqui y continuar sin salir.</p>

          <div className="form-grid" style={{ marginTop: '0.8rem' }}>
            <label>
              Rol
              <select value={selectedRole} onChange={(event) => setSelectedRole(event.target.value)}>
                <option value="device">device</option>
                <option value="dashboard">dashboard</option>
              </select>
            </label>

            {selectedRole === 'device' && (
              <label>
                Nombre del dispositivo
                <input
                  value={deviceName}
                  onChange={(event) => setDeviceName(event.target.value)}
                  placeholder="Medidor cocina"
                />
              </label>
            )}

            <button className="primary" type="button" disabled={creatingProfile} onClick={crearPerfil}>
              {creatingProfile ? 'Creando perfil...' : 'Crear perfil y continuar'}
            </button>
          </div>

          {createMessage && <p className="status">{createMessage}</p>}

          <button style={{ marginTop: '0.8rem' }} type="button" onClick={() => supabase.auth.signOut()}>
            Cerrar sesion
          </button>
        </section>
      </main>
    )
  }

  if (profile.role !== role) {
    return <Navigate to={profile.role === 'dashboard' ? '/dashboard' : '/device'} replace />
  }

  return children
}

export default App
