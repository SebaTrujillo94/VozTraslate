// 01-auth.cy.js — Pruebas de Autenticación
// Verificamos que el login, registro y errores de credenciales funcionen bien.
// Todos estos tests necesitan el servidor corriendo en localhost:3001.

describe('Autenticación', () => {

  // antes de cada test volvemos a la pantalla de inicio
  beforeEach(() => {
    // borramos el token para que siempre empiece en login
    cy.clearLocalStorage();
    cy.visit('/');
  });

  // ── Test 1: La pantalla de login existe y tiene los elementos básicos ──────
  it('muestra la pantalla de login al entrar sin sesión', () => {
    // el título de la app debe estar visible
    cy.get('.login-container').should('be.visible');
    cy.get('.login-title').should('contain', 'VozTranslate');

    // deben existir las dos pestañas de auth
    cy.contains('Iniciar Sesión').should('be.visible');
    cy.contains('Registrarse').should('be.visible');

    // el formulario de login debe tener sus campos
    cy.get('#login-email').should('be.visible');
    cy.get('#login-password').should('be.visible');
    cy.get('#login-submit').should('be.visible');
  });

  // ── Test 2: Login con credenciales incorrectas muestra un error ────────────
  it('muestra error al ingresar contraseña incorrecta', () => {
    cy.get('#login-email').type('noexiste@correo.com');
    cy.get('#login-password').type('ContraseñaMal123');
    cy.get('#login-submit').click();

    // el mensaje de error debe aparecer en la UI
    cy.get('.auth-error', { timeout: 8000 }).should('be.visible');
  });

  // ── Test 3: Login con email que no existe ─────────────────────────────────
  it('muestra error al intentar login con email desconocido', () => {
    cy.get('#login-email').type('usuarioquenoexiste999@test.com');
    cy.get('#login-password').type('TestPass123!');
    cy.get('#login-submit').click();

    cy.get('.auth-error', { timeout: 8000 }).should('be.visible');
  });

  // ── Test 4: Registro exitoso a través de la UI (los dos pasos) ────────────
  it('registra un usuario nuevo usando el formulario completo', () => {
    const ts = Date.now();
    // usamos timestamp para evitar conflictos entre ejecuciones
    const email    = `uireg${ts}@voztranslate.test`;
    const username = `uireg${ts}`;

    // cambiamos al tab de registro
    cy.contains('Registrarse').click();
    cy.get('#register-form').should('be.visible');

    // paso 1: llenar los datos básicos
    cy.get('#register-email').type(email);
    cy.get('#register-username').type(username);
    cy.get('#register-password').type('TestPass123!');
    cy.get('#register-confirm-password').type('TestPass123!');

    // hacemos clic en Continuar para ir al paso 2
    cy.get('#register-next').click();

    // paso 2: configuración del perfil (idioma ya viene por defecto)
    cy.get('#register-profile-form').should('be.visible');

    // hacemos clic en el botón de completar (dice "Comenzar" o "Get Started")
    cy.get('#register-profile-form').find('[type="submit"]').click();

    // si todo salió bien, debería aparecer el dashboard
    cy.get('.dashboard-wrapper', { timeout: 12000 }).should('be.visible');
  });

  // ── Test 5: Registro muestra error si las contraseñas no coinciden ─────────
  it('muestra error si las contraseñas del registro no coinciden', () => {
    const ts = Date.now();
    cy.contains('Registrarse').click();

    cy.get('#register-email').type(`mismatch${ts}@test.com`);
    cy.get('#register-username').type(`mismatch${ts}`);
    cy.get('#register-password').type('TestPass123!');
    // contraseña diferente a la anterior
    cy.get('#register-confirm-password').type('OtraContraseña456!');

    // debería aparecer el aviso de que no coinciden
    cy.get('.error-hint').should('be.visible');

    // el botón de continuar debe estar deshabilitado
    cy.get('#register-next').should('be.disabled');
  });

  // ── Test 6: Login exitoso usando la API directamente (más rápido) ──────────
  it('entra al dashboard después de autenticarse con la API', () => {
    // loginConRegistro hace todo: crea el usuario, guarda el token y visita '/'
    cy.loginConRegistro('login6');

    // si llegamos acá sin errores, el login funcionó
    cy.get('.dashboard-wrapper').should('be.visible');

    // debe mostrar "Hola, ..." con el nombre del usuario
    cy.get('.dashboard-header h1').should('contain', 'Hola,');
  });

  // ── Test 7: Cambiar entre tabs de login y registro ─────────────────────────
  it('puede alternar entre las pestañas de login y registro', () => {
    // empezamos en login
    cy.get('#login-form').should('be.visible');

    // cambiamos a registro
    cy.contains('Registrarse').click();
    cy.get('#register-form').should('be.visible');
    cy.get('#login-form').should('not.exist');

    // volvemos a login
    cy.contains('Iniciar Sesión').click();
    cy.get('#login-form').should('be.visible');
    cy.get('#register-form').should('not.exist');
  });

});
