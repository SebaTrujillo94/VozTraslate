// ********************************************************************************
// server.js - El "corazón" de nuestra aplicación (El Servidor)
// Aquí es donde manejamos las conexiones y los mensajes que mandan todos.
// ********************************************************************************

import express    from 'express';
import cors       from 'cors';
import { createServer } from 'http';
import { Server } from 'socket.io';
import fs from 'fs';
import path from 'path';
import os from 'os';
import dotenv from 'dotenv';
import Groq from 'groq-sdk';

// Aquí cargamos nuestra llave secreta del archivo .env para que funcione la IA
dotenv.config();

// Creamos la conexión con Groq usando nuestra API KEY (sin esto no traduce nada)
const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

// ── Configuración para que el servidor empiece a escuchar ────────────────────
const app = express();
app.use(cors()); // Esto permite que el cliente se conecte sin que el navegador se enoje
app.use(express.json()); // Para que el servidor entienda si le mandamos datos en formato JSON

// Esto es solo para saber si el servidor está vivo, si entras a /api/health verás el OK
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', mensaje: 'Servidor VozTranslate corriendo correctamente.' });
});

// Unimos Express con Socket.io para poder tener chat en tiempo real
const httpServer = createServer(app);

const io = new Server(httpServer, {
  cors: { origin: '*', methods: ['GET', 'POST'] },
});

// ── Aquí es donde guardamos las cosas mientras el programa está prendido ──────

// Lista de canales abiertos (como salones de chat)
const canales = new Map();

// Para saber qué persona está en qué canal
const socketCanal = new Map();

// Para saber quiénes están conectados en cada salón y qué idioma hablan
const canalMiembros = new Map();

// ── Cosas para que el chat no se trabe y ahorre recursos ─────────────────────

// Esto es para que no manden 100 mensajes por segundo (limita el spam)
const rateLimitMap = new Map();

// Esto guarda traducciones que ya hicimos, así no le pedimos lo mismo a la IA mil veces
const translationCache = new Map();

// Esta función es la que llama a la inteligencia artificial (LLaMA) para traducir
async function translateText(texto, fromLang, targetLang, retries = 2) {
  if (fromLang === targetLang) return texto; // No hacer gastos inútiles, es el mismo idioma

  const cacheKey = `${texto}:${fromLang}:${targetLang}`;
  
  if (translationCache.has(cacheKey)) {
    return translationCache.get(cacheKey);
  }

  // Lógica de Reintentos fácil (retry with backoff 500ms, 1500ms)
  for (let inte = 0; inte <= retries; inte++) {
    try {
      const response = await groq.chat.completions.create({
        messages: [
          { role: 'system', content: `You are a helpful translation assistant. Translate accurately from '${fromLang}' to '${targetLang}'. Respond ONLY in JSON format like {"text":"<your_translation>"}.` },
          { role: 'user', content: texto }
        ],
        model: 'llama-3.3-70b-versatile',
        response_format: { type: "json_object" },
      });

      const parseado = JSON.parse(response.choices[0].message.content);
      const outputTraducida = parseado.text || parseado.translation || texto;

      // Guardado LRU en caché 
      translationCache.set(cacheKey, outputTraducida);
      if (translationCache.size > 500) {
        // En Maps, .keys().next() devuelve la llave más antigua añadida! Así se vacía fácil.
        const primerKey = translationCache.keys().next().value;
        translationCache.delete(primerKey);
      }

      return outputTraducida;

    } catch (err) {
      if (inte === retries) throw err; // Ya valió barriga
      const msEsperar = inte === 0 ? 500 : 1500;
      await new Promise(r => setTimeout(r, msEsperar));
    }
  }
}

