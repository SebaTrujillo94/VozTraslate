import { useState, useEffect } from 'react';
import {
  Globe, Lock, Plus, LogIn, LogOut, UserCog,
  Trash2, ChevronRight, Users, ShieldCheck,
} from 'lucide-react';
import CreateChannelModal from './CreateChannelModal';
import JoinChannelView    from './JoinChannelView';
import EditProfileModal   from './EditProfileModal';
import { socket }         from '../services/socket';
import './ChannelDashboard.css';

const LANG_FLAGS = { es:'🇪🇸', en:'🇺🇸', pt:'🇧🇷', fr:'🇫🇷', de:'🇩🇪', it:'🇮🇹', zh:'🇨🇳', ja:'🇯🇵' };

export default function ChannelDashboard({ profile, onCerrarSesion, onUpdateProfile }) {
  const [vista, setVista]           = useState('home');
  const [totalCanales, setTotal]    = useState(0);
  const [listaCanales, setLista]    = useState([]);
  const [codigoUnirse, setCodigo]   = useState(null);
  const [showEditProfile, setShowEdit] = useState(false);

  useEffect(() => {
    if (!socket.connected) socket.connect();
    socket.emit('get-stats');
    const fn = ({ totalCanales, listaCanales = [] }) => {
      setTotal(totalCanales);
      setLista(listaCanales);
    };
    socket.on('stats-update', fn);
    return () => socket.off('stats-update', fn);
  }, []);

  // Browser back cierra el modal "Crear Canal"
  useEffect(() => {
    if (vista !== 'crear') return;
    window.history.pushState({ _nav: 'crear' }, '');
    const handler = () => setVista('home');
    window.addEventListener('popstate', handler);
    return () => window.removeEventListener('popstate', handler);
  }, [vista]);

  const nombreMostrar = profile?.displayName || profile?.username || 'Usuario';

  const canalesPublicos  = listaCanales.filter(c => c.tipo !== 'private');
  const misPrivados      = listaCanales.filter(c => c.tipo === 'private' && c.creador === profile.username);

  const entrar = (codigo) => { setCodigo(codigo); setVista('unirse'); };

  if (vista === 'unirse') {
    return (
      <div className="dashboard-wrapper">
        <JoinChannelView
          profile={profile}
          codigoAutoJoin={codigoUnirse}
          onVolver={() => { setCodigo(null); setVista('home'); }}
        />
      </div>
    );
  }

  return (
    <div className="dashboard-wrapper">

      {/* ── Encabezado ─────────────────────────────────────────────── */}
      <div className="dashboard-header">
        <div className="dashboard-greeting">
          <div className="greeting-avatar">
            {profile.avatarUrl
              ? <img src={profile.avatarUrl} alt="avatar" />
              : <span>{(nombreMostrar)[0].toUpperCase()}</span>}
          </div>
          <div>
            <h1>Hola, {nombreMostrar}</h1>
            <p>¿A qué canal entras hoy?</p>
          </div>
        </div>

        <div className="stats-banner">
          <span className="stats-dot" />
          <span>
            {totalCanales === 0
              ? 'Sin canales activos'
              : `${totalCanales} canal${totalCanales !== 1 ? 'es' : ''} activo${totalCanales !== 1 ? 's' : ''}`}
          </span>
        </div>
      </div>

      {/* ── Canal Público (plataforma) ──────────────────────────────── */}
      <div className="channels-section">
        <div className="section-header">
          <Globe size={13} />
          <span>Canal Público</span>
          <span className="section-tag platform"><ShieldCheck size={10} /> Plataforma</span>
        </div>

        {canalesPublicos.length === 0 ? (
          <div className="channel-card public skeleton">
            <div className="skeleton-line w60" />
            <div className="skeleton-line w40" />
          </div>
        ) : canalesPublicos.map(ct => (
          <div key={ct.codigo} className="channel-card public" onClick={() => entrar(ct.codigo)}>
            <div className="channel-card-left">
              <div className="channel-card-icon public-icon">
                <Globe size={18} />
              </div>
              <div className="channel-card-info">
                <span className="channel-card-name">{ct.nombre}</span>
                <span className="channel-card-meta">
                  <span className="lang-flag">{LANG_FLAGS[ct.idioma] || '🌐'}</span>
                  {ct.idioma.toUpperCase()} · Abierto a todos
                </span>
              </div>
            </div>
            <div className="channel-card-right">
              <span className="channel-card-enter">
                Entrar <ChevronRight size={14} />
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* ── Mis Canales Privados ────────────────────────────────────── */}
      <div className="channels-section">
        <div className="section-header">
          <Lock size={13} />
          <span>Mis Canales Privados</span>
          <span className="section-tag">{misPrivados.length}/2</span>
        </div>

        <div className="private-grid">
          {misPrivados.map(ct => (
            <div key={ct.codigo} className="channel-card private" onClick={() => entrar(ct.codigo)}>
              <button
                className="btn-delete-channel"
                onClick={(e) => { e.stopPropagation(); socket.emit('delete-channel', ct.codigo); }}
                title="Eliminar canal"
              >
                <Trash2 size={13} />
              </button>
              <div className="private-card-icon">
                <Lock size={16} />
              </div>
              <span className="channel-card-name">{ct.nombre}</span>
              <div className="private-card-meta">
                <span className="lang-flag">{LANG_FLAGS[ct.idioma] || '🌐'}</span>
                <code className="private-code">{ct.codigo}</code>
              </div>
            </div>
          ))}

          {/* Slot vacío para crear nuevo canal */}
          {misPrivados.length < 2 && (
            <div className="channel-card private new-channel" onClick={() => setVista('crear')}>
              <div className="new-channel-inner">
                <Plus size={22} />
                <span>Nuevo canal</span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Unirse con código ──────────────────────────────────────── */}
      <button className="join-code-strip" onClick={() => setVista('unirse')}>
        <div className="join-code-strip-left">
          <div className="join-code-icon"><LogIn size={16} /></div>
          <div>
            <span className="join-code-title">Unirse con código</span>
            <span className="join-code-sub">Entra a un canal privado con tu código de invitación</span>
          </div>
        </div>
        <ChevronRight size={16} className="join-code-arrow" />
      </button>

      {/* ── Acciones de usuario ────────────────────────────────────── */}
      <div className="dashboard-user-actions">
        <button className="btn-edit-profile" onClick={() => setShowEdit(true)}>
          <UserCog size={15} />
          <span>Editar perfil</span>
        </button>
        <button className="btn-logout" onClick={onCerrarSesion}>
          <LogOut size={15} />
          <span>Cerrar sesión</span>
        </button>
      </div>

      {vista === 'crear' && (
        <CreateChannelModal profile={profile} onCerrar={() => setVista('home')} />
      )}
      {showEditProfile && (
        <EditProfileModal
          profile={profile}
          onClose={() => setShowEdit(false)}
          onSave={onUpdateProfile}
        />
      )}
    </div>
  );
}
