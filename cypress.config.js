module.exports = {
  e2e: {
    baseUrl: 'http://localhost:5173',
    specPattern: 'e2e/cypress/e2e/**/*.cy.{js,jsx}',
    supportFile: 'e2e/cypress/support/e2e.js',
    fixturesFolder: 'e2e/cypress/fixtures',
    viewportWidth: 1280,
    viewportHeight: 720,
    defaultCommandTimeout: 10000,
    setupNodeEvents(on, config) {},
  },
};
