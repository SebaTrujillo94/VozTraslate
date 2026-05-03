// cypress.config.js — configuración principal de Cypress para VozTraslate
// Apunta al frontend que corre en Vite (localhost:5173)
// El backend (Express + Socket.io) debe correr en localhost:3001

const { defineConfig } = require('cypress');

module.exports = defineConfig({
  e2e: {
    // URL base de la app de React (Vite en modo dev)
    baseUrl: 'http://localhost:5173',

    viewportWidth:  1280,
    viewportHeight: 720,

    // no guardar video en local para ahorrar espacio
    video: false,

    // screenshot solo cuando falla un test
    screenshotOnRunFailure: true,

    // esperar hasta 10 segundos por elementos del DOM
    defaultCommandTimeout: 10000,

    // tiempo máximo para esperar que una página cargue
    pageLoadTimeout: 30000,

    // donde viven los tests
    specPattern: 'cypress/e2e/**/*.cy.{js,jsx}',

    setupNodeEvents(on, config) {
      // aquí podríamos agregar plugins pero por ahora no necesitamos ninguno
    },
  },
});
