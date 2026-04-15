// ──────────────────────────────────────────────────────────────────────────────
// ChannelDashboard.jsx — Pantalla principal después del login (Épica 02)
//
// Muestra cuántos canales están abiertos en el servidor (en tiempo real)
// y permite crear un canal nuevo o unirse a uno existente.
// ──────────────────────────────────────────────────────────────────────────────

import { useState, useEffect } from 'react';
import CreateChannelModal from './CreateChannelModal';
import JoinChannelView    from './JoinChannelView';
import { socket }         from '../services/socket';
import './ChannelDashboard.css';

export default function ChannelDashboard({ profile, onCerrarSesion }) {
  // Controla qué vista se muestra: 'home' | 'crear' | 'unirse'
  const [vista, setVista] = useState('home');

  // Número total de canales activos en el servidor
  const [totalCanales, setTotalCanales] = useState(0);

  // ── Obtener estadísticas al montar y escuchar actualizaciones ─────────────
  useEffect(() => {
    // Al conectarse, el servidor ya envía 'stats-update' automáticamente.
    // Por si acaso lo pedimos explícitamente también.
    if (!socket.connected) socket.connect();
    socket.emit('get-stats');

    // Cuando el servidor avisa que el total de canales cambió, actualizamos
    const manejarStats = ({ totalCanales }) => {
      setTotalCanales(totalCanales);
    };

    socket.on('stats-update', manejarStats);

    // Cleanup al desmontar
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
          onVolver={() => setVista('home')}
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

      {/* Modal de creación (se superpone al dashboard) */}
      {vista === 'crear' && (
        <CreateChannelModal
          profile={profile}
          onCerrar={() => setVista('home')}
        />
      )}

    </div>
  );
}
