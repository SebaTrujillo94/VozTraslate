// commands.js — comandos personalizados de Cypress para VozTraslate
// Evitamos repetir el flujo de registro/login en cada test
// Documentación: https://docs.cypress.io/api/cypress-api/custom-commands

const API_URL = 'http://localhost:3001';

// ── cy.registrarUsuario(data) ────────────────────────────────────────────────
// Registra un usuario nuevo vía API y devuelve { token, user }
// No visita ninguna página, solo hace la llamada REST
Cypress.Commands.add('registrarUsuario', ({ email, username, password = 'TestPass123!', preferredLanguage = 'es' }) => {
  return cy.request({
    method: 'POST',
    url: `${API_URL}/api/auth/register`,
    body: {
      email,
      username,
      displayName: username,
      password,
      preferredLanguage,
    },
    // no fallar si hay error HTTP (para tests de validación)
    failOnStatusCode: false,
  });
});

// ── cy.loginConRegistro(sufijo) ──────────────────────────────────────────────
// El comando más usado: registra un usuario único y carga la app autenticado.
// Usa timestamp + sufijo para que cada test tenga su propio usuario.
// Al terminar el comando el navegador ya está en '/' mostrando el dashboard.
Cypress.Commands.add('loginConRegistro', (sufijo = '') => {
  const ts       = Date.now();
  const email    = `test${ts}${sufijo}@voztranslate.test`;
  const username = `test${ts}${sufijo}`;

  return cy.request({
    method: 'POST',
    url: `${API_URL}/api/auth/register`,
    body: {
      email,
      username,
      displayName: `Test ${sufijo || ts}`,
      password: 'TestPass123!',
      preferredLanguage: 'es',
    },
  }).then((resp) => {
    const token = resp.body.token;

    // onBeforeLoad se ejecuta ANTES de que React inicie
    // así el token ya está en localStorage cuando la app lo busca
    cy.visit('/', {
      onBeforeLoad: (win) => {
        win.localStorage.setItem('voztranslate_token', token);
      },
    });

    // esperamos a que la app cargue el perfil del servidor
    cy.get('.dashboard-wrapper', { timeout: 12000 }).should('be.visible');

    // devolvemos el usuario para que el test pueda usarlo si necesita
    return cy.wrap(resp.body.user);
  });
});

// ── cy.loginComoProSimulado(sufijo) ─────────────────────────────────────────
// Como loginConRegistro pero intercepta GET /api/auth/me para devolver plan='pro'
// Así podemos testear funciones Pro sin tocar la base de datos
Cypress.Commands.add('loginComoProSimulado', (sufijo = '') => {
  const ts       = Date.now();
  const email    = `protest${ts}${sufijo}@voztranslate.test`;
  const username = `protest${ts}${sufijo}`;

  return cy.request({
    method: 'POST',
    url: `${API_URL}/api/auth/register`,
    body: {
      email,
      username,
      displayName: `Pro Test ${sufijo}`,
      password: 'TestPass123!',
      preferredLanguage: 'es',
    },
  }).then((resp) => {
    const token   = resp.body.token;
    const usuario = resp.body.user;

    // interceptamos ANTES de visitar la página para que el mock esté listo
    // cuando la app llame a GET /api/auth/me, recibirá plan='pro'
    cy.intercept('GET', `${API_URL}/api/auth/me`, {
      statusCode: 200,
      body: { user: { ...usuario, plan: 'pro' } },
    }).as('getMe');

    cy.visit('/', {
      onBeforeLoad: (win) => {
        win.localStorage.setItem('voztranslate_token', token);
      },
    });

    cy.get('.dashboard-wrapper', { timeout: 12000 }).should('be.visible');

    return cy.wrap({ ...usuario, plan: 'pro' });
  });
});

// ── cy.unirseAlCanalPublico() ────────────────────────────────────────────────
// Hace clic en el Canal General desde el dashboard y espera el chat
// Precondición: ya hay que estar en el dashboard (usar loginConRegistro antes)
Cypress.Commands.add('unirseAlCanalPublico', () => {
  // el canal público siempre tiene esta card visible en el dashboard
  cy.get('.channel-card.public').click();

  // esperamos que aparezca la vista de chat (puede tardar por Socket.io)
  cy.get('.channel-chat-view', { timeout: 15000 }).should('be.visible');
});
