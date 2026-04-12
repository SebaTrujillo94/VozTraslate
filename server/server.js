import express from 'express';
import cors from 'cors';
import { createServer } from 'http';

// servidor vacio inicial de pruebas
const app = express();
app.use(cors());
app.use(express.json());

// ruta de salud
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', mensaje: 'Servidor backend corriendo sin base de datos.' });
});

// cuando avancemos a la siguiente etapa, aqui iran los websockets
const httpServer = createServer(app);

const PORT = 3001;

httpServer.listen(PORT, () => {
  console.log(`\n☁️ Servidor de Desarrollo corriendo en el puerto ${PORT}`);
  console.log(`Pronto agregaremos la lógica del chat aquí.`);
});
