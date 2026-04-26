// ──────────────────────────────────────────────────────────────────────────────
// CreateChannelModal.jsx — Modal para crear un nuevo canal privado
//
// Este componente muestra un formulario donde el usuario ingresa el nombre del
// canal y el idioma principal. Al enviarlo, le pide al servidor que lo cree
// via Socket.io. Si tiene éxito, muestra el código de invitación generado.
// ──────────────────────────────────────────────────────────────────────────────

import { useState, useEffect } from 'react';
import { CheckCircle2, Copy, Check, AlertTriangle, Sparkles } from 'lucide-react';
import { socket } from '../services/socket';

// Lista de idiomas disponibles para el canal
const IDIOMAS = [
  { valor: 'es', etiqueta: '🇨🇱 Español' },
  { valor: 'en', etiqueta: '🇺🇸 Inglés' },
  { valor: 'pt', etiqueta: '🇧🇷 Portugués' },
  { valor: 'fr', etiqueta: '🇫🇷 Francés' },
  { valor: 'de', etiqueta: '🇩🇪 Alemán' },
  { valor: 'it', etiqueta: '🇮🇹 Italiano' },
  { valor: 'zh', etiqueta: '🇨🇳 Chino' },
  { valor: 'ja', etiqueta: '🇯🇵 Japonés' },
];

// ── Componente principal ──────────────────────────────────────────────────────
// Props recibidas:
//   profile   → objeto del usuario autenticado (necesitamos profile.username)
//   onCerrar  → función para cerrar este modal
export default function CreateChannelModal({ profile, onCerrar }) {
  // Estado del formulario
  const [nombre, setNombre]   = useState('');
  const [idioma, setIdioma]   = useState('es');

  // Estado de la UI
  const [cargando, setCargando] = useState(false);
  const [error, setError]       = useState('');

  // Estado del canal recién creado (para mostrar la pantalla de éxito)
  const [canalCreado, setCanalCreado] = useState(null);

  // Estado del botón "Copiar" del código de invitación
  const [copiado, setCopiado] = useState(false);

  // ── Escuchar respuesta del servidor al crear canal ────────────────────────
  // useEffect con cleanup: registramos el listener al montar y lo quitamos al desmontar.
  // Esto evita que los listeners se acumulen si el componente se vuelve a renderizar.
  useEffect(() => {
    const manejarRespuesta = (respuesta) => {
      setCargando(false);

      if (respuesta.exito) {
        // El canal se creó correctamente → mostramos la pantalla de éxito
        setCanalCreado(respuesta.canal);
      } else {
        // El servidor rechazó la creación (ej: límite alcanzado)
        setError(respuesta.error);
      }
    };

    socket.on('create-channel-response', manejarRespuesta);

    // Cleanup: cuando el componente se desmonte, quitamos este listener
    return () => {
      socket.off('create-channel-response', manejarRespuesta);
    };
  }, []);

  // ── Enviar el formulario ──────────────────────────────────────────────────
  const handleEnviar = (e) => {
    e.preventDefault(); // evitamos que la página se recargue
    setError('');

    // Validación básica en el frontend antes de ir al servidor
    if (!nombre.trim()) {
      setError('El nombre del canal no puede estar vacío.');
      return;
    }

    setCargando(true);

    // Nos aseguramos de estar conectados antes de emitir el evento
    if (!socket.connected) socket.connect();

    // Emitir el evento al servidor con los datos del canal
    socket.emit('create-channel', {
      nombre:  nombre.trim(),
      idioma,
      creador: profile.username,
    });
  };

  // ── Copiar código al portapapeles ─────────────────────────────────────────
  const handleCopiar = () => {
    navigator.clipboard.writeText(canalCreado.codigo).then(() => {
      setCopiado(true);
      // Después de 2 segundos, el botón vuelve a su estado normal
      setTimeout(() => setCopiado(false), 2000);
    });
  };

  // ── Pantalla de éxito (se muestra tras crear el canal) ───────────────────
  if (canalCreado) {
    return (
      <div className="modal-overlay" onClick={onCerrar}>
        <div className="modal-box" onClick={(e) => e.stopPropagation()}>
          <div className="success-screen">
            <span className="success-icon"><CheckCircle2 size={40} /></span>
            <h2>¡Canal creado!</h2>

            <p>
              Comparte este código con las personas que quieras invitar a
              <strong> {canalCreado.nombre}</strong>:
            </p>
            <div className="invite-code-box">
              <span className="invite-code-text">{canalCreado.codigo}</span>
              <button
                className={`btn-copy ${copiado ? 'copied' : ''}`}
                onClick={handleCopiar}
              >
                {copiado ? <><Check size={13} /> Copiado</> : <><Copy size={13} /> Copiar</>}
              </button>
            </div>

            <button className="btn-primary" onClick={onCerrar}>
              Entendido
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── Formulario de creación ────────────────────────────────────────────────
  return (
    <div className="modal-overlay" onClick={onCerrar}>
      <div className="modal-box" onClick={(e) => e.stopPropagation()}>
        <h2><Sparkles size={18} /> Crear Canal</h2>
        <p className="modal-subtitle">
          Puedes tener hasta <strong>2 canales privados</strong>. El canal público es provisto por la plataforma.
        </p>

        <form className="modal-form" onSubmit={handleEnviar}>

          {/* Campo: nombre del canal */}
          <div className="form-group">
            <label htmlFor="input-canal-nombre">Nombre del Canal</label>
            <input
              id="input-canal-nombre"
              type="text"
              className="form-field"
              placeholder="Ej: Equipo de Marketing"
              maxLength={40}
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              disabled={cargando}
              autoFocus
            />
          </div>

          {/* Campo: idioma principal */}
          <div className="form-group">
            <label htmlFor="select-canal-idioma">Idioma Principal</label>
            <select
              id="select-canal-idioma"
              className="form-field"
              value={idioma}
              onChange={(e) => setIdioma(e.target.value)}
              disabled={cargando}
            >
              {IDIOMAS.map((op) => (
                <option key={op.valor} value={op.valor}>
                  {op.etiqueta}
                </option>
              ))}
            </select>
          </div>

          {/* Mensaje de error (aparece solo si hay un error) */}
          {error && (
            <div className="error-banner" role="alert">
              <AlertTriangle size={14} />
              <span>{error}</span>
            </div>
          )}

          {/* Botones: cancelar y crear */}
          <div className="modal-actions">
            <button
              type="button"
              className="btn-secondary"
              onClick={onCerrar}
              disabled={cargando}
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="btn-primary"
              disabled={cargando || !nombre.trim()}
            >
              {cargando ? <span className="spinner" /> : 'Crear Canal →'}
            </button>
          </div>

        </form>
      </div>
    </div>
  );
}
