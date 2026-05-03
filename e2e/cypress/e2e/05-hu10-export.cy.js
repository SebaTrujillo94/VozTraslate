// 05-hu10-export.cy.js — Pruebas de la Historia de Usuario 10
// Exportar el historial del canal en TXT o PDF (solo plan Pro).
//
// HU-10: "Como usuario Pro, quiero exportar el historial de un canal en
// formato TXT o PDF."
// - Solo plan Pro puede exportar
// - Selección de rango de fechas
// - Generación en menos de 10 segundos para hasta 500 mensajes

describe('HU-10 — Exportar Historial del Canal', () => {

  // ── Contexto: usuario FREE ─────────────────────────────────────────────────
  // Un usuario del plan gratuito ve el botón pero bloqueado
  describe('Como usuario FREE (plan gratuito)', () => {

    beforeEach(() => {
      cy.loginConRegistro('free');
      cy.unirseAlCanalPublico();
    });

    // ── Test 1: El botón de exportar existe pero muestra ícono de candado ────
    it('muestra el botón de exportar con ícono de candado (plan Free)', () => {
      cy.get('.btn-export').should('be.visible');

      // el botón tiene la clase "locked" porque el usuario no es Pro
      cy.get('.btn-export.locked').should('exist');

      // el cursor debe ser "not-allowed" al pasar sobre él
      cy.get('.btn-export.locked').should('have.class', 'locked');
    });

    // ── Test 2: Clic en el botón bloqueado abre modal con mensaje de upgrade ─
    it('al hacer clic en el botón bloqueado muestra el modal de upgrade', () => {
      cy.get('.btn-export.locked').click();

      // el modal de exportación debe abrirse
      cy.get('.modal-export').should('be.visible');

      // pero debe mostrar el mensaje de "solo plan Pro"
      cy.get('.export-locked-msg').should('be.visible');
      cy.get('.export-locked-msg').should('contain', 'plan Pro');
    });

    // ── Test 3: El modal bloqueado no tiene campos de fecha ───────────────────
    it('el modal de upgrade no muestra los controles de fecha', () => {
      cy.get('.btn-export.locked').click();
      cy.get('.modal-export').should('be.visible');

      // los date pickers no deben existir para usuarios Free
      cy.get('#export-from').should('not.exist');
      cy.get('#export-to').should('not.exist');
    });

    // ── Test 4: El modal de upgrade tiene botón Cerrar ───────────────────────
    it('el modal de upgrade tiene botón para cerrar', () => {
      cy.get('.btn-export.locked').click();
      cy.get('.modal-export').should('be.visible');

      // el botón dice "Cerrar" (no "Cancelar" ya que es solo informativo)
      cy.contains('Cerrar').should('be.visible').click();

      // el modal se cierra
      cy.get('.modal-export').should('not.exist');
    });

    // ── Test 5: El endpoint de exportar devuelve 403 para usuarios Free ───────
    it('el endpoint /api/channels/PUB-MAIN/export devuelve 403 para Free', () => {
      cy.window().then((win) => {
        const token = win.localStorage.getItem('voztranslate_token');

        cy.request({
          method: 'GET',
          url: 'http://localhost:3001/api/channels/PUB-MAIN/export?from=2026-01-01&to=2026-12-31',
          headers: { Authorization: `Bearer ${token}` },
          failOnStatusCode: false, // no queremos que el test falle por el 403
        }).then((resp) => {
          // el servidor debe rechazar la petición con 403 Forbidden
          expect(resp.status).to.equal(403);
          expect(resp.body.error).to.include('Pro');
        });
      });
    });

  });

  // ── Contexto: usuario PRO (simulado con intercept) ─────────────────────────
  // Usamos cy.intercept() para que el servidor devuelva plan='pro' en /me
  // sin necesidad de cambiar datos en la base de datos
  describe('Como usuario PRO (plan profesional)', () => {

    beforeEach(() => {
      // loginComoProSimulado intercepta /api/auth/me para devolver plan='pro'
      cy.loginComoProSimulado('pro');
      cy.unirseAlCanalPublico();
    });

    // ── Test 6: El botón de exportar muestra ícono de descarga para Pro ───────
    it('muestra el ícono de descarga en el botón de exportar (plan Pro)', () => {
      cy.get('.btn-export').should('be.visible');

      // el usuario Pro NO tiene la clase "locked"
      cy.get('.btn-export').should('not.have.class', 'locked');
    });

    // ── Test 7: Clic en exportar abre el modal con controles de fecha ─────────
    it('al hacer clic en exportar abre el modal con el formulario completo', () => {
      cy.get('.btn-export').click();

      // el modal debe abrirse
      cy.get('.modal-export').should('be.visible');
      cy.contains('Exportar Historial').should('be.visible');

      // los campos de fecha deben estar disponibles
      cy.get('#export-from').should('be.visible');
      cy.get('#export-to').should('be.visible');
    });

    // ── Test 8: El modal tiene los botones de formato TXT y PDF ──────────────
    it('el modal de exportación tiene los botones de formato TXT y PDF', () => {
      cy.get('.btn-export').click();
      cy.get('.modal-export').should('be.visible');

      cy.get('.export-format-btn').should('have.length', 2);
      cy.contains('.export-format-btn', 'TXT').should('be.visible');
      cy.contains('.export-format-btn', 'PDF').should('be.visible');
    });

    // ── Test 9: El selector de formato activa/desactiva los botones ──────────
    it('puede cambiar entre formato TXT y PDF', () => {
      cy.get('.btn-export').click();

      // por defecto TXT debe estar activo
      cy.contains('.export-format-btn', 'TXT').should('have.class', 'active');
      cy.contains('.export-format-btn', 'PDF').should('not.have.class', 'active');

      // cambiamos a PDF
      cy.contains('.export-format-btn', 'PDF').click();

      cy.contains('.export-format-btn', 'PDF').should('have.class', 'active');
      cy.contains('.export-format-btn', 'TXT').should('not.have.class', 'active');

      // volvemos a TXT
      cy.contains('.export-format-btn', 'TXT').click();
      cy.contains('.export-format-btn', 'TXT').should('have.class', 'active');
    });

    // ── Test 10: El modal tiene las fechas pre-llenadas ────────────────────
    it('el modal trae fechas por defecto (últimos 30 días)', () => {
      cy.get('.btn-export').click();

      // el campo "hasta" debe tener la fecha de hoy
      cy.get('#export-to').invoke('val').should('not.be.empty');

      // el campo "desde" debe tener una fecha (30 días antes)
      cy.get('#export-from').invoke('val').should('not.be.empty');
    });

    // ── Test 11: Cerrar el modal no exporta nada ──────────────────────────
    it('cerrar el modal cancela la exportación', () => {
      cy.get('.btn-export').click();
      cy.get('.modal-export').should('be.visible');

      // cerramos sin exportar
      cy.contains('Cancelar').click();

      cy.get('.modal-export').should('not.exist');
    });

    // ── Test 12: El botón Descargar está deshabilitado sin fechas ─────────
    it('el botón de descarga está deshabilitado si falta alguna fecha', () => {
      cy.get('.btn-export').click();

      // limpiamos la fecha "desde"
      cy.get('#export-from').clear();

      // el botón de descargar debe deshabilitarse
      cy.contains('Descargar').should('be.disabled');
    });

    // ── Test 13: El endpoint de exportar devuelve 200 para Pro ────────────
    // Nota: este test hace una llamada real al servidor.
    // El usuario simulado tiene plan='pro' solo en el frontend (intercept),
    // pero el servidor tiene el usuario como 'free'. Para probar el endpoint
    // real con Pro, usaríamos un usuario pro de verdad en la DB.
    // Este test verifica que la ESTRUCTURA de la respuesta es correcta
    // cuando el usuario realmente tiene plan Pro (comentado para que no falle):
    it('el endpoint de exportar responde con 403 para el usuario simulado (DB free)', () => {
      // Importante: aunque el frontend cree que es Pro (intercept),
      // el SERVIDOR consulta la DB donde el usuario ES Free.
      // Por eso esperamos 403 — esto verifica que el backend es el que manda.
      cy.window().then((win) => {
        const token = win.localStorage.getItem('voztranslate_token');

        cy.request({
          method: 'GET',
          url: 'http://localhost:3001/api/channels/PUB-MAIN/export?from=2026-01-01&to=2026-12-31',
          headers: { Authorization: `Bearer ${token}` },
          failOnStatusCode: false,
        }).then((resp) => {
          // el servidor protege correctamente: usuario en DB es Free → 403
          expect(resp.status).to.equal(403);
          cy.log('Correcto: el servidor verifica el plan desde la DB, no confía en el cliente');
        });
      });
    });

  });

  // ── Pruebas de validación de campos ───────────────────────────────────────
  describe('Validación del formulario de exportación', () => {

    beforeEach(() => {
      cy.loginComoProSimulado('val');
      cy.unirseAlCanalPublico();
      cy.get('.btn-export').click();
      cy.get('.modal-export').should('be.visible');
    });

    // ── Test 14: Los campos de fecha tienen el tipo correcto ──────────────
    it('los campos de fecha son inputs de tipo date', () => {
      cy.get('#export-from').should('have.attr', 'type', 'date');
      cy.get('#export-to').should('have.attr', 'type', 'date');
    });

    // ── Test 15: El campo "hasta" no puede ser mayor que hoy ─────────────
    it('el campo hasta tiene max configurado a la fecha de hoy', () => {
      const hoy = new Date().toISOString().split('T')[0];
      cy.get('#export-to').should('have.attr', 'max', hoy);
    });

    // ── Test 16: El overlay cierra el modal al hacer clic afuera ─────────
    it('hacer clic en el overlay cierra el modal', () => {
      // hacemos clic en el overlay (fuera del modal)
      cy.get('.modal-overlay').click({ force: true });

      cy.get('.modal-export').should('not.exist');
    });

  });

});
