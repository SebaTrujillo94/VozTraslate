// ********************************************************************************
// ChannelDashboard.jsx — Esta es la pantalla principal que ves al entrar
// Aquí puedes ver los canales, crearlos o unirte a uno que ya exista.
// ********************************************************************************

import { useState, useEffect } from 'react';
import CreateChannelModal from './CreateChannelModal';
import JoinChannelView    from './JoinChannelView';
import { socket }         from '../services/socket';
import './ChannelDashboard.css';

export default function ChannelDashboard({ profile, onCerrarSesion }) {
  // Aquí guardamos en qué pantalla estamos: 'home', 'crear' o 'unirse'
  const [vista, setVista] = useState('home');

  // Aquí guardamos cuántos canales hay y la lista completa que nos manda el servidor
  const [totalCanales, setTotalCanales] = useState(0);
  const [listaCanales, setListaCanales] = useState([]);
  const [codigoUnirse, setCodigoUnirse] = useState(null);

  // ── Esto corre apenas abres la página para conectarse al servidor ───────────
  useEffect(() => {
    if (!socket.connected) socket.connect();
    socket.emit('get-stats'); // Le pedimos al servidor que nos diga qué hay de nuevo

    // Cuando el servidor nos responde con la lista de canales, la guardamos aquí
    const manejarStats = ({ totalCanales, listaCanales = [] }) => {
      setTotalCanales(totalCanales);
      setListaCanales(listaCanales);
    };

    socket.on('stats-update', manejarStats);

    // Si cerramos esta pantalla, dejamos de escuchar para no gastar memoria
    return () => {
      socket.off('stats-update', manejarStats);
    };
  }, []);

  const nombreMostrar = profile?.displayName || profile?.username || 'Usuario';

  // ── Vista: usuario en la pantalla de unirse / chat ────────────────────────
  if (vista === 'unirse') {
    return (
      <div className="dashboard-wrapper">
        <JoinChannelView
          profile={profile}
          codigoAutoJoin={codigoUnirse}
          onVolver={() => {
            setCodigoUnirse(null);
            setVista('home');
          }}
        />
      </div>
    );
  }

  // ── Vista: pantalla de inicio ─────────────────────────────────────────────
  return (
    <div className="dashboard-wrapper">

      {/* Encabezado con saludo y contador de canales activos */}
      <div className="dashboard-header">
        <h1>Hola, {nombreMostrar} 👋</h1>
        <p>¿Qué quieres hacer hoy en VozTranslate?</p>

        {/* Banner de canales activos: se muestra cuando hay al menos uno */}
        <div className="stats-banner">
          <span className="stats-dot" />
          <span>
            {totalCanales === 0
              ? 'No hay canales abiertos aún'
              : totalCanales === 1
                ? '1 canal abierto en este momento'
                : `${totalCanales} canales abiertos en este momento`}
          </span>
        </div>
      </div>

      {/* Sección Lista de Canales MVP */}
      {listaCanales.length > 0 && (
        <div className="active-channels-section">
          <h3 className="section-title">Canales Públicos ({listaCanales.length}/2)</h3>
          <div className="channels-grid">
            {listaCanales.map(ct => (
              <div key={ct.codigo} className="channel-box" onClick={() => {
                setCodigoUnirse(ct.codigo);
                setVista('unirse');
              }}>
                <div className="channel-box-header">
                  <span className="channel-box-lang" title="Idioma Base">{ct.idioma.toUpperCase()}</span>
                  <span className="channel-box-title">{ct.nombre}</span>
                </div>
                <div className="channel-box-body">
                  <p>Código: <span className="channel-code-badge">{ct.codigo}</span></p>
                  <p className="channel-creator-text">👤 {ct.creador}</p>
                </div>
                {ct.creador === profile.username && (
                  <button 
                    className="btn-delete-channel" 
                    onClick={(e) => {
                      e.stopPropagation(); // Evitar unirse al querer borrarlo
                      socket.emit('delete-channel', ct.codigo);
                    }}
                    title="Borrar canal MVP"
                  >
                    🗑️
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tarjetas de acción */}
      <div className="dashboard-cards">

        <div
          className="action-card"
          onClick={() => setVista('crear')}
          role="button"
          tabIndex={0}
          aria-label="Crear un nuevo canal privado"
          onKeyDown={(e) => e.key === 'Enter' && setVista('crear')}
        >
          <span className="card-icon">✨</span>
          <h2>Crear Canal</h2>
          <p>Inicia un nuevo canal privado y comparte el código con quien quieras.</p>
          <span className="badge-free">Hasta 2 canales gratis</span>
        </div>

        <div
          className="action-card"
          onClick={() => setVista('unirse')}
          role="button"
          tabIndex={0}
          aria-label="Unirse a un canal existente con código"
          onKeyDown={(e) => e.key === 'Enter' && setVista('unirse')}
        >
          <span className="card-icon">🔗</span>
          <h2>Unirse a Canal</h2>
          <p>Ingresa el código de invitación que te compartieron para entrar.</p>
        </div>

      </div>

      <button className="btn-logout" onClick={onCerrarSesion}>
        <span>👤</span>
        <span>Cerrar sesión</span>
      </button>

      {/* Modal para crear un canal (se pone encima de todo) */}
      {vista === 'crear' && (
        <CreateChannelModal
          profile={profile}
          onCerrar={() => setVista('home')}
        />
      )}

    </div>
  );
}
