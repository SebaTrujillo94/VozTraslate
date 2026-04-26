import { useState, useEffect, useRef } from 'react';
import { Eye, EyeOff, Zap, Crown, Lock, AlertTriangle, ArrowLeft, KeyRound, CheckCircle2 } from 'lucide-react';
import { TRANSLATIONS, getTranslation } from '../utils/i18n';
import { register, login, checkEmail, resetPassword } from '../services/api';
import './LoginScreen.css';

const LANGUAGES = [
  { code: 'es', label: 'Español', flag: '🇪🇸' },
  { code: 'en', label: 'English', flag: '🇺🇸' },
  { code: 'fr', label: 'Français', flag: '🇫🇷' },
  { code: 'pt', label: 'Português', flag: '🇧🇷' },
  { code: 'de', label: 'Deutsch', flag: '🇩🇪' },
  { code: 'it', label: 'Italiano', flag: '🇮🇹' },
  { code: 'zh', label: '中文', flag: '🇨🇳' },
  { code: 'ja', label: '日本語', flag: '🇯🇵' },
  { code: 'ko', label: '한국어', flag: '🇰🇷' },
  { code: 'ru', label: 'Русский', flag: '🇷🇺' },
  { code: 'ar', label: 'العربية', flag: '🇸🇦' },
  { code: 'hi', label: 'हिन्दी', flag: '🇮🇳' },
];

