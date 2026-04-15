// ──────────────────────────────────────────────────────────────────────────────
// server.js — Servidor principal de VozTranslate
// Maneja la API REST y los eventos de WebSocket (Socket.io)
// ──────────────────────────────────────────────────────────────────────────────

import express    from 'express';
import cors       from 'cors';
import { createServer } from 'http';
import { Server } from 'socket.io';

// ── Configuración inicial de Express ─────────────────────────────────────────
const app = express();
app.use(cors());
app.use(express.json());

// Ruta de salud para verificar que el servidor está activo
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', mensaje: 'Servidor VozTranslate corriendo correctamente.' });
});

// ── Creamos el servidor HTTP y lo conectamos a Socket.io ─────────────────────
const httpServer = createServer(app);

const io = new Server(httpServer, {
  cors: { origin: '*', methods: ['GET', 'POST'] },
});

// ── Estructuras de datos en memoria ──────────────────────────────────────────

// Canales abiertos. Clave = código (ej: "XJ9-4K2L")
// Valor = { nombre, creador, idioma, codigo, historial }
const canales = new Map();

// Registra qué canal y usuario usa cada socket.
// Clave = socket.id  |  Valor = { codigoCanal, username, idioma }
// Sirve para saber a quién notificar cuando alguien se desconecta.
const socketCanal = new Map();

// Miembros actualmente conectados a cada canal.
// Clave = código del canal  |  Valor = Map<username, { username, idioma }>
// Usamos un Map interno (y no un Set) para guardar el idioma de cada usuario.
const canalMiembros = new Map();

// ── Función: generador de código único ────────────────────────────────────────
// Formato XXX-XXXX, solo letras y números que no se confunden visualmente.
function generarCodigo() {
  const chars = 'ABCDEFGHIJKLMNPQRSTUVWXYZ123456789';
  const porcion = (n) =>
    Array.from({ length: n }, () => chars[Math.floor(Math.random() * chars.length)]).join('');

  let codigo;
  do { codigo = `${porcion(3)}-${porcion(4)}`; }
  while (canales.has(codigo));

  return codigo;
}

// ── Función: emitir estadísticas globales ─────────────────────────────────────
// Envía a todos los clientes el número total de canales abiertos.
function emitirEstadisticas() {
  io.emit('stats-update', { totalCanales: canales.size });
}

// ── Función: emitir lista de miembros de un canal ─────────────────────────────
// Notifica a todos en el canal cuántos están conectados y su idioma (para banderas).
function emitirMiembros(codigoCanal) {
  const membersMap = canalMiembros.get(codigoCanal);
  if (!membersMap) return;

  // Convertimos el Map interno a Array de objetos { username, idioma }
  const miembrosArray   = Array.from(membersMap.values());
  const totalConectados = miembrosArray.length;

  io.to(codigoCanal).emit('canal-miembros-update', {
    miembros: miembrosArray,   // [{ username, idioma }, ...]
    totalConectados,
  });
}

