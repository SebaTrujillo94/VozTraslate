# VozTranslate

Este proyecto ha sido desarrollado como una plataforma de comunicación multilingüe. Nuestra aplicación permite traducir y transcribir voz en tiempo real, utilizando React para el frontend y Node.js para la lógica del backend. Nuestro objetivo es ofrecer una solución eficiente y funcional, orientada a romper las barreras idiomáticas mediante traducciones instantáneas y precisas.

## Últimas Actualizaciones

Recientemente hemos implementado una serie de mejoras fundamentales para el proyecto:
- **Corrección de errores:** Se ha estabilizado la plataforma y solucionado fallos previos.
- **Exportación en Versión Pro:** Se ha añadido funcionalidad para permitir la exportación de transcripciones en un formato avanzado como parte de las características Pro.
- **Historial:** Ahora es posible revisar el registro histórico de las interacciones y traducciones.
- **Pruebas en Cypress:** Se ha integrado un entorno robusto de pruebas End-to-End (E2E) utilizando Cypress, garantizando la calidad y fiabilidad de los flujos principales de la aplicación.

## Requisitos y Configuración Inicial

Para ejecutar este proyecto en un entorno local, es necesario iniciar los servicios de cliente y servidor de forma independiente.

### Configuración del Servidor

El servidor se encarga de gestionar las conexiones en tiempo real y la integración con la API de inteligencia artificial (Groq) para procesar las traducciones.

1. Navegar al directorio del servidor:
   ```bash
   cd server
   ```
2. Instalar las dependencias requeridas:
   ```bash
   npm install
   ```
3. Iniciar el servicio:
   ```bash
   npm start
   ```

### Configuración del Cliente

El cliente proporciona la interfaz de usuario interactiva y fluida, construida con React y empaquetada mediante Vite.

1. Navegar al directorio del cliente en una nueva terminal:
   ```bash
   cd client
   ```
2. Instalar las dependencias del frontend:
   ```bash
   npm install
   ```
3. Ejecutar el entorno de desarrollo:
   ```bash
   npm run dev
   ```

La aplicación estará disponible localmente, habitualmente en `http://localhost:5173`.

## Arquitectura y Tecnologías Utilizadas

- **Frontend:** React, Vite.
- **Backend:** Node.js, Express, Socket.io (para comunicación en tiempo real y bidireccional).
- **Inteligencia Artificial:** SDK de Groq para procesamiento y traducción de voz ágil.
- **Pruebas Automatizadas:** Cypress.
- **Almacenamiento:** Para facilitar la distribución, la evaluación y las demostraciones académicas del proyecto, hemos simplificado el sistema de persistencia utilizando `LocalStorage` para el manejo de sesiones de usuario, simplificando la dependencia de motores de bases de datos.

## Estructura del Código

El código fuente incluye comentarios explicativos destinados a facilitar la lectura y comprensión técnica de las diferentes capas del sistema, permitiendo que cualquier estudiante de programación pueda revisar, entender y probar la lógica implementada sin inconvenientes.
