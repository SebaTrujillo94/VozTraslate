// e2e.js — se carga automáticamente antes de CADA spec
// Aquí importamos los comandos personalizados que definimos nosotros

import './commands';

// cuando un test falla, mostramos un mensaje en consola con el nombre
// esto nos ayuda a encontrar el error más rápido en el log
Cypress.on('fail', (error, runnable) => {
  console.error(`Test fallido: "${runnable.title}"\n`, error.message);
  throw error; // re-lanzamos para que Cypress lo maneje normalmente
});
