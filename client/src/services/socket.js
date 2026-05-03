// ──────────────────────────────────────────────────────────────────────────────
// services/socket.js — Instancia compartida de Socket.io
//
// En vez de crear una conexión en cada componente, la creamos UNA sola vez
// aquí y la exportamos. Esto se llama patrón Singleton.
// ──────────────────────────────────────────────────────────────────────────────

import { io } from 'socket.io-client';

// Dirección del servidor backend (en desarrollo siempre es localhost:3001)
// Ahora usamos undefined para que tome el host actual y pase por el proxy de Vite o el host de ngrok
const URL_SERVIDOR = undefined;

// Creamos la conexión. La opción autoConnect: false le dice a Socket.io
// que NO se conecte automáticamente al importar este archivo.
// Nos conectaremos manualmente cuando sea necesario.
export const socket = io(URL_SERVIDOR, {
  autoConnect: false,
});
