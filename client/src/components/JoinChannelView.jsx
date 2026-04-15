// ──────────────────────────────────────────────────────────────────────────────
// JoinChannelView.jsx — Vista para unirse a un canal existente (HU-05)
//
// Funcionalidades incluidas:
//   - Formulario con código + validación en tiempo real
//   - Chat con historial, mensajes en tiempo real y auto-scroll
//   - Código del canal visible en la barra superior
//   - Indicador de conexión de otras personas (online / esperando)
//   - Contador de personas en el canal + banderas de idioma por usuario
// ──────────────────────────────────────────────────────────────────────────────

import { useState, useEffect, useRef } from 'react';
import { socket } from '../services/socket';

// ── Tabla de idioma → emoji bandera ──────────────────────────────────────────
// Usamos emojis Unicode de banderas para que funcionen sin imágenes externas.
// Si el idioma no está en la tabla, se muestra la bandera blanca como fallback.
const BANDERAS = {
  es: '🇪🇸',
  en: '🇺🇸',
  pt: '🇧🇷',
  fr: '🇫🇷',
  de: '🇩🇪',
  it: '🇮🇹',
  zh: '🇨🇳',
  ja: '🇯🇵',
};

// Función auxiliar: dado un código de idioma, devuelve el emoji de la bandera
function obtenerBandera(idioma) {
  return BANDERAS[idioma] || '🏳️';
}