// Esta función le avisa a todos en el salón que hay un mensaje nuevo y lo traduce para cada uno
async function broadcastTranslation(io, codigoCanal, mensajeOriginal, esEdicion = false) {
  const { idMensaje, username, idioma: origenLang, texto, timestamp } = mensajeOriginal;
  const canalMap = canalMiembros.get(codigoCanal);

  if (!canalMap) return;

  // Miramos qué idiomas hablan los que están conectados para no traducir de más
  const targetLangs = new Set([...canalMap.values()].map(u => u.idioma));
  const translations = {}; 

  // Lanzamos todas las traducciones al mismo tiempo para que sea rápido
  const promesas = [...targetLangs].map(async (tl) => {
    try {
      const tradu = await translateText(texto, origenLang, tl);
      translations[tl] = { text: tradu };
    } catch (er) {
      console.log(`Error traduciendo para ${tl}:`, er.message);
      translations[tl] = { text: texto }; // Si falla la IA, mandamos el texto original para no dejar vacío
    }
  });

  await Promise.all(promesas);

  // Mandamos el mensaje ya con sus traducciones a todo el salón
  io.to(codigoCanal).emit(esEdicion ? 'message-edited' : 'translated-message', {
    idMensaje,
    username,
    originalText: texto,
    originalLang: origenLang,
    translations, 
    timestamp,
    tipo: 'mensaje-traducido',
    editado: esEdicion // Para poner el aviso de "(editado)" en la pantalla
  });
}

// ── Función para inventar un código de salón único (ej: ABC-1234) ─────────────
function generarCodigo() {
  const chars = 'ABCDEFGHIJKLMNPQRSTUVWXYZ123456789';
  const porcion = (n) =>
    Array.from({ length: n }, () => chars[Math.floor(Math.random() * chars.length)]).join('');

  let codigo;
  do { codigo = `${porcion(3)}-${porcion(4)}`; }
  while (canales.has(codigo));

  return codigo;
}

// ── Le avisamos a todos cuántos canales hay abiertos ──────────────────────────
function emitirEstadisticas() {
  const listaCanales = Array.from(canales.values()).map(c => ({
    codigo: c.codigo,
    nombre: c.nombre,
    creador: c.creador,
    idioma: c.idioma
  }));
  io.emit('stats-update', { totalCanales: canales.size, listaCanales });
}

// ── Función para avisar quién está conectado en un salón específico ─────────
function emitirMiembros(codigoCanal) {
  const membersMap = canalMiembros.get(codigoCanal);
  if (!membersMap) return;

  // Quitamos duplicados por si alguien abrió dos pestañas con el mismo nombre
  const uniqueMap = new Map();
  for (const m of membersMap.values()) uniqueMap.set(m.username, m);

  const miembrosArray   = Array.from(uniqueMap.values());
  const totalConectados = miembrosArray.length;

  io.to(codigoCanal).emit('canal-miembros-update', {
    miembros: miembrosArray,   // Mandamos la lista de gente
    totalConectados,
  });
}