export default function LoginScreen({ onLogin }) {
  const [mode, setMode] = useState('login'); // modo actual: login o registro
  const [step, setStep] = useState(1); // paso del registro
  const [entering, setEntering] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // variables para login o registro
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [username, setUsername] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // configuracion del perfil

  const [language, setLanguage] = useState('en');
  const [displayName, setDisplayName] = useState('');
  const [avatarUrl, setAvatarUrl] = useState(null);
  const [langOpen, setLangOpen] = useState(false);
  const fileRef = useRef(null);

  // tiempo de baneo de login

  const [lockoutMinutes, setLockoutMinutes] = useState(0);
  const [resetDone, setResetDone] = useState(false);

  // ir cambiando las frases cada cierto tiempo
  const [quote, setQuote] = useState({ q: 'Los límites de mi lenguaje son los límites de mi mundo.', a: 'Ludwig Wittgenstein' });

  useEffect(() => {
    const quotes = [
      { q: 'El lenguaje es el mapa de carreteras de una cultura.', a: 'Rita Mae Brown' },
      { q: 'Tener otro idioma es poseer una segunda alma.', a: 'Carlomagno' },
      { q: 'Un idioma diferente es una visión diferente de la vida.', a: 'Federico Fellini' },
      { q: 'Los límites de mi lenguaje son los límites de mi mundo.', a: 'Ludwig Wittgenstein' },
    ];
    let quoteIndex = 0;
    const cycleQuote = () => { setQuote(quotes[quoteIndex % quotes.length]); quoteIndex++; };
    cycleQuote();
    const interval = setInterval(cycleQuote, 15000);
    return () => clearInterval(interval);
  }, []);

  // contador de baneo
  useEffect(() => {
    if (lockoutMinutes <= 0) return;
    const interval = setInterval(() => {
      setLockoutMinutes(prev => {
        if (prev <= 1) { clearInterval(interval); return 0; }
        return prev - 1;
      });
    }, 60000);
    return () => clearInterval(interval);
  }, [lockoutMinutes]);

  // Browser back en paso 2 (registro o recuperación) → vuelve al paso 1
  useEffect(() => {
    const isStep2 = (mode === 'register' || mode === 'forgot') && step === 2;
    if (!isStep2) return;
    window.history.pushState({ _nav: 'step2' }, '');
    const handler = () => setStep(1);
    window.addEventListener('popstate', handler);
    return () => window.removeEventListener('popstate', handler);
  }, [step, mode]);

  // Browser back en paso 1 del forgot → vuelve al login
  useEffect(() => {
    if (mode !== 'forgot' || step !== 1) return;
    window.history.pushState({ _nav: 'forgot' }, '');
    const handler = () => switchMode('login');
    window.addEventListener('popstate', handler);
    return () => window.removeEventListener('popstate', handler);
  }, [mode, step]); // eslint-disable-line react-hooks/exhaustive-deps

  const t = (key) => getTranslation(language, key);

  const handleAvatarUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) { alert('Max 2MB'); return; }
    const reader = new FileReader();
    reader.onload = (ev) => setAvatarUrl(ev.target.result);
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const switchMode = (newMode) => {
    setMode(newMode);
    setStep(1);
    setError('');
    setEmail('');
    setPassword('');
    setConfirmPassword('');
    setUsername('');
    setResetDone(false);
  };

  // funcion para entrar a la cuenta
  const handleLogin = async (e) => {
    e.preventDefault();
    if (!email.trim() || !password) return;
    setError('');
    setLoading(true);

    try {
      const data = await login({ email: email.trim(), password });
      setEntering(true);
      setTimeout(() => {
        onLogin({
          ...data.user,
          language: data.user.preferredLanguage || 'en',
          avatarUrl: data.user.avatarUrl,
        });
      }, 600);
    } catch (err) {
      if (err.status === 423) {
        setLockoutMinutes(err.data?.minutes_remaining || 15);
        setError(`Account locked. Try again in ${err.data?.minutes_remaining || 15} minutes.`);
      } else if (err.status === 401) {
        const remaining = err.data?.attempts_remaining;
        setError(
          remaining !== undefined
            ? `Invalid email or password. ${remaining} attempt${remaining !== 1 ? 's' : ''} remaining.`
            : 'Invalid email or password.'
        );
      } else {
        setError(err.message || 'Login failed');
      }
    } finally {
      setLoading(false);
    }
  };

  // pasar al paso 2 de registro
  const handleRegisterStep1 = async (e) => {
    e.preventDefault();
    setError('');

    // validaciones en javascript primero
    if (!email.trim() || !password || !username.trim()) {
      setError('All fields are required');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }
    if (!/[A-Z]/.test(password)) {
      setError('Password must contain at least one uppercase letter');
      return;
    }
    if (!/[0-9]/.test(password)) {
      setError('Password must contain at least one number');
      return;
    }

    // seguimos al paso 2
    setStep(2);
  };

  // terminar de registrarse
  const handleRegisterComplete = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const data = await register({
        email: email.trim(),
        password,
        username: username.trim().toLowerCase(),
        displayName: displayName.trim() || username.trim(),
        preferredLanguage: language,
      });

      setEntering(true);
      setTimeout(() => {
        onLogin({
          ...data.user,
          language: data.user.preferredLanguage || language,
          avatarUrl: avatarUrl || data.user.avatarUrl,
        });
      }, 600);
    } catch (err) {
      if (err.status === 409) {
        setStep(1);
        setError(err.message || 'Email or username already exists');
      } else {
        setError(err.message || 'Registration failed');
      }
    } finally {
      setLoading(false);
    }
  };

  // paso 1 de recuperar contraseña: verificar que el correo exista
  const handleForgotStep1 = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await checkEmail(email.trim());
      setStep(2);
    } catch (err) {
      setError(err.message || 'Correo no encontrado');
    } finally {
      setLoading(false);
    }
  };

  // paso 2: guardar nueva contraseña
  const handleForgotStep2 = async (e) => {
    e.preventDefault();
    setError('');
    if (password !== confirmPassword) { setError('Las contraseñas no coinciden'); return; }
    if (password.length < 8)          { setError('Mínimo 8 caracteres'); return; }
    if (!/[A-Z]/.test(password))      { setError('Debe tener al menos una mayúscula'); return; }
    if (!/[0-9]/.test(password))      { setError('Debe tener al menos un número'); return; }
    setLoading(true);
    try {
      await resetPassword({ email: email.trim(), newPassword: password });
      setResetDone(true);
    } catch (err) {
      setError(err.message || 'Error al restablecer');
    } finally {
      setLoading(false);
    }
  };

  const currentLang = LANGUAGES.find(l => l.code === language) || LANGUAGES[0];

  return (
    <div className={`login-container ${entering ? 'exit' : ''}`}>
      <div className="login-card">
        {/* Logo */}
        <div className="login-logo">
          <div className="login-logo-icon">
            <svg viewBox="0 0 48 48" fill="none">
              <circle cx="24" cy="24" r="22" stroke="url(#lg1)" strokeWidth="2.5" fill="none" />
              <path d="M16 18C16 18 18 14 24 14C30 14 32 18 32 18" stroke="url(#lg1)" strokeWidth="2.5" strokeLinecap="round" />
              <circle cx="17" cy="24" r="3" fill="url(#lg1)" opacity="0.8" />
              <circle cx="31" cy="24" r="3" fill="url(#lg2)" opacity="0.8" />
              <path d="M20 30C20 30 21.5 32 24 32C26.5 32 28 30 28 30" stroke="url(#lg1)" strokeWidth="2" strokeLinecap="round" />
              <defs>
                <linearGradient id="lg1" x1="0" y1="0" x2="48" y2="48"><stop stopColor="#7c3aed" /><stop offset="1" stopColor="#3b82f6" /></linearGradient>
                <linearGradient id="lg2" x1="0" y1="0" x2="48" y2="48"><stop stopColor="#3b82f6" /><stop offset="1" stopColor="#06b6d4" /></linearGradient>
              </defs>
            </svg>
          </div>
          <h1 className="login-title">VozTranslate</h1>
          <p className="login-subtitle">Traducción de voz en tiempo real</p>
        </div>

        {/* Mode Tabs — ocultos en flujo de recuperación */}
        <div className={`auth-tabs ${mode === 'forgot' ? 'hidden-tabs' : ''}`}>
          <button
            type="button"
            className={`auth-tab ${mode === 'login' ? 'active' : ''}`}
            onClick={() => switchMode('login')}
          >
            Iniciar Sesión
          </button>
          <button
            type="button"
            className={`auth-tab ${mode === 'register' ? 'active' : ''}`}
            onClick={() => switchMode('register')}
          >
            Registrarse
          </button>
        </div>

        {/* Step indicator (register + forgot) */}
        {(mode === 'register' || mode === 'forgot') && (
          <div className="login-steps">
            <div className={`step-dot ${step >= 1 ? 'active' : ''}`} />
            <div className="step-line" />
            <div className={`step-dot ${step >= 2 ? 'active' : ''}`} />
          </div>
        )}

        {/* Error message */}
        {error && (
          <div className="auth-error">
            <AlertTriangle size={14} className="auth-error-icon" />
            <span>{error}</span>
          </div>
        )}

        {/* Lockout warning */}
        {lockoutMinutes > 0 && (
          <div className="auth-lockout">
            <Lock size={14} /> Cuenta bloqueada por {lockoutMinutes} minuto{lockoutMinutes !== 1 ? 's' : ''}
          </div>
        )}

        {/* form de login */}
        {mode === 'login' && (
          <form onSubmit={handleLogin} className="login-form step-anim" id="login-form">
            <div className="login-field">
              <label className="login-label" htmlFor="login-email">Correo Electrónico</label>
              <input
                id="login-email"
                type="email"
                className="login-input"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoFocus
                required
                disabled={lockoutMinutes > 0}
              />
            </div>
            <div className="login-field">
              <label className="login-label" htmlFor="login-password">Contraseña</label>
              <div className="password-wrapper">
                <input
                  id="login-password"
                  type={showPassword ? 'text' : 'password'}
                  className="login-input"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  disabled={lockoutMinutes > 0}
                />
                <button
                  type="button"
                  className="password-toggle"
                  onClick={() => setShowPassword(!showPassword)}
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>
            <button
              type="button"
              className="forgot-link"
              onClick={() => { setEmail(''); switchMode('forgot'); }}
            >
              ¿Olvidaste tu contraseña?
            </button>
            <button
              id="login-submit"
              type="submit"
              className="login-submit"
              disabled={loading || !email.trim() || !password || lockoutMinutes > 0}
            >
              {loading ? (
                <span className="login-loading"><span /><span /><span /></span>
              ) : (
                <>Ingresar <span className="login-arrow">→</span></>
              )}
            </button>
          </form>
        )}

        {/* form paso 1 de registro */}
        {mode === 'register' && step === 1 && (
          <form onSubmit={handleRegisterStep1} className="login-form step-anim" id="register-form">
            <div className="login-field">
              <label className="login-label" htmlFor="register-email">Correo Electrónico</label>
              <input
                id="register-email"
                type="email"
                className="login-input"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoFocus
                required
              />
            </div>
            <div className="login-field">
              <label className="login-label" htmlFor="register-username">Nombre de Usuario</label>
              <input
                id="register-username"
                type="text"
                className="login-input"
                placeholder="tu_usuario"
                value={username}
                onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/\s/g, '_'))}
                maxLength={20}
                required
              />
              <span className="login-hint">3-20 caracteres, letras, números, guiones bajos</span>
            </div>
            <div className="login-field">
              <label className="login-label" htmlFor="register-password">Contraseña</label>
              <div className="password-wrapper">
                <input
                  id="register-password"
                  type={showPassword ? 'text' : 'password'}
                  className="login-input"
                  placeholder="Mínimo 8 letras, 1 mayúscula, 1 número"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
                <button
                  type="button"
                  className="password-toggle"
                  onClick={() => setShowPassword(!showPassword)}
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              {/* mostrar si cumple con las letras y numeros de la clave */}
              <div className="password-requirements">
                <span className={password.length >= 8 ? 'met' : ''}>✓ 8+ caracteres</span>
                <span className={/[A-Z]/.test(password) ? 'met' : ''}>✓ Mayúscula</span>
                <span className={/[0-9]/.test(password) ? 'met' : ''}>✓ Número</span>
              </div>
            </div>
            <div className="login-field">
              <label className="login-label" htmlFor="register-confirm-password">Confirmar Contraseña</label>
              <input
                id="register-confirm-password"
                type="password"
                className="login-input"
                placeholder="Repite tu contraseña"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
              />
              {confirmPassword && password !== confirmPassword && (
                <span className="login-hint error-hint">Las contraseñas no coinciden</span>
              )}
            </div>
            <button
              id="register-next"
              type="submit"
              className="login-submit"
              disabled={!email.trim() || !password || !confirmPassword || !username.trim()}
            >
              Continuar <span className="login-arrow">→</span>
            </button>
          </form>
        )}

        {/* form paso 2 configurando el perfil */}
        {mode === 'register' && step === 2 && (
          <form onSubmit={handleRegisterComplete} className="login-form step-anim" id="register-profile-form">

            {/* Idioma: grid directo sin acordeón */}
            <div className="login-field">
              <label className="login-label">Idioma Principal</label>
              <div className="reg-lang-grid">
                {LANGUAGES.map((lang) => {
                  const libre = lang.code === 'es' || lang.code === 'en';
                  return (
                    <button
                      key={lang.code}
                      type="button"
                      className={`reg-lang-chip ${language === lang.code ? 'selected' : ''} ${!libre ? 'locked-lang' : ''}`}
                      onClick={() => libre && setLanguage(lang.code)}
                      title={!libre ? 'Disponible en Plan Pro' : lang.label}
                      disabled={!libre}
                    >
                      <span className="reg-lang-flag">{lang.flag}</span>
                      <span className="reg-lang-label">{lang.label}</span>
                      {!libre && <span className="reg-lang-lock"><Lock size={10} /></span>}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Nombre + Avatar en una fila */}
            <div className="login-field">
              <label className="login-label" htmlFor="register-display-name">Nombre a Mostrar</label>
              <div className="reg-name-row">
                <input
                  id="register-display-name"
                  type="text"
                  className="login-input"
                  placeholder="Cómo te verán los demás"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  maxLength={50}
                />
                <div
                  className="login-avatar reg-avatar-sm"
                  onClick={() => fileRef.current?.click()}
                  title="Subir foto de perfil"
                >
                  {avatarUrl
                    ? <img src={avatarUrl} alt="avatar" className="login-avatar-img" />
                    : <span className="reg-avatar-initial">
                        {(displayName || username)?.[0]?.toUpperCase() || '＋'}
                      </span>
                  }
                  <div className="login-avatar-overlay">
                    {avatarUrl ? 'Cambiar' : 'Foto'}
                  </div>
                </div>
              </div>
              <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleAvatarUpload} />
              <span className="login-hint">Opcional · foto máx 2 MB</span>
            </div>

            {/* Plan */}
            <div className="login-field">
              <label className="login-label">Plan</label>
              <div className="reg-plan-row">
                <div className="reg-plan-card reg-plan-free">
                  <span className="reg-plan-icon"><Zap size={18} /></span>
                  <strong className="reg-plan-name">Free</strong>
                  <ul className="reg-plan-features">
                    <li>Historial 24 horas</li>
                    <li>Hasta 2 canales</li>
                    <li>ES / EN</li>
                  </ul>
                  <span className="reg-plan-status active">Seleccionado</span>
                </div>
                <div className="reg-plan-card reg-plan-pro" title="Próximamente">
                  <span className="reg-plan-icon"><Crown size={18} /></span>
                  <strong className="reg-plan-name">Pro</strong>
                  <ul className="reg-plan-features">
                    <li>Historial 30 días</li>
                    <li>Canales ilimitados</li>
                    <li>+10 idiomas</li>
                  </ul>
                  <span className="reg-plan-status locked"><Lock size={11} /> Pronto</span>
                </div>
              </div>
            </div>

            <div className="login-form-actions">
              <button type="button" className="login-back" onClick={() => setStep(1)}><ArrowLeft size={14} /> Atrás</button>
              <button
                id="register-submit"
                type="submit"
                className="login-submit"
                style={{ flex: 1 }}
                disabled={loading}
              >
                {loading
                  ? <span className="login-loading"><span /><span /><span /></span>
                  : 'Crear Cuenta'}
              </button>
            </div>
          </form>
        )}

        {/* ── Recuperar contraseña paso 1: ingresar correo ───────────── */}
        {mode === 'forgot' && step === 1 && !resetDone && (
          <form onSubmit={handleForgotStep1} className="login-form step-anim">
            <p className="forgot-desc">
              Ingresa tu correo y te permitiremos crear una nueva contraseña.
            </p>
            <div className="login-field">
              <label className="login-label" htmlFor="forgot-email">Correo Electrónico</label>
              <input
                id="forgot-email"
                type="email"
                className="login-input"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoFocus
                required
                disabled={loading}
              />
            </div>
            <div className="login-form-actions">
              <button type="button" className="login-back" onClick={() => switchMode('login')}>
                <ArrowLeft size={14} /> Volver
              </button>
              <button
                type="submit"
                className="login-submit"
                style={{ flex: 1 }}
                disabled={loading || !email.trim()}
              >
                {loading
                  ? <span className="login-loading"><span /><span /><span /></span>
                  : 'Continuar →'}
              </button>
            </div>
          </form>
        )}

        {/* ── Recuperar contraseña paso 2: nueva contraseña ──────────── */}
        {mode === 'forgot' && step === 2 && !resetDone && (
          <form onSubmit={handleForgotStep2} className="login-form step-anim">
            <p className="forgot-desc">
              Crea una nueva contraseña para <strong>{email}</strong>.
            </p>
            <div className="login-field">
              <label className="login-label" htmlFor="forgot-new-pass">Nueva Contraseña</label>
              <div className="password-wrapper">
                <input
                  id="forgot-new-pass"
                  type={showPassword ? 'text' : 'password'}
                  className="login-input"
                  placeholder="Mínimo 8 letras, 1 mayúscula, 1 número"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoFocus
                  required
                  disabled={loading}
                />
                <button type="button" className="password-toggle" onClick={() => setShowPassword(!showPassword)} tabIndex={-1}>
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              <div className="password-requirements">
                <span className={password.length >= 8 ? 'met' : ''}>✓ 8+ caracteres</span>
                <span className={/[A-Z]/.test(password) ? 'met' : ''}>✓ Mayúscula</span>
                <span className={/[0-9]/.test(password) ? 'met' : ''}>✓ Número</span>
              </div>
            </div>
            <div className="login-field">
              <label className="login-label" htmlFor="forgot-confirm-pass">Confirmar Contraseña</label>
              <input
                id="forgot-confirm-pass"
                type="password"
                className="login-input"
                placeholder="Repite tu nueva contraseña"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                disabled={loading}
              />
              {confirmPassword && password !== confirmPassword && (
                <span className="login-hint error-hint">Las contraseñas no coinciden</span>
              )}
            </div>
            <div className="login-form-actions">
              <button type="button" className="login-back" onClick={() => setStep(1)}>
                <ArrowLeft size={14} /> Atrás
              </button>
              <button
                type="submit"
                className="login-submit"
                style={{ flex: 1 }}
                disabled={loading || !password || !confirmPassword}
              >
                {loading
                  ? <span className="login-loading"><span /><span /><span /></span>
                  : <><KeyRound size={15} /> Restablecer</>}
              </button>
            </div>
          </form>
        )}

        {/* ── Contraseña restablecida con éxito ──────────────────────── */}
        {mode === 'forgot' && resetDone && (
          <div className="forgot-success step-anim">
            <CheckCircle2 size={44} className="forgot-success-icon" />
            <h3>¡Contraseña actualizada!</h3>
            <p>Ya puedes iniciar sesión con tu nueva contraseña.</p>
            <button className="login-submit" onClick={() => switchMode('login')}>
              Ir al inicio de sesión
            </button>
          </div>
        )}

        {/* frase random abajo */}
        <div className="login-quote" key={quote.q}>
          <p className="quote-text">"{quote.q}"</p>
          <p className="quote-author">— {quote.a}</p>
        </div>
      </div>
    </div>
  );
}
