import { useState, useEffect } from 'react';
import LoginScreen      from './components/LoginScreen';
import ChannelDashboard from './components/ChannelDashboard';
import { getToken, clearToken, getMe } from './services/api';
import './App.css';

export default function App() {
  // ── Tema de color (oscuro / claro) ───────────────────────────────────────
  // Leemos el tema guardado en localStorage al iniciar; si no hay ninguno, usamos oscuro.
  const [theme, setTheme] = useState(
    () => localStorage.getItem('voxbridge_theme') || 'dark'
  );

  useEffect(() => {
    // Aplicamos el atributo al <html> para que los estilos CSS lo detecten
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('voxbridge_theme', theme);
  }, [theme]);

  const toggleTheme = () => setTheme((t) => (t === 'dark' ? 'light' : 'dark'));

  // ── Estado del usuario autenticado ────────────────────────────────────────
  const [profile, setProfile]       = useState(null);
  const [authLoading, setAuthLoading] = useState(true);

  // Al cargar la página, verificamos si hay una sesión activa en LocalStorage
  useEffect(() => {
    const token = getToken();
    if (token) {
      getMe()
        .then((data) => {
          const user = data.user;
          setProfile({
            id:          user.id,
            email:       user.email,
            username:    user.username,
            displayName: user.displayName,
            language:    user.preferredLanguage || 'en',
            avatarUrl:   user.avatarUrl,
          });
        })
        .catch(() => {
          // Si el token no es válido, lo borramos y mostramos el login
          clearToken();
        })
        .finally(() => setAuthLoading(false));
    } else {
      setAuthLoading(false);
    }
  }, []);

  // Función que se ejecuta cuando el usuario termina de loguearse
  const handleLogin = (p) => {
    setProfile({
      id:          p.id,
      email:       p.email,
      username:    p.username,
      displayName: p.displayName,
      language:    p.preferredLanguage || p.language || 'en',
      avatarUrl:   p.avatarUrl,
    });
  };

  // Función para cerrar sesión: borramos el token y limpiamos el estado
  const handleLogout = () => {
    clearToken();
    setProfile(null);
  };

  // ── Pantalla de carga inicial ─────────────────────────────────────────────
  // Se muestra brevemente mientras verificamos si existe una sesión guardada
  if (authLoading) {
    return (
      <div className="app" data-theme={theme}>
        <div style={{
          display: 'flex', justifyContent: 'center', alignItems: 'center',
          minHeight: '100vh', color: 'var(--text-muted)', fontSize: '0.9rem',
        }}>
          <div style={{ textAlign: 'center' }}>Cargando sesión...</div>
        </div>
      </div>
    );
  }

  // ── Render principal ───────────────────────────────────────────────────────
  return (
    <div className="app" data-theme={theme}>

      {/* Botón flotante para cambiar entre tema oscuro y claro */}
      <button className="global-theme-toggle" onClick={toggleTheme} title="Cambiar tema">
        {theme === 'dark' ? '☀️' : '🌙'}
      </button>

      {/* Si no hay sesión activa, mostramos el formulario de login/registro */}
      {!profile && <LoginScreen onLogin={handleLogin} />}

      {/* Si hay sesión activa, mostramos el dashboard de canales (Épica 02) */}
      {profile && (
        <ChannelDashboard
          profile={profile}
          onCerrarSesion={handleLogout}
        />
      )}

    </div>
  );
}
