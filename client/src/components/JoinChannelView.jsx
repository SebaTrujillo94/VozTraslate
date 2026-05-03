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
  Download, Lock,
} from 'lucide-react';
import { socket } from '../services/socket';
import { fetchChannelHistory, exportChannelHistory } from '../services/api';

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
  const [palabrasRestantes, setPalabrasRestantes] = useState(null); // null = pro o sin datos

  const goBack = useHistoryBack(onVolver);

  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const typingTimerRef = useRef(null);
  const isScrolledUpRef = useRef(false);

  // Referencia para el auto-scroll al final de la lista de mensajes
  const finListaRef = useRef(null);

  // ── HU-09: historial paginado ─────────────────────────────────────────
  const historialRef         = useRef([]);   // historial completo filtrado por plan
  const [loadedCount, setLoadedCount] = useState(0);
  const prevScrollHeightRef  = useRef(null); // para preservar posición al cargar más
  const messagesContainerRef = useRef(null);

  // hasMore: ¿hay más mensajes en el servidor más viejos que los que tenemos?
  const [hasMore, setHasMore] = useState(false);
  // cargandoMas: evita que se hagan dos fetches al mismo tiempo si el usuario
  // hace scroll muy rápido. Usamos ref + estado para no tener closures viejos.
  const [cargandoMas, setCargandoMas] = useState(false);
  const cargandoMasRef = useRef(false); // ref sincrono para el check en el handler

  // ── HU-10: exportar historial ──────────────────────────────────────────
  const [showExportModal, setShowExportModal] = useState(false);
  const [exportFrom,      setExportFrom]      = useState('');
  const [exportTo,        setExportTo]        = useState('');
  const [exportFormato,   setExportFormato]   = useState('txt'); // 'txt' | 'pdf'
  const [exportCargando,  setExportCargando]  = useState(false);
  const [exportError,     setExportError]     = useState('');

  // Generador de sonido super sencillo en JavaScript nativo (requisito universitario: cero dependencias)
  const playNotificationSound = () => {
    try {
      const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      const o = audioCtx.createOscillator();
      const g = audioCtx.createGain();
      o.connect(g); g.connect(audioCtx.destination);
      o.type = 'sine';
      o.frequency.setValueAtTime(800, audioCtx.currentTime);
      o.frequency.exponentialRampToValueAtTime(1200, audioCtx.currentTime + 0.1);
      g.gain.setValueAtTime(0.1, audioCtx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.1);
      o.start(); o.stop(audioCtx.currentTime + 0.1);
    } catch(e) {}
  };

  // sonido cuando alguien entra al canal (tono ascendente)
  const playJoinSound = () => {
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      [0, 0.12].forEach((delay, i) => {
        const o = ctx.createOscillator();
        const g = ctx.createGain();
        o.connect(g); g.connect(ctx.destination);
        o.type = 'sine';
        o.frequency.setValueAtTime(i === 0 ? 600 : 900, ctx.currentTime + delay);
        g.gain.setValueAtTime(0.08, ctx.currentTime + delay);
        g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + delay + 0.15);
        o.start(ctx.currentTime + delay);
        o.stop(ctx.currentTime + delay + 0.15);
      });
    } catch(e) {}
  };

  // sonido cuando alguien sale del canal (tono descendente)
  const playLeaveSound = () => {
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      [0, 0.12].forEach((delay, i) => {
        const o = ctx.createOscillator();
        const g = ctx.createGain();
        o.connect(g); g.connect(ctx.destination);
        o.type = 'sine';
        o.frequency.setValueAtTime(i === 0 ? 500 : 350, ctx.currentTime + delay);
        g.gain.setValueAtTime(0.07, ctx.currentTime + delay);
        g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + delay + 0.18);
        o.start(ctx.currentTime + delay);
        o.stop(ctx.currentTime + delay + 0.18);
      });
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
    // HU-09: si el usuario llegó al tope del scroll...
    if (scrollTop === 0) {
      if (loadedCount < historialRef.current.length) {
        // todavía hay historial local sin mostrar, mostramos 20 más
        prevScrollHeightRef.current = scrollHeight;
        setLoadedCount((prev) => Math.min(prev + 20, historialRef.current.length));
      } else if (hasMore && !cargandoMasRef.current) {
        // ya mostramos todo lo local, pedimos más al servidor
        cargarMasHistorial();
      }
    }
  };

  // ── HU-09: carga mensajes más viejos desde el servidor ───────────────────────
  // Se llama cuando el usuario llegó al tope y ya no hay más historial local
  const cargarMasHistorial = async () => {
    if (!canal || cargandoMasRef.current) return;

    // bloqueamos con ref para evitar doble fetch si el usuario scrollea muy rápido
    cargandoMasRef.current = true;
    setCargandoMas(true);

    try {
      // el mensaje más viejo que tenemos es el primero del arreglo
      const mensajeMasViejo = historialRef.current[0];
      if (!mensajeMasViejo) return;

      const data = await fetchChannelHistory(canal.codigo, {
        before: mensajeMasViejo.timestamp,
        limit: 20,
      });

      if (!data.messages || data.messages.length === 0) {
        setHasMore(false);
        return;
      }

      // guardamos el scrollHeight ANTES de agregar los nuevos mensajes
      // para que el useLayoutEffect pueda restaurar la posición
      const container = messagesContainerRef.current;
      if (container) prevScrollHeightRef.current = container.scrollHeight;

      // anteponemos los mensajes viejos al inicio del historial
      historialRef.current = [...data.messages, ...historialRef.current];

      // mostramos los nuevos mensajes incrementando loadedCount
      setLoadedCount((prev) => prev + data.messages.length);
      setHasMore(data.hasMore);

    } catch (e) {
      console.error('No se pudo cargar más historial:', e.message);
    } finally {
      cargandoMasRef.current = false;
      setCargandoMas(false);
    }
  };

  // ── HU-10: genera y descarga el archivo TXT ───────────────────────────────
  const generarDescargarTXT = ({ messages, canalNombre, codigo }) => {
    const userLang = profile.language || 'en';

    const lineas = [
      '=== VozTraslate - Historial del Canal ===',
      `Canal: #${canalNombre} (${codigo})`,
      `Periodo: ${exportFrom} / ${exportTo}`,
      `Generado: ${new Date().toLocaleString()}`,
      `Total de mensajes: ${messages.length}`,
      '==========================================',
      '',
    ];

    for (const msg of messages) {
      const fecha     = new Date(msg.timestamp).toLocaleString();
      const textoBase = msg.originalText || msg.texto;
      lineas.push(`[${fecha}] ${msg.username}: ${textoBase}`);

      // solo mostramos la traducción si es diferente al texto original
      const traduccion = msg.translations?.[userLang]?.text;
      if (traduccion && traduccion !== textoBase) {
        lineas.push(`  → Traducción (${userLang}): ${traduccion}`);
      }
      if (msg.editado) lineas.push('  ✏️ (editado)');
      lineas.push('');
    }

    lineas.push('==========================================');
    lineas.push('Exportado con VozTraslate');

    const blob = new Blob([lineas.join('\n')], { type: 'text/plain;charset=utf-8' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = `historial_${codigo}_${exportFrom}_${exportTo}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // ── HU-10: abre ventana de impresión para guardar como PDF ────────────────
  // No necesitamos ninguna librería, el navegador genera el PDF solito con print()
  const generarAbrirPDF = ({ messages, canalNombre, codigo }) => {
    const userLang = profile.language || 'en';

    const mensajesHTML = messages.map(msg => {
      const fecha      = new Date(msg.timestamp).toLocaleString();
      const textoBase  = msg.originalText || msg.texto;
      const traduccion = msg.translations?.[userLang]?.text;
      const mostrarTr  = traduccion && traduccion !== textoBase;

      return `
        <div class="mensaje">
          <div class="msg-cabecera">
            <strong>${msg.username}</strong>
            <span class="fecha">${fecha}</span>
            ${msg.editado ? '<span class="editado">(editado)</span>' : ''}
          </div>
          <div class="msg-texto">${textoBase}</div>
          ${mostrarTr ? `<div class="msg-traduccion">→ ${traduccion}</div>` : ''}
        </div>
      `;
    }).join('');

    // página HTML limpia con estilos de impresión, se abre en pestaña nueva
    const htmlCompleto = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <title>Historial #${canalNombre} (${codigo})</title>
  <style>
    body { font-family: Arial, sans-serif; font-size: 11pt; color: #1a1a2e; margin: 2cm; }
    h1   { font-size: 14pt; color: #7c3aed; border-bottom: 2px solid #7c3aed; padding-bottom: 6px; }
    .meta { font-size: 9pt; color: #555; margin-bottom: 18px; }
    .mensaje { margin-bottom: 12px; padding: 8px 10px; border-left: 3px solid #dde1f0; page-break-inside: avoid; }
    .msg-cabecera { display: flex; gap: 10px; margin-bottom: 3px; align-items: baseline; }
    .msg-cabecera strong { color: #7c3aed; }
    .fecha   { color: #888; font-size: 8.5pt; }
    .editado { color: #c97b00; font-size: 8.5pt; }
    .msg-texto { color: #1a1a2e; line-height: 1.45; }
    .msg-traduccion { color: #5a6480; font-style: italic; font-size: 9.5pt; margin-top: 3px; }
    @media print { @page { margin: 2cm; } body { margin: 0; } }
  </style>
</head>
<body>
  <h1>VozTraslate — #${canalNombre}</h1>
  <div class="meta">
    Código: ${codigo} &nbsp;·&nbsp; Periodo: ${exportFrom} al ${exportTo}
    &nbsp;·&nbsp; Generado: ${new Date().toLocaleString()}
    &nbsp;·&nbsp; Total: ${messages.length} mensajes
  </div>
  ${mensajesHTML}
</body>
</html>`;

    const ventana = window.open('', '_blank', 'width=860,height=680');
    if (ventana) {
      ventana.document.write(htmlCompleto);
      ventana.document.close();
      ventana.focus();
      // pequeño delay para que los estilos carguen antes de imprimir
      setTimeout(() => ventana.print(), 400);
    }
  };

  // ── HU-10: abre el modal de exportación con fechas por defecto ────────────
  const handleAbrirExport = () => {
    // fechas por defecto: últimos 30 días
    const hoy      = new Date().toISOString().split('T')[0];
    const hace30   = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    setExportTo(hoy);
    setExportFrom(hace30);
    setExportError('');
    setShowExportModal(true);
  };

  // ── HU-10: ejecuta la exportación pidiendo datos al servidor ─────────────
  const handleExportarHistorial = async () => {
    if (!exportFrom || !exportTo) return;
    setExportCargando(true);
    setExportError('');

    try {
      const data = await exportChannelHistory(canal.codigo, { from: exportFrom, to: exportTo });

      if (!data.messages || data.messages.length === 0) {
        setExportError('No hay mensajes en el rango de fechas seleccionado.');
        return;
      }

      if (exportFormato === 'txt') {
        generarDescargarTXT(data);
      } else {
        generarAbrirPDF(data);
      }

      setShowExportModal(false);
    } catch (e) {
      // si el servidor devuelve 403 es porque no es Pro, mostramos mensaje claro
      setExportError(e.message || 'Error al exportar el historial');
    } finally {
      setExportCargando(false);
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

        // HU-09: si el servidor mandó 50 mensajes (el máximo), puede haber más viejos
        setHasMore(respuesta.historial.length >= 50);
      } else {
        setError(respuesta.error);
      }
    };

    // Otro usuario se une: mostrar mensaje de sistema en el chat
    const manejarNuevoMiembro = ({ mensaje, timestamp }) => {
      setMensajes((prev) => [...prev, { tipo: 'sistema', texto: mensaje, timestamp }]);
      if (sonidoActivado) playJoinSound();
    };

    // Otro usuario se va: mostrar mensaje de sistema en el chat
    const manejarSalidaMiembro = ({ mensaje, timestamp }) => {
      setMensajes((prev) => [...prev, { tipo: 'sistema', texto: mensaje, timestamp }]);
      if (sonidoActivado) playLeaveSound();
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

    // actualizacion del contador de palabras (solo plan free)
    const manejarWordsUpdate = ({ wordsUsed, limit }) => {
      setPalabrasRestantes(limit - wordsUsed);
    };

    // limite alcanzado
    const manejarWordLimitReached = () => {
      setPalabrasRestantes(0);
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
    socket.on('words-update',           manejarWordsUpdate);
    socket.on('word-limit-reached',     manejarWordLimitReached);

    // pedimos el conteo de palabras actual al conectar
    socket.emit('get-word-count', { username: profile.username });

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
      socket.off('words-update',           manejarWordsUpdate);
      socket.off('word-limit-reached',     manejarWordLimitReached);
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

            {palabrasRestantes !== null && (
              <div className={`words-badge ${palabrasRestantes <= 100 ? 'words-badge--low' : ''}`}>
                <span>{palabrasRestantes}</span>
                <span className="words-badge-label"> palabras</span>
              </div>
            )}

            {/* HU-10: botón de exportar historial (Pro solamente) */}
            <button
              className={`btn-export ${profile.plan !== 'pro' ? 'locked' : ''}`}
              onClick={handleAbrirExport}
              title={profile.plan === 'pro' ? 'Exportar historial (Pro)' : 'Exportar historial — Función Pro'}
            >
              {profile.plan === 'pro' ? <Download size={15} /> : <Lock size={14} />}
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

          {/* HU-09: spinner mientras se traen mensajes del servidor */}
          {cargandoMas && (
            <div className="msg-system history-top-indicator">
              <span className="spinner-micro" /> Cargando mensajes anteriores...
            </div>
          )}

          {/* HU-09: indicador de historial disponible / inicio */}
          {!cargandoMas && loadedCount < historialRef.current.length && (
            <div className="msg-system history-top-indicator">
              <ChevronsUp size={13} /> Sube para ver más ({historialRef.current.length - loadedCount} mensajes anteriores)
            </div>
          )}
          {!cargandoMas && loadedCount > 0 && loadedCount >= historialRef.current.length && !hasMore && (
            <div className="msg-system history-top-indicator">— Inicio del historial —</div>
          )}
          {!cargandoMas && loadedCount >= historialRef.current.length && hasMore && (
            <div className="msg-system history-top-indicator">
              <ChevronsUp size={13} /> Sube para cargar más mensajes
            </div>
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

        {/* ── HU-10: Modal de exportación de historial ─────────────────────── */}
        {showExportModal && (
          <div className="modal-overlay" onClick={() => setShowExportModal(false)}>
            <div className="modal-box modal-export" onClick={(e) => e.stopPropagation()}>
              <h2>Exportar Historial</h2>
              <p className="modal-subtitle">
                Canal <strong>#{canal.nombre}</strong> · Solo plan Pro · Máximo 500 mensajes
              </p>

              {/* Si el usuario es Free, mostramos el bloqueo antes de los controles */}
              {profile.plan !== 'pro' ? (
                <div className="export-locked-msg">
                  <Lock size={32} strokeWidth={1.5} />
                  <p>Esta función es exclusiva del <strong>plan Pro</strong>.</p>
                  <p className="export-locked-sub">
                    Actualiza tu cuenta para exportar el historial en TXT o PDF.
                  </p>
                </div>
              ) : (
                <>
                  {/* Rango de fechas */}
                  <div className="export-date-row">
                    <div className="form-group">
                      <label htmlFor="export-from">Desde</label>
                      <input
                        id="export-from"
                        type="date"
                        className="form-field"
                        value={exportFrom}
                        max={exportTo || new Date().toISOString().split('T')[0]}
                        onChange={(e) => setExportFrom(e.target.value)}
                      />
                    </div>
                    <div className="form-group">
                      <label htmlFor="export-to">Hasta</label>
                      <input
                        id="export-to"
                        type="date"
                        className="form-field"
                        value={exportTo}
                        min={exportFrom}
                        max={new Date().toISOString().split('T')[0]}
                        onChange={(e) => setExportTo(e.target.value)}
                      />
                    </div>
                  </div>

                  {/* Selector de formato */}
                  <div className="export-format-row">
                    <span className="export-format-label">Formato:</span>
                    <button
                      type="button"
                      className={`export-format-btn ${exportFormato === 'txt' ? 'active' : ''}`}
                      onClick={() => setExportFormato('txt')}
                    >
                      TXT
                    </button>
                    <button
                      type="button"
                      className={`export-format-btn ${exportFormato === 'pdf' ? 'active' : ''}`}
                      onClick={() => setExportFormato('pdf')}
                    >
                      PDF
                    </button>
                  </div>

                  {/* Error si hay alguno */}
                  {exportError && (
                    <div className="error-banner" role="alert">
                      <AlertTriangle size={14} />
                      <span>{exportError}</span>
                    </div>
                  )}
                </>
              )}

              <div className="modal-actions">
                <button className="btn-secondary" onClick={() => setShowExportModal(false)}>
                  {profile.plan !== 'pro' ? 'Cerrar' : 'Cancelar'}
                </button>
                {profile.plan === 'pro' && (
                  <button
                    className="btn-primary"
                    onClick={handleExportarHistorial}
                    disabled={exportCargando || !exportFrom || !exportTo}
                  >
                    {exportCargando
                      ? <><span className="spinner" /> Generando...</>
                      : <><Download size={15} /> Descargar {exportFormato.toUpperCase()}</>
                    }
                  </button>
                )}
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
            disabled={(!textoMensaje.trim() && !estaGrabando) || palabrasRestantes === 0}
            title={palabrasRestantes === 0 ? 'Límite de palabras alcanzado' : ''}
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
