// db.js - conexion a la base de datos postgres
// usamos pg porque es lo que vimos en clases y funciona bien con node

import pg from 'pg';
import dotenv from 'dotenv';
dotenv.config();

const { Pool } = pg;

// el pool maneja multiples conexiones sin tener que abrir una nueva cada vez
export const pool = new Pool({ connectionString: process.env.DATABASE_URL });

// crea las tablas si no existen todavia
export async function initDB() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id           SERIAL PRIMARY KEY,
      email        TEXT UNIQUE NOT NULL,
      username     TEXT UNIQUE NOT NULL,
      password     TEXT NOT NULL,
      display_name TEXT NOT NULL,
      language     TEXT NOT NULL DEFAULT 'en',
      avatar_url   TEXT,
      plan         TEXT NOT NULL DEFAULT 'free',
      words_used   INT NOT NULL DEFAULT 0,
      created_at   TIMESTAMPTZ DEFAULT NOW()
    )
  `);
  // si la tabla ya existia le agregamos la columna igual
  await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS words_used INT NOT NULL DEFAULT 0`);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS channels (
      id         SERIAL PRIMARY KEY,
      codigo     TEXT UNIQUE NOT NULL,
      nombre     TEXT NOT NULL,
      creador    TEXT NOT NULL,
      idioma     TEXT NOT NULL DEFAULT 'es',
      tipo       TEXT NOT NULL DEFAULT 'private',
      permanente BOOLEAN DEFAULT FALSE,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS messages (
      id           SERIAL PRIMARY KEY,
      id_mensaje   TEXT NOT NULL,
      canal_codigo TEXT NOT NULL REFERENCES channels(codigo) ON DELETE CASCADE,
      username     TEXT NOT NULL,
      idioma       TEXT NOT NULL DEFAULT 'en',
      texto        TEXT NOT NULL,
      original_text TEXT,
      translations JSONB,
      editado      BOOLEAN DEFAULT FALSE,
      timestamp    TIMESTAMPTZ DEFAULT NOW()
    )
  `);

  // canal publico permanente que siempre debe existir
  await pool.query(`
    INSERT INTO channels (codigo, nombre, creador, idioma, tipo, permanente)
    VALUES ('PUB-MAIN', 'Canal General', 'VozTranslate', 'es', 'public', true)
    ON CONFLICT (codigo) DO NOTHING
  `);

  console.log('✅ DB: tablas users, channels y messages listas');
}

// carga todos los canales guardados en la db
export async function loadChannels() {
  const { rows } = await pool.query('SELECT * FROM channels ORDER BY created_at ASC');
  return rows;
}

// guarda un canal nuevo en la db
export async function saveChannel({ codigo, nombre, creador, idioma, tipo, permanente }) {
  await pool.query(
    `INSERT INTO channels (codigo, nombre, creador, idioma, tipo, permanente)
     VALUES ($1, $2, $3, $4, $5, $6)
     ON CONFLICT (codigo) DO NOTHING`,
    [codigo, nombre, creador, idioma, tipo, permanente || false]
  );
}

// elimina un canal (solo los no permanentes)
export async function deleteChannel(codigo) {
  await pool.query('DELETE FROM channels WHERE codigo = $1 AND permanente = false', [codigo]);
}

// guarda un mensaje en la db
export async function saveMessage({ idMensaje, canalCodigo, username, idioma, texto, originalText, translations }) {
  await pool.query(
    `INSERT INTO messages (id_mensaje, canal_codigo, username, idioma, texto, original_text, translations)
     VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [idMensaje, canalCodigo, username, idioma, texto, originalText || texto, JSON.stringify(translations || {})]
  );
}

// actualiza el texto de un mensaje editado
export async function updateMessage({ idMensaje, texto, translations }) {
  await pool.query(
    `UPDATE messages SET texto = $1, translations = $2, editado = true WHERE id_mensaje = $3`,
    [texto, JSON.stringify(translations || {}), idMensaje]
  );
}

// trae el historial de mensajes de un canal (ultimos 50)
export async function getChannelHistory(canalCodigo) {
  const { rows } = await pool.query(
    `SELECT * FROM (
       SELECT * FROM messages WHERE canal_codigo = $1 ORDER BY timestamp DESC LIMIT 50
     ) sub ORDER BY timestamp ASC`,
    [canalCodigo]
  );
  return rows.map(row => ({
    idMensaje:    row.id_mensaje,
    username:     row.username,
    idioma:       row.idioma,
    texto:        row.texto,
    originalText: row.original_text,
    translations: row.translations,
    editado:      row.editado,
    timestamp:    row.timestamp,
  }));
}

// trae mensajes MÁS VIEJOS que un timestamp dado (para el scroll infinito)
// el frontend manda el timestamp del mensaje más antiguo que ya tiene
export async function getChannelHistoryBefore(canalCodigo, beforeTimestamp, limit = 20) {
  const { rows } = await pool.query(
    `SELECT * FROM (
       SELECT * FROM messages
       WHERE canal_codigo = $1 AND timestamp < $2
       ORDER BY timestamp DESC LIMIT $3
     ) sub ORDER BY timestamp ASC`,
    [canalCodigo, beforeTimestamp, limit]
  );
  return rows.map(row => ({
    idMensaje:    row.id_mensaje,
    username:     row.username,
    idioma:       row.idioma,
    texto:        row.texto,
    originalText: row.original_text,
    translations: row.translations,
    editado:      row.editado,
    timestamp:    row.timestamp,
  }));
}

// trae mensajes en un rango de fechas para exportar el historial (maximo 500)
// solo para usuarios pro, el servidor verifica eso antes de llamar esta función
export async function getMessagesForExport(canalCodigo, from, to) {
  const { rows } = await pool.query(
    `SELECT * FROM messages
     WHERE canal_codigo = $1
       AND timestamp >= $2
       AND timestamp <= $3
     ORDER BY timestamp ASC
     LIMIT 500`,
    [canalCodigo, from, to]
  );
  return rows.map(row => ({
    idMensaje:    row.id_mensaje,
    username:     row.username,
    idioma:       row.idioma,
    texto:        row.texto,
    originalText: row.original_text,
    translations: row.translations,
    editado:      row.editado,
    timestamp:    row.timestamp,
  }));
}
