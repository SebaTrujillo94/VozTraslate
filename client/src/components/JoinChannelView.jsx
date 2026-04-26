// ********************************************************************************
// JoinChannelView.jsx — Aquí es donde pasa la magia del chat
// Esta pantalla sirve para poner el código, entrar y hablar con la gente.
// Tiene traducciones al tiro, mensajes de voz y te avisa quién está conectado.
// ********************************************************************************

import { useState, useEffect, useLayoutEffect, useRef } from 'react';
import { useHistoryBack } from '../hooks/useHistoryBack';
import {
  Hash, Users, Mic, Square, Volume2, VolumeX,
  Pencil, X, ArrowLeft, ChevronDown, ChevronsUp,
  Send, AlertTriangle, MessageCircle, LogOut,
} from 'lucide-react';
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

// Esta función nos da el emoji de la bandera para que se vea bonito el chat
function obtenerBandera(idioma) {
  return BANDERAS[idioma] || '🏳️';
}

// ── Componente principal: Aquí es donde Renderizamos todo ────────────────────
export default function JoinChannelView({ profile, onVolver, codigoAutoJoin }) {
  // El código que escribimos o que nos pasan al hacer clic
  const [codigo, setCodigo] = useState(codigoAutoJoin || '');

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

  // ── ESTADOS DE LA ÉPICA 03 (CHAT MEJORADO PARA ALUMNOS) ───────────────────
  const [usuariosEscribiendo, setUsuariosEscribiendo] = useState({});
  const [sonidoActivado, setSonidoActivado] = useState(() => {
    return localStorage.getItem('voxbridge_sound') !== 'false';
  });
  const [nuevosMensajesAbajo, setNuevosMensajesAbajo] = useState(false);
  const [estaGrabando, setEstaGrabando] = useState(false);
  const [processingUser, setProcessingUser] = useState(null);
  const [mensajeEditando, setMensajeEditando] = useState(null);

  const [showExitConfirm, setShowExitConfirm] = useState(false);

  const goBack = useHistoryBack(onVolver);

  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const typingTimerRef = useRef(null);
  const isScrolledUpRef = useRef(false);

  // Referencia para el auto-scroll al final de la lista de mensajes
  const finListaRef = useRef(null);

  // ── HU-09: historial paginado ─────────────────────────────────────────
  const historialRef       = useRef([]);   // historial completo filtrado por plan
  const [loadedCount, setLoadedCount] = useState(0);
  const prevScrollHeightRef  = useRef(null); // para preservar posición al cargar más
  const messagesContainerRef = useRef(null);

  // Generador de sonido super sencillo en JavaScript nativo (requisito universitario: cero dependencias)
  const playNotificationSound = () => {
    try {
      const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      const o = audioCtx.createOscillator();
      const g = audioCtx.createGain();
      o.connect(g);
      g.connect(audioCtx.destination);
      o.type = 'sine';
      o.frequency.setValueAtTime(800, audioCtx.currentTime);
      o.frequency.exponentialRampToValueAtTime(1200, audioCtx.currentTime + 0.1);
      g.gain.setValueAtTime(0.1, audioCtx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.1);
      o.start();
      o.stop(audioCtx.currentTime + 0.1);
    } catch(e) {}
  };

  // ── Auto-scroll si no estamos leyendo historial antiguo ────────────────────
  useEffect(() => {
    if (!isScrolledUpRef.current) {
      setTimeout(() => finListaRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
    }
  }, [mensajes]);

  // ── HU-09: preservar posición al prepend de historial ──────────────────────
  useLayoutEffect(() => {
    if (prevScrollHeightRef.current !== null && messagesContainerRef.current) {
      const container = messagesContainerRef.current;
      container.scrollTop = container.scrollHeight - prevScrollHeightRef.current;
      prevScrollHeightRef.current = null;
    }
  }, [loadedCount]);

  const handleScrollChat = (e) => {
    const { scrollTop, scrollHeight, clientHeight } = e.target;
    const isAtBottom = scrollHeight - scrollTop - clientHeight < 150;
    isScrolledUpRef.current = !isAtBottom;
    if (isAtBottom && nuevosMensajesAbajo) {
      setNuevosMensajesAbajo(false);
    }
    // HU-09: cargar más historial al llegar al tope
    if (scrollTop === 0 && loadedCount < historialRef.current.length) {
      prevScrollHeightRef.current = scrollHeight;
      setLoadedCount((prev) => Math.min(prev + 20, historialRef.current.length));
    }
  };

  // ── Unirse automáticamente si viene con código ────────────────────────────
  useEffect(() => {
    if (codigoAutoJoin) {
      setCargando(true);
      if (!socket.connected) socket.connect();
      socket.emit('join-channel-by-code', {
        codigo:   codigoAutoJoin.toUpperCase(),
        username: profile.username,
        idioma:   profile.language || 'en',
      });
    }
  }, [codigoAutoJoin, profile.username, profile.language]);

  // ── Esto conecta al usuario apenas entra al salón ──────────────────────────
  useEffect(() => {
    // Escuchamos cuando el servidor nos deja entrar
    const manejarUnirse = (respuesta) => {
      setCargando(false);
      if (respuesta.exito) {
        setCanal(respuesta.canal);

        // HU-09: filtrar historial por plan (Free=24h, Pro=30 días)
        const now    = Date.now();
        const planMs = profile.plan === 'pro'
          ? 30 * 24 * 60 * 60 * 1000
          :      24 * 60 * 60 * 1000;

        const filtrado = respuesta.historial
          .filter((m) => now - new Date(m.timestamp).getTime() <= planMs)
          .map((m) => ({
            ...m,
            tipo:         m.translations ? 'mensaje-traducido' : 'mensaje',
            originalText: m.originalText || m.texto,
            originalLang: m.idioma,
          }));

        historialRef.current = filtrado;
        setLoadedCount(Math.min(20, filtrado.length));
        setMensajes([]); // mensajes en vivo empiezan vacíos
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

    // Mensajes traducidos desde la Épica 03
    const manejarMensajeTraducido = (msg) => {
      setMensajes((prev) => [...prev, { ...msg }]);
      if (sonidoActivado && msg.username !== profile.username) {
        playNotificationSound();
      }
      if (isScrolledUpRef.current) {
        setNuevosMensajesAbajo(true);
      } else {
        setTimeout(() => finListaRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);
      }
    };

    // Indicadores visuales
    const manejarProcessing = ({ username, isAudio }) => setProcessingUser({ username, isAudio });
    const manejarProcessingDone = () => setProcessingUser(null);
    const manejarTyping = ({ username, isTyping }) => {
      setUsuariosEscribiendo(prev => {
        const next = { ...prev };
        if (isTyping) next[username] = true;
        else delete next[username];
        return next;
      });
    };

    // Mensaje editado desde el servidor
    const manejarMensajeEditado = (msg) => {
      setMensajes((prev) => prev.map(m => m.idMensaje === msg.idMensaje ? { ...msg } : m));
    };

    // El canal ha sido eliminado por el creador
    const manejarCanalEliminado = () => {
      alert("Este canal ha sido cerrado por el administrador.");
      onVolver();
    };

    // Registrar todos los listeners nuevos
    socket.on('join-channel-response',  manejarUnirse);
    socket.on('user-joined-notify',     manejarNuevoMiembro);
    socket.on('user-left-notify',       manejarSalidaMiembro);
    socket.on('canal-miembros-update',  manejarActualizacionMiembros);
    socket.on('translated-message',     manejarMensajeTraducido);
    socket.on('message-edited',         manejarMensajeEditado);
    socket.on('channel-deleted-notify', manejarCanalEliminado);
    socket.on('processing',             manejarProcessing);
    socket.on('processing-done',        manejarProcessingDone);
    socket.on('user-typing',            manejarTyping);

    return () => {
      socket.off('join-channel-response',  manejarUnirse);
      socket.off('user-joined-notify',     manejarNuevoMiembro);
      socket.off('user-left-notify',       manejarSalidaMiembro);
      socket.off('canal-miembros-update',  manejarActualizacionMiembros);
      socket.off('translated-message',     manejarMensajeTraducido);
      socket.off('message-edited',         manejarMensajeEditado);
      socket.off('channel-deleted-notify', manejarCanalEliminado);
      socket.off('processing',             manejarProcessing);
      socket.off('processing-done',        manejarProcessingDone);
      socket.off('user-typing',            manejarTyping);
    };
  }, [onVolver, profile.username, sonidoActivado]);

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

  // ── Enviar un mensaje de chat o editarlo ──────────────────────────────────
  const handleEnviarMensaje = (e) => {
    e.preventDefault();
    if (!textoMensaje.trim()) return;

    if (mensajeEditando) {
      // Envío de edición al servidor
      socket.emit('edit-message', {
        codigo: canal.codigo,
        username: profile.username,
        idMensaje: mensajeEditando,
        newText: textoMensaje.trim(),
        idioma: profile.language || 'en'
      });
      setMensajeEditando(null);
    } else {
      // Envío normal
      socket.emit('send-message', {
        codigo:   canal.codigo,
        username: profile.username,
        texto:    textoMensaje.trim(),
        idioma:   profile.language || 'en', // Para la bandera y traducción base
      });
    }

    setTextoMensaje('');
    
    // Parar typing indicator inmediatamente al enviar
    if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
    socket.emit('typing', { codigo: canal.codigo, username: profile.username, isTyping: false });
  };

  // ── Typing Indicator con Debounce ──────────────────────────────────
  const handleCambioTexto = (e) => {
    setTextoMensaje(e.target.value);
    if (!canal) return;

    socket.emit('typing', { codigo: canal.codigo, username: profile.username, isTyping: true });

    if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
    typingTimerRef.current = setTimeout(() => {
      socket.emit('typing', { codigo: canal.codigo, username: profile.username, isTyping: false });
    }, 2000);
  };

  // ── Función para grabar nuestra voz (como en WhatsApp) ──────────────────────
  const handleGrabarVoz = async () => {
    if (estaGrabando) {
      mediaRecorderRef.current?.stop();
      setEstaGrabando(false);
      return;
    }

    try {
      // Le pedimos permiso al navegador para usar el micrófono
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) audioChunksRef.current.push(event.data);
      };

      mediaRecorder.onstop = () => {
        // Cuando paramos de grabar, mandamos el archivo al servidor
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        socket.emit('voice-audio', {
          codigo: canal.codigo,
          username: profile.username,
          idioma: profile.language || 'en',
          audioBuffer: audioBlob
        });
        // Apagamos el micrófono para que no se quede prendida la luz roja
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.start();
      setEstaGrabando(true);
    } catch (err) {
      console.error(err);
      alert("¡Oye! No pudimos usar tu micro. Revisa los permisos.");
    }
  };

  // ── VISTA DE CHAT ─────────────────────────────────────────────────────────
  if (canal) {
    // Calcular personas en el canal excluyendo al usuario actual
    const otrosConectados = miembrosConectados.filter(
      (m) => m.username !== profile.username
    );
    const hayOtros     = otrosConectados.length > 0;
    const totalEnCanal = miembrosConectados.length;

    // HU-09: combinar historial paginado + mensajes en vivo
    const historialMostrado = historialRef.current.slice(-loadedCount);
    const todosLosMensajes  = [...historialMostrado, ...mensajes];

    return (
      <div className="channel-chat-view">

        {/* ── Barra superior ─────────────────────────────────────────────── */}
        <div className="chat-top-bar">
          <div className="chat-top-info">

            {/* Nombre del canal + idioma */}
            <div className="channel-name">
              <Hash size={15} strokeWidth={2.5} />
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
              <Users size={13} />
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

            {/* Toggle de sonido simple */}
            <button 
              className="btn-sound-toggle" 
              onClick={() => {
                const ns = !sonidoActivado;
                setSonidoActivado(ns);
                localStorage.setItem('voxbridge_sound', ns.toString());
              }} 
              title={sonidoActivado ? "Desactivar sonidos" : "Activar sonidos"}
            >
              {sonidoActivado ? <Volume2 size={16} /> : <VolumeX size={16} />}
            </button>

            <button className="btn-back" onClick={() => setShowExitConfirm(true)}><ArrowLeft size={15} /> Salir</button>
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
        <div className="messages-list" ref={messagesContainerRef} onScroll={handleScrollChat}>

          {/* HU-09: indicador de historial disponible / inicio */}
          {loadedCount < historialRef.current.length && (
            <div className="msg-system history-top-indicator">
              <ChevronsUp size={13} /> Sube para ver más ({historialRef.current.length - loadedCount} mensajes anteriores)
            </div>
          )}
          {loadedCount > 0 && loadedCount >= historialRef.current.length && (
            <div className="msg-system history-top-indicator">— Inicio del historial —</div>
          )}

          {todosLosMensajes.length === 0 && (
            <p className="msg-system">Aún no hay mensajes. ¡Sé el primero en escribir!</p>
          )}

          {todosLosMensajes.map((msg, indice) => {
            if (msg.tipo === 'sistema') {
              return <div key={indice} className="msg-system">{msg.texto}</div>;
            }

            const esMio   = msg.username === profile.username;
            const bandera = obtenerBandera(msg.originalLang || msg.idioma || 'en');

            const textoMostrar = msg.tipo === 'mensaje-traducido'
              ? (msg.translations?.[profile.language || 'en']?.text || msg.originalText)
              : msg.texto;

            return (
              <div key={`${msg.idMensaje || ''}-${indice}`} className={`msg-bubble ${esMio ? 'propio' : 'ajeno'}`}>
                {!esMio && (
                  <div className="msg-username">
                    <span className="msg-flag" aria-label="Idioma original">{bandera}</span>
                    {msg.username}
                  </div>
                )}
                <div className="msg-text">
                  {esMio && <span className="msg-flag-own" title="Tu idioma">{bandera}</span>}
                  <span className="msg-content">
                    {textoMostrar}
                    {msg.editado && <small className="edited-flag"> (editado)</small>}
                  </span>
                  {msg.tipo === 'mensaje-traducido' && textoMostrar !== msg.originalText && (
                    <div className="msg-original">Original: {msg.originalText}</div>
                  )}
                  {esMio && (
                    <button
                      className="btn-edit-msg"
                      onClick={() => {
                        setMensajeEditando(msg.idMensaje);
                        setTextoMensaje(msg.originalText || msg.texto);
                      }}
                      title="Editar mensaje"
                    >
                      <Pencil size={12} />
                    </button>
                  )}
                </div>
              </div>
            );
          })}

          {/* Indicador de procesamiento del backend */}
          {processingUser && (
            <div className="msg-system processing">
              <span className="spinner-micro"></span>
              {processingUser.username} está procesando {processingUser.isAudio ? 'audio' : 'traducción'}...
            </div>
          )}

          {/* Typing indicator */}
          {Object.keys(usuariosEscribiendo).length > 0 && (
            <div className="msg-system typing-indicator">
              <MessageCircle size={13} /> {Object.keys(usuariosEscribiendo).join(', ')} está escribiendo<span className="dots">...</span>
            </div>
          )}

          <div ref={finListaRef} />
        </div>

        {/* Badge flotante cuando estás arriba y llegan nuevos mensajes */}
        {nuevosMensajesAbajo && (
          <div className="badge-new-messages" onClick={() => {
            setNuevosMensajesAbajo(false);
            finListaRef.current?.scrollIntoView({ behavior: 'smooth' });
          }}>
             <ChevronDown size={14} /> Nuevo mensaje
          </div>
        )}

        {/* ── Confirmación de salida ────────────────────────────────────────── */}
        {showExitConfirm && (
          <div className="modal-overlay" onClick={() => setShowExitConfirm(false)}>
            <div className="modal-box exit-confirm-box" onClick={(e) => e.stopPropagation()}>
              <h2>¿Salir del canal?</h2>
              <p className="modal-subtitle">Tu conexión en tiempo real se cerrará.</p>
              <div className="modal-actions">
                <button className="btn-secondary" onClick={() => setShowExitConfirm(false)}>
                  Cancelar
                </button>
                <button className="btn-danger" onClick={goBack}>
                  <LogOut size={15} /> Salir
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── Barra de escritura ────────────────────────────────────────────── */}
        <form className="chat-input-bar" onSubmit={handleEnviarMensaje}>
          {mensajeEditando ? (
            <button
              type="button"
              className="btn-cancel-edit"
              onClick={() => {
                setMensajeEditando(null);
                setTextoMensaje('');
              }}
              title="Cancelar edición"
            >
              <X size={16} />
            </button>
          ) : (
            <button
              type="button"
              className={`btn-record ${estaGrabando ? 'recording' : ''}`}
              onClick={handleGrabarVoz}
              title={estaGrabando ? 'Parar de grabar' : 'Grabar mensaje de voz (Whisper)'}
            >
               {estaGrabando ? <Square size={16} /> : <Mic size={16} />}
            </button>
          )}

          <input
            type="text"
            placeholder={mensajeEditando ? "Editando mensaje..." : "Escribe un mensaje..."}
            value={textoMensaje}
            onChange={handleCambioTexto}
            autoFocus
          />
          <button
            type="submit"
            className="btn-send"
            disabled={!textoMensaje.trim() && !estaGrabando}
          >
            {mensajeEditando ? 'Guardar' : <Send size={15} />}
          </button>
        </form>

      </div>
    );
  }

  // ── FORMULARIO PARA INGRESAR EL CÓDIGO ───────────────────────────────────
  return (
    <div className="join-wrapper">

      <div className="join-header">
        <button className="btn-back" onClick={goBack}><ArrowLeft size={15} /> Volver</button>
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
            <AlertTriangle size={14} />
            <span>{error}</span>
          </div>
        )}

        <button
          type="submit"
          className="btn-primary"
          disabled={cargando || !codigoValido}
        >
          {cargando ? <span className="spinner" /> : <><Send size={15} /> Unirse al Canal</>}
        </button>

      </form>
    </div>
  );
}