// ── Componente principal ──────────────────────────────────────────────────────
// Props recibidas:
//   profile  → objeto del usuario autenticado (username, language, etc.)
//   onVolver → función para volver al dashboard
export default function JoinChannelView({ profile, onVolver }) {
  // Código que el usuario escribe en el formulario
  const [codigo, setCodigo] = useState('');

  // Estado de la UI del formulario de acceso
  const [cargando, setCargando] = useState(false);
  const [error, setError]       = useState('');

  // Info del canal al que el usuario se unió exitosamente
  const [canal, setCanal] = useState(null);

  // Lista de mensajes del chat: historial + en tiempo real
  // Cada elemento tiene: { username, idioma, texto, timestamp, tipo }
  const [mensajes, setMensajes] = useState([]);

  // Lista de miembros actualmente conectados en el canal
  // Cada elemento tiene: { username, idioma }
  const [miembrosConectados, setMiembrosConectados] = useState([]);

  // Texto que el usuario está escribiendo en el chat
  const [textoMensaje, setTextoMensaje] = useState('');

  // Referencia para el auto-scroll al final de la lista de mensajes
  const finListaRef = useRef(null);

  // ── Auto-scroll cuando llega un mensaje nuevo ─────────────────────────────
  useEffect(() => {
    finListaRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [mensajes]);

  // ── Registrar todos los listeners de Socket.io ────────────────────────────
  useEffect(() => {
    // Respuesta al evento 'join-channel-by-code'
    const manejarUnirse = (respuesta) => {
      setCargando(false);
      if (respuesta.exito) {
        setCanal(respuesta.canal);
        // Formatear el historial previo del canal (ya vienen con idioma desde el server)
        const historialFormateado = respuesta.historial.map((m) => ({
          ...m,
          tipo: 'mensaje',
        }));
        setMensajes(historialFormateado);
      } else {
        setError(respuesta.error);
      }
    };

    // Otro usuario se une: mostrar mensaje de sistema en el chat
    const manejarNuevoMiembro = ({ username, mensaje, timestamp }) => {
      setMensajes((prev) => [
        ...prev,
        { tipo: 'sistema', texto: mensaje, timestamp },
      ]);
    };

    // Otro usuario se va: mostrar mensaje de sistema en el chat
    const manejarSalidaMiembro = ({ username, mensaje, timestamp }) => {
      setMensajes((prev) => [
        ...prev,
        { tipo: 'sistema', texto: mensaje, timestamp },
      ]);
    };

    // El servidor envía la lista actualizada de miembros (con idiomas)
    const manejarActualizacionMiembros = ({ miembros, totalConectados }) => {
      setMiembrosConectados(miembros); // miembros = [{ username, idioma }, ...]
    };

    // Nuevo mensaje de chat en tiempo real
    const manejarNuevoMensaje = (msg) => {
      setMensajes((prev) => [...prev, { ...msg, tipo: 'mensaje' }]);
    };

    // Registrar todos los listeners
    socket.on('join-channel-response',  manejarUnirse);
    socket.on('user-joined-notify',     manejarNuevoMiembro);
    socket.on('user-left-notify',       manejarSalidaMiembro);
    socket.on('canal-miembros-update',  manejarActualizacionMiembros);
    socket.on('new-message',            manejarNuevoMensaje);

    // Cleanup: quitar los listeners al desmontar el componente
    return () => {
      socket.off('join-channel-response',  manejarUnirse);
      socket.off('user-joined-notify',     manejarNuevoMiembro);
      socket.off('user-left-notify',       manejarSalidaMiembro);
      socket.off('canal-miembros-update',  manejarActualizacionMiembros);
      socket.off('new-message',            manejarNuevoMensaje);
    };
  }, []);

  // ── Validación del código en tiempo real ──────────────────────────────────
  const codigoValido = /^[A-Z0-9]{3}-[A-Z0-9]{4}$/.test(codigo.toUpperCase());

  const estadoValidador =
    codigo.length === 0 ? 'empty'   :
    codigoValido        ? 'valid'   : 'invalid';

  // Solo letras mayúsculas, números y guión; auto-inserta el guión al tercer char
  const handleCambioCodigo = (e) => {
    let valor = e.target.value.toUpperCase().replace(/[^A-Z0-9-]/g, '');
    if (valor.length === 3 && !valor.includes('-')) valor = valor + '-';
    if (valor.length <= 8) setCodigo(valor);
  };

  // ── Enviar solicitud para unirse al canal ─────────────────────────────────
  const handleUnirse = (e) => {
    e.preventDefault();
    setError('');

    if (!codigoValido) {
      setError('El formato del código no es válido. Debe ser como: XJ9-4K2L');
      return;
    }

    setCargando(true);
    if (!socket.connected) socket.connect();

    // Enviamos también el idioma del usuario para que el servidor lo muestre a los demás
    socket.emit('join-channel-by-code', {
      codigo:   codigo.toUpperCase(),
      username: profile.username,
      idioma:   profile.language || 'en',
    });
  };

  // ── Enviar un mensaje de chat ─────────────────────────────────────────────
  const handleEnviarMensaje = (e) => {
    e.preventDefault();
    if (!textoMensaje.trim()) return;

    socket.emit('send-message', {
      codigo:   canal.codigo,
      username: profile.username,
      texto:    textoMensaje.trim(),
      idioma:   profile.language || 'en', // para mostrar la bandera en los mensajes
    });
    setTextoMensaje('');
  };

  // ── VISTA DE CHAT ─────────────────────────────────────────────────────────
  if (canal) {
    // Calcular personas en el canal excluyendo al usuario actual
    const otrosConectados = miembrosConectados.filter(
      (m) => m.username !== profile.username
    );
    const hayOtros        = otrosConectados.length > 0;
    const totalEnCanal    = miembrosConectados.length;

    return (
      <div className="channel-chat-view">

        {/* ── Barra superior ─────────────────────────────────────────────── */}
        <div className="chat-top-bar">
          <div className="chat-top-info">

            {/* Nombre del canal + idioma */}
            <div className="channel-name">
              <span>📺</span>
              <span>{canal.nombre}</span>
              <span className="channel-lang-badge">{canal.idioma.toUpperCase()}</span>
            </div>

            {/* Código del canal (para saber en qué sala estamos) */}
            <div className="channel-code-display">
              <span className="code-label">Código:</span>
              <span className="code-value">{canal.codigo}</span>
            </div>

          </div>

          {/* Lado derecho: contador + indicador de conexión + botón salir */}
          <div className="chat-top-right">

            {/* Contador de personas conectadas en el canal */}
            <div className="people-count-badge">
              <span className="people-icon">👥</span>
              <span className="people-number">{totalEnCanal}</span>
              <span className="people-label">
                {totalEnCanal === 1 ? 'persona' : 'personas'}
              </span>
            </div>

            {/* Indicador de si hay alguien más o estamos solos */}
            <div className={`connection-status ${hayOtros ? 'online' : 'solo'}`}>
              <span className="status-dot" />
              <span className="status-text">
                {hayOtros
                  ? `${otrosConectados.length} conectado${otrosConectados.length > 1 ? 's' : ''}`
                  : 'Esperando...'}
              </span>
            </div>

            <button className="btn-back" onClick={onVolver}>← Salir</button>
          </div>
        </div>

        {/* ── Barra de miembros: muestra cada usuario con su bandera ─────── */}
        {miembrosConectados.length > 0 && (
          <div className="members-bar">
            <span className="members-bar-label">
              En sala ({totalEnCanal}):
            </span>
            {miembrosConectados.map((m) => (
              <span
                key={m.username}
                className={`member-chip ${m.username === profile.username ? 'yo' : ''}`}
                title={`Idioma: ${m.idioma}`}
              >
                {/* Punto verde de presencia */}
                <span className="member-dot" />
                {/* Bandera del idioma del usuario */}
                <span className="member-flag" aria-label={`Idioma ${m.idioma}`}>
                  {obtenerBandera(m.idioma)}
                </span>
                {m.username === profile.username ? `${m.username} (tú)` : m.username}
              </span>
            ))}
          </div>
        )}

        {/* ── Lista de mensajes ────────────────────────────────────────────── */}
        <div className="messages-list">
          {mensajes.length === 0 && (
            <p className="msg-system">Aún no hay mensajes. ¡Sé el primero en escribir!</p>
          )}

          {mensajes.map((msg, indice) => {
            // Mensaje de sistema: entrada/salida de alguien
            if (msg.tipo === 'sistema') {
              return (
                <div key={indice} className="msg-system">
                  {msg.texto}
                </div>
              );
            }

            // Mensaje normal: ¿lo escribí yo o alguien más?
            const esMio    = msg.username === profile.username;
            const bandera  = obtenerBandera(msg.idioma || 'en');

            return (
              <div
                key={indice}
                className={`msg-bubble ${esMio ? 'propio' : 'ajeno'}`}
              >
                {/* Nombre + bandera (solo para mensajes de otros) */}
                {!esMio && (
                  <div className="msg-username">
                    <span className="msg-flag" aria-label={`Idioma ${msg.idioma}`}>
                      {bandera}
                    </span>
                    {msg.username}
                  </div>
                )}

                {/* Texto del mensaje */}
                <div className="msg-text">
                  {/* En mensajes propios, mostramos la bandera pequeña al inicio */}
                  {esMio && (
                    <span
                      className="msg-flag-own"
                      aria-label={`Tu idioma: ${msg.idioma}`}
                      title={`Tu idioma: ${msg.idioma}`}
                    >
                      {bandera}
                    </span>
                  )}
                  {msg.texto}
                </div>
              </div>
            );
          })}

          {/* Ancla para el auto-scroll */}
          <div ref={finListaRef} />
        </div>

        {/* ── Barra de escritura ────────────────────────────────────────────── */}
        <form className="chat-input-bar" onSubmit={handleEnviarMensaje}>
          <input
            type="text"
            placeholder="Escribe un mensaje..."
            value={textoMensaje}
            onChange={(e) => setTextoMensaje(e.target.value)}
            autoFocus
          />
          <button
            type="submit"
            className="btn-send"
            disabled={!textoMensaje.trim()}
          >
            Enviar
          </button>
        </form>

      </div>
    );
  }

  // ── FORMULARIO PARA INGRESAR EL CÓDIGO ───────────────────────────────────
  return (
    <div className="join-wrapper">

      <div className="join-header">
        <button className="btn-back" onClick={onVolver}>← Volver</button>
        <h2>Unirse a un Canal</h2>
      </div>

      <form className="modal-form" onSubmit={handleUnirse}>

        <div className="form-group">
          <label htmlFor="input-codigo-canal">Código de Invitación</label>
          <div className="code-input-wrapper">
            <input
              id="input-codigo-canal"
              type="text"
              className="form-field code-input"
              placeholder="XXX-XXXX"
              value={codigo}
              onChange={handleCambioCodigo}
              disabled={cargando}
              autoFocus
              autoComplete="off"
              spellCheck="false"
            />
            <span className={`code-validator ${estadoValidador}`}>
              {estadoValidador === 'valid'   && '✓'}
              {estadoValidador === 'invalid' && '✗'}
            </span>
          </div>
          <p className="code-hint">Formato: 3 letras/números · guión · 4 letras/números</p>
        </div>

        {error && (
          <div className="error-banner" role="alert">
            <span>⚠️</span>
            <span>{error}</span>
          </div>
        )}

        <button
          type="submit"
          className="btn-primary"
          disabled={cargando || !codigoValido}
        >
          {cargando ? <span className="spinner" /> : 'Unirse al Canal →'}
        </button>

      </form>
    </div>
  );
}
