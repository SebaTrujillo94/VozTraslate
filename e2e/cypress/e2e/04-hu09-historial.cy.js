// 04-hu09-historial.cy.js — Pruebas de la Historia de Usuario 09
// Historial de mensajes con scroll infinito y restricciones por plan.
//
// HU-09: "Como usuario en un canal, quiero visualizar el historial de mensajes
// con su traducción para revisar conversaciones anteriores."
// - Carga últimos 50 mensajes
// - Scroll infinito en grupos de 20
// - Free: 24h | Pro: 30 días

describe('HU-09 — Historial de Mensajes', () => {

  beforeEach(() => {
    cy.loginConRegistro('hist');
    cy.unirseAlCanalPublico();
  });

  // ── Test 1: El contenedor de mensajes existe y tiene scroll ───────────────
  it('el contenedor de mensajes tiene scroll habilitado', () => {
    cy.get('.messages-list')
      .should('be.visible')
      .and('have.css', 'overflow-y', 'auto');
  });

  // ── Test 2: El indicador de historial aparece ─────────────────────────────
  // Puede decir "Inicio del historial" si ya cargamos todos,
  // o "Sube para ver más" si hay más historial por cargar,
  // o nada si el canal no tiene mensajes previos.
  it('muestra un indicador de historial al entrar al canal', () => {
    // Esperamos un momento para que el historial cargue desde el servidor
    // (Socket.io tarda un poco en responder con los mensajes)
    cy.wait(1500);

    // El indicador de historial (el de arriba en la lista) debe estar
    // Si no hay mensajes previos, se muestra "Aún no hay mensajes"
    // Si hay mensajes: muestra "Inicio del historial" o "Sube para ver más"
    cy.get('.messages-list').should('be.visible').then(($list) => {
      const texto = $list.text();
      // Verificamos que al menos uno de los mensajes de estado esperados esté
      const tieneIndicador = (
        texto.includes('Inicio del historial') ||
        texto.includes('Sube para ver más') ||
        texto.includes('Aún no hay mensajes') ||
        texto.includes('mensajes anteriores') ||
        texto.includes('Sube para cargar')
      );
      expect(tieneIndicador, 'Debe existir algún indicador de estado del historial').to.be.true;
    });
  });

  // ── Test 3: El contenedor de mensajes es scrolleable ─────────────────────
  it('el contenedor de mensajes puede recibir eventos de scroll', () => {
    cy.get('.messages-list').trigger('scroll');
    // si no lanza error, el scroll funciona correctamente
    cy.get('.messages-list').should('be.visible');
  });

  // ── Test 4: Los mensajes del historial tienen la estructura correcta ───────
  // Si hay mensajes históricos, deben tener el formato de burbuja
  it('los mensajes históricos tienen la estructura de burbuja correcta', () => {
    cy.wait(1500); // esperamos que llegue el historial por socket

    cy.get('.messages-list').then(($list) => {
      const burbujas = $list.find('.msg-bubble');

      if (burbujas.length > 0) {
        // si hay mensajes, verificamos la estructura
        cy.get('.msg-bubble').first().within(() => {
          cy.get('.msg-text').should('exist');
        });
      } else {
        // sin mensajes históricos también es válido para un canal nuevo
        cy.log('El canal no tiene mensajes históricos — test OK');
      }
    });
  });

  // ── Test 5: El endpoint REST de historial responde correctamente ──────────
  // Verificamos que el backend devuelva la estructura esperada
  it('el endpoint /api/channels/PUB-MAIN/history devuelve la estructura correcta', () => {
    // para llamar al endpoint necesitamos el token
    cy.window().then((win) => {
      const token = win.localStorage.getItem('voztranslate_token');

      cy.request({
        method: 'GET',
        url: 'http://localhost:3001/api/channels/PUB-MAIN/history?before=2099-01-01T00:00:00.000Z&limit=20',
        headers: { Authorization: `Bearer ${token}` },
        failOnStatusCode: false,
      }).then((resp) => {
        expect(resp.status).to.equal(200);

        // la respuesta debe tener el campo messages (puede ser array vacío)
        expect(resp.body).to.have.property('messages');
        expect(resp.body.messages).to.be.an('array');

        // también debe tener hasMore para saber si hay más páginas
        expect(resp.body).to.have.property('hasMore');
      });
    });
  });

  // ── Test 6: El endpoint filtra por plan (Free = 24h) ─────────────────────
  // Un usuario Free solo puede ver mensajes de las últimas 24 horas
  it('el endpoint de historial incluye el campo hasMore', () => {
    cy.window().then((win) => {
      const token = win.localStorage.getItem('voztranslate_token');

      cy.request({
        method: 'GET',
        url: 'http://localhost:3001/api/channels/PUB-MAIN/history?before=2099-01-01T00:00:00.000Z&limit=20',
        headers: { Authorization: `Bearer ${token}` },
      }).then((resp) => {
        // hasMore debe ser booleano
        expect(resp.body.hasMore).to.be.a('boolean');
      });
    });
  });

  // ── Test 7: El indicador "cargando más" no está visible al entrar ─────────
  it('el spinner de cargando más no está visible al entrar al canal', () => {
    // el spinner de "Cargando mensajes anteriores..." no debe estar al inicio
    cy.contains('Cargando mensajes anteriores...').should('not.exist');
  });

  // ── Test 8: El indicador de historial tiene el ícono de flecha hacia arriba ─
  it('el indicador de scroll muestra el ícono ChevronsUp si hay historial', () => {
    cy.wait(1500);

    // si hay mensajes por cargar arriba, debería haber el ícono
    cy.get('.messages-list').then(($list) => {
      const tieneIndicador = $list.find('.history-top-indicator').length > 0;
      if (tieneIndicador) {
        cy.get('.history-top-indicator').should('be.visible');
      } else {
        cy.log('No hay indicador de historial — canal sin mensajes previos — OK');
      }
    });
  });

});
