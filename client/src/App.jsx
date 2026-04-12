import { useState, useEffect } from 'react';
import LoginScreen from './components/LoginScreen';
import { getToken, clearToken, getMe } from './services/api';
import './App.css';

export default function App() {
  // el tema de color
  const [theme, setTheme] = useState(() => localStorage.getItem('voxbridge_theme') || 'dark');
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('voxbridge_theme', theme);
  }, [theme]);
  const toggleTheme = () => setTheme(t => t === 'dark' ? 'light' : 'dark');

  // estado del usuario y sesion
  const [profile, setProfile] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);

  // al iniciar vemos si hay token para no pedir login de nuevo
  useEffect(() => {
    const token = getToken();
    if (token) {
      getMe()
        .then((data) => {
          const user = data.user;
          setProfile({
            id: user.id,
            email: user.email,
            username: user.username,
            displayName: user.displayName,
            language: user.preferredLanguage || 'en',
            avatarUrl: user.avatarUrl,
          });
        })
        .catch(() => {
          clearToken();
        })
        .finally(() => setAuthLoading(false));
    } else {
      setAuthLoading(false);
    }
  }, []);

  // funcion que se llama cuando se logra loguear
  const handleLogin = (p) => {
    setProfile({
      id: p.id,
      email: p.email,
      username: p.username,
      displayName: p.displayName,
      language: p.preferredLanguage || p.language || 'en',
      avatarUrl: p.avatarUrl,
    });
  };

  // cerrar sesion y borrar token
  const handleLogout = () => {
    clearToken();
    setProfile(null);
  };

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

  const showLogin = !profile;

  return (
    <div className="app" data-theme={theme}>

      <button className="global-theme-toggle" onClick={toggleTheme} title="Cambiar tema">
        {theme === 'dark' ? '☀️' : '🌙'}
      </button>

      {showLogin && <LoginScreen onLogin={handleLogin} />}
      
      {profile && (
         <div style={{ 
            display: 'flex', 
            flexDirection: 'column', 
            alignItems: 'center', 
            justifyContent: 'center', 
            height: '100vh', 
            zIndex: 10, 
            position: 'relative',
            color: 'var(--text-main)'
          }}>
            <h2 style={{ fontSize: '2rem', marginBottom: '10px' }}>✅ Registro y Login Correcto</h2>
            <p style={{ fontSize: '1.2rem', color: '#a78bfa' }}>Te has registrado y accedido correctamente.</p>
            <button 
              onClick={handleLogout} 
              style={{
                marginTop: '30px', 
                padding: '12px 24px', 
                background: 'linear-gradient(90deg, #7c3aed, #3b82f6)', 
                border: 'none', 
                borderRadius: '8px', 
                color: 'white', 
                cursor: 'pointer',
                fontWeight: 'bold'
              }}>
              Cerrar Sesión
            </button>
         </div>
      )}
    </div>
  );
}