// ── ¡Aquí empieza lo bueno! Cuando alguien se conecta al servidor ────────────
io.on('connection', (socket) => {
  console.log(`🔌 Alguien se conectó: ${socket.id}`);

  // Función para mandar la lista de canales rápido
  const enviarStatsInit = (sock) => {
    const listaCanales = Array.from(canales.values()).map(c => ({
      codigo: c.codigo, nombre: c.nombre, creador: c.creador, idioma: c.idioma
    }));
    sock.emit('stats-update', { totalCanales: canales.size, listaCanales });
  };

  // Apenas entra, le decimos qué canales hay abiertos
  enviarStatsInit(socket);

  // Si el cliente pregunta, le volvemos a decir las estadísticas
  socket.on('get-stats', () => enviarStatsInit(socket));

  // ── Cuando alguien quiere CREAR un salón nuevo ─────────────────────────────
  socket.on('create-channel', ({ nombre, idioma, creador }) => {
    if (!nombre || !idioma || !creador) {
      socket.emit('create-channel-response', {
        exito: false,
        error: 'Faltan datos: nombre, idioma o creador.',
      });
      return;
    }

    // Límite MVP: máximo 2 canales globales en todo el servidor
    if (canales.size >= 2) {
      socket.emit('create-channel-response', {
        exito: false,
        error: 'Límite global alcanzado: el MVP solo permite 2 canales activos en total. Cierra uno para crear otro.',
      });
      return;
    }

    const codigo     = generarCodigo();
    const nuevoCanal = { nombre, creador, idioma, codigo, historial: [] };

    canales.set(codigo, nuevoCanal);
    console.log(`📺 Canal creado: "${nombre}" [${codigo}] por ${creador}`);

    socket.emit('create-channel-response', { exito: true, canal: nuevoCanal });
    emitirEstadisticas(); // Avisamos a todo el mundo que hay un nuevo salón
  });

  // ── Cuando alguien (el creador) decide BORRAR el salón ─────────────────────
  socket.on('delete-channel', (codigo) => {
    const canalObj = canales.get(codigo);
    if (!canalObj) return;

    // Patada a todos los que estaban adentro, se cierra el boliche
    io.to(codigo).emit('channel-deleted-notify');
    
    // Lo borramos de la memoria del servidor
    canales.delete(codigo);
    canalMiembros.delete(codigo);

    // Actualizamos la lista para los que están en el Lobby
    emitirEstadisticas();
  });

  // ── Cuando alguien se quiere UNIR a un salón usando el código ──────────────
  socket.on('join-channel-by-code', ({ codigo, username, idioma }) => {
    const canal = canales.get(codigo);

    if (!canal) {
      socket.emit('join-channel-response', {
        exito: false,
        error: 'Ese código no existe, fíjate si lo escribiste bien.',
      });
      return;
    }

    // Lo metemos a la "sala" de Socket.io
    socket.join(codigo);

    // Guardamos los datos del usuario para saber quién es cuando se desconecte
    socketCanal.set(socket.id, { codigoCanal: codigo, username, idioma });

    // Lo anotamos en la lista de gente que está en el salón
    if (!canalMiembros.has(codigo)) {
      canalMiembros.set(codigo, new Map());
    }
    canalMiembros.get(codigo).set(socket.id, { username, idioma: idioma || 'en' });

    console.log(`👤 ${username} [${idioma}] entró al salón "${canal.nombre}"`);

    // Le mandamos al usuario toda la info del salón y los mensajes viejos para que se ponga al día
    socket.emit('join-channel-response', {
      exito:    true,
      canal,
      historial: canal.historial,
    });

    // Le avisamos a los demás que llegó alguien nuevo
    socket.to(codigo).emit('user-joined-notify', {
      username,
      idioma:    idioma || 'en',
      mensaje:   `${username} se unió al canal.`,
      timestamp: new Date().toISOString(),
    });

    // Refrescamos la lista de gente para todos
    emitirMiembros(codigo);
  });

  // ── Cuando alguien manda un mensaje de texto ───────────────────────────────
  socket.on('send-message', async ({ codigo, username, texto, idioma }) => {
    const canal = canales.get(codigo);
    if (!canal) return;

    // Ponemos un límite de 1 mensaje por segundo para que no se vuelvan locos mandando spam
    const ultimaVez = rateLimitMap.get(username) || 0;
    const ahora = Date.now();
    if (ahora - ultimaVez < 1000) return; 
    rateLimitMap.set(username, ahora);

    const inicioTimerMs = Date.now(); 
    const idMsgRandom = Math.random().toString(36).substring(7);

    // Le decimos a todos que estamos "procesando" (traduciendo) el mensaje
    io.to(codigo).emit('processing', { username, typing: false });

    // Armamos el objeto del mensaje
    const mensajeOriginal = {
      idMensaje: idMsgRandom,
      username,
      idioma: idioma || 'en',
      texto,
      timestamp: new Date().toISOString(),
    };

    // Mandamos a traducir a todos los idiomas y emitimos
    await broadcastTranslation(io, codigo, mensajeOriginal);

    // Avisamos que ya terminamos de traducir
    io.to(codigo).emit('processing-done', { idMensaje: idMsgRandom, username });

    console.log(`⏱ Traducido y enviado en ${Date.now() - inicioTimerMs}ms`);

    // Guardamos el mensaje en la memoria para que los nuevos lo vean
    canal.historial.push(mensajeOriginal);
    if (canal.historial.length > 50) canal.historial.shift(); // Borramos los muy viejos para que no explote la RAM
  });

  // ── Evento: edit-message ───────────────────────────────────────────────────
  socket.on('edit-message', async ({ codigo, idMensaje, username, newText, idioma }) => {
    const canal = canales.get(codigo);
    if (!canal) return;

    // Buscar si existe el mensaje y validamos al autor 
    const isEditing = canal.historial.find(m => m.idMensaje === idMensaje);
    if (!isEditing || isEditing.username !== username) return; // Prevent hacking

    // Emitir procesamiento para este request específico
    io.to(codigo).emit('processing', { username, typing: false });

    // Modificamos el histórico
    isEditing.texto = newText;
    
    // Y re-corremos broadcast pero en modo edición
    await broadcastTranslation(io, codigo, isEditing, true);

    io.to(codigo).emit('processing-done', { idMensaje, username });
    console.log(`✏️ Edit completed for msg ${idMensaje}`);
  });

  // ── Evento: typing ──────────────────────────────────────────────────
  socket.on('typing', ({ codigo, username, isTyping }) => {
    socket.to(codigo).emit('user-typing', { username, isTyping });
  });

  // ── Cuando alguien nos manda un audio de voz ──────────────────────────────
  socket.on('voice-audio', async ({ codigo, username, idioma, audioBuffer }) => {
    const canal = canales.get(codigo);
    if (!canal) return;

    // También limitamos los audios para que no colapse el servidor
    const ultima = rateLimitMap.get(username) || 0;
    const rightNow = Date.now();
    if (rightNow - ultima < 1000) return;
    rateLimitMap.set(username, rightNow);

    const idVoiceMsg = Math.random().toString(36).substring(7);
    const startMs = Date.now();

    // Avisamos que estamos procesando el audio (esto tarda un poquito más)
    io.to(codigo).emit('processing', { username, isAudio: true });

    try {
      // Truco: Guardamos el audio en una carpeta temporal para que Whisper lo pueda leer
      const archivoTmpPath = path.join(os.tmpdir(), `audio_voz_br_${idVoiceMsg}.webm`);
      fs.writeFileSync(archivoTmpPath, Buffer.from(audioBuffer));

      let textoHablado = "(🎙️ ...)";
      try {
        // Le pedimos a Whisper que nos diga qué dice el audio
        const trnscript = await groq.audio.transcriptions.create({
          file: fs.createReadStream(archivoTmpPath),
          model: "whisper-large-v3-turbo",
        });
        if (!trnscript.text || trnscript.text.trim() === '') throw new Error('Audio vacío');
        textoHablado = trnscript.text;
      } catch (err) {
        console.error(`Error procesando voz: ${err.message}`);
        textoHablado = "⚠️ (No se pudo entender el audio, revisa si tienes crédito en Groq)";
      } finally {
        // Borramos el archivo temporal para no llenar el disco de basura
        if (fs.existsSync(archivoTmpPath)) fs.unlinkSync(archivoTmpPath);
      }

      const mensajeOriginalObj = {
        idMensaje: idVoiceMsg,
        username,
        idioma: idioma || 'en',
        texto: textoHablado,
        timestamp: new Date().toISOString(),
      };

      // Mandamos el texto ya convertido a todos los idiomas
      await broadcastTranslation(io, codigo, mensajeOriginalObj);
      
      canal.historial.push(mensajeOriginalObj);
      if (canal.historial.length > 50) canal.historial.shift();

      console.log(`⏱ Voz procesada en ${Date.now() - startMs}ms`);

    } catch (e) {
      console.error(`Error fatal de audio: ${e.message}`);
    } finally {
      // Le decimos a la app que el usuario ya no está ocupado procesando
      io.to(codigo).emit('processing-done', { idMensaje: idVoiceMsg, username });
    }
  });

  // ── Cuando alguien se va o cierra la pestaña ──────────────────────────────
  socket.on('disconnect', () => {
    console.log(`❌ Alguien se fue: ${socket.id}`);

    const info = socketCanal.get(socket.id);
    if (info) {
      const { codigoCanal, username } = info;

      // Quitamos a la persona de la lista del salón
      const membersMap = canalMiembros.get(codigoCanal);
      if (membersMap) {
        membersMap.delete(socket.id);
        if (membersMap.size === 0) canalMiembros.delete(codigoCanal);
      }

      // Verificamos si aún tiene otros sockets vivos
      const aunConectado = membersMap ? Array.from(membersMap.values()).some(m => m.username === username) : false;

      if (!aunConectado) {
        // Notificar a los que quedan que esta persona se fue
        socket.to(codigoCanal).emit('user-left-notify', {
          username,
          mensaje:   `${username} ha salido del canal.`,
          timestamp: new Date().toISOString(),
        });
      }

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
