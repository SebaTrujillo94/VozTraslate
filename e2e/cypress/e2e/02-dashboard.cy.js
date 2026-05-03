// 02-dashboard.cy.js — Pruebas del Dashboard principal
// Verificamos que al entrar autenticado se vea el panel de canales correctamente.

describe('Dashboard de Canales', () => {

  // antes de cada test nos autenticamos y cargamos el dashboard
  beforeEach(() => {
    cy.loginConRegistro('dash');
  });

  // ── Test 1: El dashboard muestra el saludo personalizado ──────────────────
  it('muestra el saludo con el nombre del usuario', () => {
    cy.get('.dashboard-header h1').should('contain', 'Hola,');
  });

  // ── Test 2: El Canal General siempre debe estar visible ───────────────────
  it('muestra el Canal General (canal público permanente)', () => {
    cy.get('.channel-card.public').should('be.visible');
    cy.get('.channel-card.public').should('contain', 'Canal General');
  });

  // ── Test 3: El strip de "Unirse con código" debe estar ─────────────────────
  it('muestra el strip para unirse con un código de invitación', () => {
    cy.get('.join-code-strip').should('be.visible');
  });

  // ── Test 4: El banner de canales activos debe mostrarse ───────────────────
  it('muestra el banner con el número de canales activos', () => {
    // el punto verde parpadeante indica que hay conexión con el servidor
    cy.get('.stats-dot').should('be.visible');
    cy.get('.stats-banner').should('be.visible');
  });

  // ── Test 5: El botón de perfil de usuario debe ser accesible ──────────────
  it('muestra el avatar del usuario con su inicial', () => {
    cy.get('.greeting-avatar').should('be.visible');
    // el avatar contiene la inicial del nombre del usuario
    cy.get('.greeting-avatar').invoke('text').should('have.length.greaterThan', 0);
  });

  // ── Test 6: La sección de canales privados con botón de crear ─────────────
  it('muestra la opción para crear un canal privado', () => {
    // debe existir el botón/slot para crear un canal nuevo
    cy.contains('Crear').should('be.visible');
  });

  // ── Test 7: Hacer clic en el Canal General lleva al chat ──────────────────
  it('navega al chat al hacer clic en el Canal General', () => {
    cy.get('.channel-card.public').click();

    // esperamos que aparezca la vista del chat (puede tardar por Socket.io)
    cy.get('.channel-chat-view', { timeout: 15000 }).should('be.visible');

    // el código del canal público debe estar en la barra superior
    cy.get('.channel-chat-view').should('contain', 'PUB-MAIN');
  });

  // ── Test 8: El strip de unirse navega a la vista de código ────────────────
  it('hace clic en el strip de código y muestra el formulario de unirse', () => {
    cy.get('.join-code-strip').click();

    // debe aparecer el input para escribir el código
    cy.get('.code-input', { timeout: 6000 }).should('be.visible');
    cy.get('.code-input').should('have.attr', 'placeholder', 'XXX-XXXX');
  });

});