// ── Lógica principal de Socket.io ────────────────────────────────────────────
io.on('connection', (socket) => {
  console.log(`🔌 Cliente conectado: ${socket.id}`);

  // Al conectarse, enviamos inmediatamente las estadísticas actuales
  socket.emit('stats-update', { totalCanales: canales.size });

  // El cliente puede pedir las estadísticas en cualquier momento
  socket.on('get-stats', () => {
    socket.emit('stats-update', { totalCanales: canales.size });
  });

  // ── Evento: crear-canal (HU-04) ────────────────────────────────────────────
  // El cliente envía: { nombre, idioma, creador }
  socket.on('create-channel', ({ nombre, idioma, creador }) => {
    if (!nombre || !idioma || !creador) {
      socket.emit('create-channel-response', {
        exito: false,
        error: 'Faltan datos: nombre, idioma o creador.',
      });
      return;
    }

    // Límite del plan gratuito: máximo 2 canales por usuario
    const canalesDelUsuario = [...canales.values()].filter(c => c.creador === creador);
    if (canalesDelUsuario.length >= 2) {
      socket.emit('create-channel-response', {
        exito: false,
        error: 'Límite alcanzado: el plan gratuito permite crear solo 2 canales.',
      });
      return;
    }

    const codigo     = generarCodigo();
    const nuevoCanal = { nombre, creador, idioma, codigo, historial: [] };

    canales.set(codigo, nuevoCanal);
    console.log(`📺 Canal creado: "${nombre}" [${codigo}] por ${creador}`);

    socket.emit('create-channel-response', { exito: true, canal: nuevoCanal });
    emitirEstadisticas(); // avisar a todos que hay un canal nuevo
  });

  // ── Evento: unirse-a-canal (HU-05) ────────────────────────────────────────
  // El cliente envía: { codigo, username, idioma }
  // El campo "idioma" es el idioma preferido del usuario (para mostrar su bandera).
  socket.on('join-channel-by-code', ({ codigo, username, idioma }) => {
    const canal = canales.get(codigo);

    if (!canal) {
      socket.emit('join-channel-response', {
        exito: false,
        error: 'El código de invitación no es válido o el canal no existe.',
      });
      return;
    }

    // Unir el socket a la room de Socket.io del canal
    socket.join(codigo);

    // Guardar la relación socket ↔ canal+usuario+idioma (para la desconexión)
    socketCanal.set(socket.id, { codigoCanal: codigo, username, idioma });

    // Agregar al usuario al mapa de miembros del canal (con su idioma)
    if (!canalMiembros.has(codigo)) {
      canalMiembros.set(codigo, new Map());
    }
    canalMiembros.get(codigo).set(username, { username, idioma: idioma || 'en' });

    console.log(`👤 ${username} [${idioma}] se unió al canal "${canal.nombre}" [${codigo}]`);

    // Responder al nuevo miembro con la info del canal y el historial previo
    socket.emit('join-channel-response', {
      exito:    true,
      canal,
      historial: canal.historial,
    });

    // Notificar a los demás que alguien nuevo entró
    socket.to(codigo).emit('user-joined-notify', {
      username,
      idioma:    idioma || 'en',
      mensaje:   `${username} se unió al canal.`,
      timestamp: new Date().toISOString(),
    });

    // Actualizar la lista de miembros para todos los que están en el canal
    emitirMiembros(codigo);
  });

  // ── Evento: enviar-mensaje ─────────────────────────────────────────────────
  // El cliente envía: { codigo, username, texto, idioma }
  // Guardamos el idioma en el mensaje para que los demás puedan mostrar la bandera.
  socket.on('send-message', ({ codigo, username, texto, idioma }) => {
    const canal = canales.get(codigo);
    if (!canal) return;

    const mensajeNuevo = {
      username,
      idioma:    idioma || 'en',
      texto,
      timestamp: new Date().toISOString(),
    };

    // Guardamos en historial (máx. 50 mensajes para no saturar la memoria)
    canal.historial.push(mensajeNuevo);
    if (canal.historial.length > 50) canal.historial.shift();

    // Retransmitir a todos en el canal, incluyendo al emisor
    io.to(codigo).emit('new-message', mensajeNuevo);
  });

  // ── Evento: desconexión ────────────────────────────────────────────────────
  socket.on('disconnect', () => {
    console.log(`❌ Cliente desconectado: ${socket.id}`);

    const info = socketCanal.get(socket.id);
    if (info) {
      const { codigoCanal, username } = info;

      // Quitar al usuario del Map de miembros del canal
      const membersMap = canalMiembros.get(codigoCanal);
      if (membersMap) {
        membersMap.delete(username);
        if (membersMap.size === 0) canalMiembros.delete(codigoCanal);
      }

      // Notificar a los que quedan que esta persona se fue
      socket.to(codigoCanal).emit('user-left-notify', {
        username,
        mensaje:   `${username} ha salido del canal.`,
        timestamp: new Date().toISOString(),
      });

      // Actualizar la lista de miembros para los que permanecen
      emitirMiembros(codigoCanal);
      socketCanal.delete(socket.id);
    }
  });
});

// ── Iniciar el servidor ───────────────────────────────────────────────────────
const PUERTO = 3001;

httpServer.listen(PUERTO, () => {
  console.log(`\n🚀 Servidor VozTranslate corriendo en el puerto ${PUERTO}`);
  console.log(`   API REST:  http://localhost:${PUERTO}/api/health`);
  console.log(`   Socket.io: ws://localhost:${PUERTO}\n`);
});
