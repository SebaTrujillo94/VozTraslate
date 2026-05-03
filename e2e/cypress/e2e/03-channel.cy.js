// 03-channel.cy.js — Pruebas de la vista del canal de chat
// Verificamos que al entrar a un canal se vea la UI correctamente:
// barra superior, lista de mensajes, barra de escritura, etc.

describe('Vista del Canal de Chat', () => {

  // antes de cada test entramos al canal público
  beforeEach(() => {
    cy.loginConRegistro('canal');
    cy.unirseAlCanalPublico();
  });

  // ── Test 1: La barra superior muestra el nombre del canal ─────────────────
  it('muestra la barra superior con el nombre y código del canal', () => {
    cy.get('.chat-top-bar').should('be.visible');

    // el nombre del canal debe estar en la barra
    cy.get('.channel-chat-view').should('contain', 'Canal General');

    // el código del canal público debe ser PUB-MAIN
    cy.get('.code-value').should('contain', 'PUB-MAIN');
  });

  // ── Test 2: El contador de personas conectadas debe mostrarse ─────────────
  it('muestra el contador de personas conectadas', () => {
    cy.get('.people-count-badge').should('be.visible');

    // debe mostrar al menos 1 (el usuario que acaba de entrar)
    cy.get('.people-number').then((el) => {
      const num = parseInt(el.text());
      expect(num).to.be.at.least(1);
    });
  });

  // ── Test 3: La barra de miembros muestra al usuario actual ────────────────
  it('muestra al usuario actual en la barra de miembros', () => {
    // la barra de miembros solo aparece si hay alguien conectado
    cy.get('.members-bar', { timeout: 8000 }).should('be.visible');

    // el chip con "(tú)" debe aparecer para el usuario actual
    cy.get('.member-chip.yo').should('be.visible');
    cy.get('.member-chip.yo').should('contain', '(tú)');
  });

  // ── Test 4: La lista de mensajes existe y puede estar vacía ───────────────
  it('muestra la lista de mensajes del canal', () => {
    cy.get('.messages-list').should('be.visible');

    // si no hay mensajes, muestra el texto de "sé el primero"
    // si ya hay mensajes históricos, también es válido
    cy.get('.messages-list').should('not.be.empty');
  });

  // ── Test 5: La barra de escritura está disponible ─────────────────────────
  it('muestra la barra de escritura con el input y botón de enviar', () => {
    cy.get('.chat-input-bar').should('be.visible');

    // el input de texto debe existir y tener el placeholder correcto
    cy.get('.chat-input-bar input').should('be.visible');
    cy.get('.chat-input-bar input').should('have.attr', 'placeholder', 'Escribe un mensaje...');

    // el botón de enviar debe existir
    cy.get('.btn-send').should('be.visible');
  });

  // ── Test 6: El botón de micrófono está disponible ─────────────────────────
  it('muestra el botón de grabar mensajes de voz', () => {
    cy.get('.btn-record').should('be.visible');
  });

  // ── Test 7: El toggle de sonido funciona ──────────────────────────────────
  it('puede activar y desactivar el sonido con el botón', () => {
    cy.get('.btn-sound-toggle').should('be.visible');

    // hacemos clic para cambiar el estado
    cy.get('.btn-sound-toggle').click();

    // el botón sigue visible después del click (no desaparece)
    cy.get('.btn-sound-toggle').should('be.visible');
  });

  // ── Test 8: El botón de Salir abre el modal de confirmación ───────────────
  it('muestra modal de confirmación al hacer clic en Salir', () => {
    cy.get('.btn-back').click();

    // debe aparecer el modal con pregunta de confirmación
    cy.get('.exit-confirm-box').should('be.visible');
    cy.contains('¿Salir del canal?').should('be.visible');

    // botón de cancelar debe estar
    cy.contains('Cancelar').should('be.visible');
  });

  // ── Test 9: Cancelar salida mantiene al usuario en el canal ───────────────
  it('cancela la salida y sigue en el canal al hacer clic en Cancelar', () => {
    cy.get('.btn-back').click();
    cy.get('.exit-confirm-box').should('be.visible');

    // cancelamos
    cy.contains('Cancelar').click();

    // el modal se cierra y seguimos en el chat
    cy.get('.exit-confirm-box').should('not.exist');
    cy.get('.channel-chat-view').should('be.visible');
  });

  // ── Test 10: Confirmar salida vuelve al dashboard ─────────────────────────
  it('vuelve al dashboard al confirmar la salida del canal', () => {
    cy.get('.btn-back').click();
    cy.get('.exit-confirm-box').should('be.visible');

    // confirmamos la salida
    cy.contains('Salir').last().click();

    // debería aparecer el dashboard nuevamente
    cy.get('.dashboard-wrapper', { timeout: 8000 }).should('be.visible');
  });

  // ── Test 11: El input no puede enviar mensaje vacío ───────────────────────
  it('el botón de enviar está deshabilitado si el input está vacío', () => {
    // sin texto, el botón de enviar debe estar deshabilitado
    cy.get('.btn-send').should('be.disabled');

    // escribimos algo
    cy.get('.chat-input-bar input').type('Hola');

    // ahora el botón debe habilitarse
    cy.get('.btn-send').should('not.be.disabled');
  });

  // ── Test 12: Código inválido en el formulario de unirse muestra error ──────
  it('muestra error de validación con un código malformado', () => {
    // primero volvemos al dashboard para ir a la vista de código manual
    cy.get('.btn-back').click();
    cy.contains('Salir').last().click();

    // abrimos el formulario de código manual
    cy.get('.join-code-strip').click();

    // escribimos un código con formato incorrecto
    cy.get('.code-input').type('INVALIDO');

    // el validador debe mostrar que es inválido
    cy.get('.code-validator.invalid').should('be.visible');
  });

});
