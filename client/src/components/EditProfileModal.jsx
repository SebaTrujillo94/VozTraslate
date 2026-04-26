import { useState } from 'react';
import { Zap, Crown, Lock, UserCog, AlertTriangle } from 'lucide-react';
import { updateProfile } from '../services/api';

const LANGS = [
  { code: 'es', label: 'Español', flag: '🇪🇸' },
  { code: 'en', label: 'English', flag: '🇺🇸' },
];

export default function EditProfileModal({ profile, onClose, onSave }) {
  const [displayName, setDisplayName] = useState(profile.displayName || '');
  const [language, setLanguage]       = useState(
    ['es', 'en'].includes(profile.language) ? profile.language : 'en'
  );
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const { user } = await updateProfile({
        displayName:       displayName.trim() || profile.username,
        preferredLanguage: language,
      });
      onSave({
        displayName: user.displayName,
        language:    user.preferredLanguage,
      });
      onClose();
    } catch (err) {
      setError(err.message || 'Error al guardar');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box" onClick={(e) => e.stopPropagation()}>
        <h2><UserCog size={20} /> Editar Perfil</h2>
        <p className="modal-subtitle">
          El idioma preferido determina en qué idioma recibirás las traducciones.
        </p>

        <form className="modal-form" onSubmit={handleSubmit}>

          <div className="form-group">
            <label htmlFor="edit-display-name">Nombre a Mostrar</label>
            <input
              id="edit-display-name"
              type="text"
              className="form-field"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              maxLength={50}
              placeholder={profile.username}
              autoFocus
              disabled={loading}
            />
          </div>

          <div className="form-group">
            <label>Idioma Preferido</label>
            <div className="lang-selector-row">
              {LANGS.map((lang) => (
                <button
                  key={lang.code}
                  type="button"
                  className={`lang-btn ${language === lang.code ? 'selected' : ''}`}
                  onClick={() => setLanguage(lang.code)}
                  disabled={loading}
                >
                  {lang.flag} {lang.label}
                </button>
              ))}
            </div>
          </div>

          <div className="form-group">
            <label>Plan</label>
            <div className="plan-selector-row">
              <div className="plan-card plan-free active">
                <div className="plan-card-left">
                  <span className="plan-icon"><Zap size={16} /></span>
                  <div className="plan-info">
                    <strong>Free</strong>
                    <small>Historial 24h · hasta 2 canales</small>
                  </div>
                </div>
                <span className="plan-badge-active">Activo</span>
              </div>

              <div className="plan-card plan-pro locked" title="Próximamente">
                <div className="plan-card-left">
                  <span className="plan-icon"><Crown size={16} /></span>
                  <div className="plan-info">
                    <strong>Pro</strong>
                    <small>Historial 30 días · canales ilimitados</small>
                  </div>
                </div>
                <span className="plan-badge-locked"><Lock size={12} /> Próximamente</span>
              </div>
            </div>
          </div>

          {error && (
            <div className="error-banner" role="alert">
              <AlertTriangle size={14} />
              <span>{error}</span>
            </div>
          )}

          <div className="modal-actions">
            <button
              type="button"
              className="btn-secondary"
              onClick={onClose}
              disabled={loading}
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="btn-primary"
              disabled={loading}
            >
              {loading ? <span className="spinner" /> : 'Guardar'}
            </button>
          </div>

        </form>
      </div>
    </div>
  );
}
