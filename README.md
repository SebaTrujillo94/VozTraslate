# VozTranslate

Este es el proyecto que armé para la u. Básicamente es una app que traduce voz en tiempo real usando React para el frente y Node con algo de Python para la lógica de atrás. La idea era hacer algo que funcionara bien para la presentación sin complicarse tanto con bases de datos pesadas, así que simplifiqué varias cosas.

## Como hacerlo andar

Para que esto funcione en tu compu, tienes que levantar tanto el cliente como el servidor.

### El servidor

Primero métete a la carpeta del server. Ahí tienes que instalar las dependencias con npm y después lo corres.

cd server
npm install
npm start

El servidor se queda escuchando los mensajes y maneja la conexión con la API de Groq para que la traducción sea rápida.

### El cliente

Después abre otra terminal y vete a la carpeta del cliente. Lo mismo, instalas todo y lo lanzas con Vite.

cd client
npm install
npm run dev

Ahí te va a dar un link (normalmente localhost:5173) y ya puedes entrar a probarlo.

## Que usé para esto

Para el front me fui por React porque es lo que más cacho y Vite porque vuela. En el backend hay Express para las rutas y Socket.io porque se necesitaba que la traducción fuera al instante, sin recargar la página. Para la parte de inteligencia artificial usé el SDK de Groq.

Originalmente el proyecto tenía una base de datos Postgres bien compleja, pero para que sea más fácil de presentar y que cualquiera lo pueda probar sin instalar mil cosas, lo pasé a LocalStorage para el tema del login y los usuarios. Así es mucho más amigable de estudiar.

## Notas finales

El código está comentado para que se entienda qué hace cada parte, tratando de no usar lenguaje tan técnico para que mis compañeros también lo puedan seguir. No es perfecto, pero cumple con todo lo que pedía el profe para el ramo.
