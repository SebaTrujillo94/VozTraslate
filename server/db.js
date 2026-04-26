// db.js - conexion a la base de datos postgres
// usamos pg porque es lo que vimos en clases y funciona bien con node

import pg from 'pg';
import dotenv from 'dotenv';
dotenv.config();

const { Pool } = pg;

// el pool maneja multiples conexiones sin tener que abrir una nueva cada vez
export const pool = new Pool({ connectionString: process.env.DATABASE_URL });

// crea la tabla users si no existe todavia
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
      created_at   TIMESTAMPTZ DEFAULT NOW()
    )
  `);
  console.log('✅ DB: tabla users lista');
}
