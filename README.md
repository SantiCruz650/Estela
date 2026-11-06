# Estela

Tu API y sus logs, en la misma pantalla.

Disparas una request a tu localhost y las líneas de log que llevan su ID se resaltan solas al lado, en vivo. Todo pasa en tu navegador: no hay cuentas, no hay nube, nada se sube a ningún servidor.

Licencia: AGPL-3.0 — ver [LICENSE](./LICENSE).

## Qué hace

- Cliente HTTP (GET/POST/PUT/PATCH/DELETE/HEAD/OPTIONS) con editor de headers y body.
- Cada request sale marcada con su propio ID; las líneas del log que lo traen se iluminan automáticamente.
- Lee tu `.log` local en el navegador (File System Access API) y lo sigue en tiempo real.
- Historial en IndexedDB: sobrevive a reinicios del navegador.
- Puente con extensión de Chrome para pegar a localhost sin chocar con CORS.
- 100% local: sin cuentas, sin servidores, sin telemetría.

Solo Chromium (Chrome, Edge, Brave, Arc). Firefox aún no (File System Access API).

## Correr en local

1. `npm install` (una vez, en la raíz).
2. Terminal 1: `npm run dev -w web` → http://localhost:5173
3. Terminal 2: `npm run dev -w @devtool/demo-backend` → API de prueba en http://localhost:3000
4. Abre http://localhost:5173/app, dispara `GET http://localhost:3000/api/users` y mira cómo se ilumina su línea de log.
5. (Opcional, sin CORS) Para pegar a tu propio backend: `npm run build -w web` y luego `npm exec estela -- --port 4000 --log mi-backend.log` → abre http://localhost:4000/app en "Modo local". Ver la sección siguiente.

## Cómo conectar tu backend

Tres caminos, según tu caso. Todos mantienen la correlación petición↔logs.

> En la app (panel de logs), el botón **Ver cómo** abre el modal "Conecta tu backend": fragmentos listos para Node (http), Express, Fastify, Next.js, NestJS, Flask, FastAPI y Django. Cada fragmento lee el header `X-Request-ID` (o genera uno si falta), lo devuelve en la respuesta y hace que las líneas de log de ese request incluyan `req=<id>`. Estela reconoce el ID en cualquier formato y en cualquier parte de la línea.

### 1. CLI local (recomendado para empezar)

Publicado en npm como `@estela-dev/cli` (el nombre simple `estela` ya estaba ocupado). **Modo recomendado**: Estela arranca tu backend y captura su salida en vivo (stdout/stderr), sin archivos de log:

```bash
npx @estela-dev/cli -- npm run dev
```

Todo lo que va tras `--` es tu comando (`-- python -u app.py`, `-- flask run`, …). Con Ctrl+C cierras Estela y tu backend a la vez; si el proceso termina por sí solo, Estela lo anuncia en el panel y sigue sirviendo la app.

Alternativa: apuntar a archivos de log ya existentes con `--log` (repetible):

```bash
npx @estela-dev/cli --port 4000 --log ruta/al/archivo.log
```

Desde este monorepo, sin publicar:

```bash
npm run build -w web
npm exec estela -- --port 4000 --log ruta/al/archivo.log
```

Esto sirve el build de la web en http://localhost:4000, abre el navegador y levanta tres endpoints protegidos con un token aleatorio de la sesión:

- `POST /api/proxy` — ejecuta tu request hacia `localhost`/`127.0.0.1` (timeout 30 s, body truncado a 1 MB). Sin problemas de CORS.
- `GET /api/tail?offset=N` — hace tail en vivo de los archivos pasados con `--log` (repetible). El CLI solo lee esos archivos: nunca rutas que mande el navegador.
- `GET /api/process?cursor=N` — salida del comando arrancado con `--` (buffer circular: máx. 20 000 líneas / 5 MB).

La app detecta que corre dentro del CLI (token inyectado en el HTML) y usa `/api/proxy` y `/api/tail` automáticamente, con el indicador "Modo local". El servidor solo escucha en 127.0.0.1, valida el header Host (anti DNS rebinding) y el Origin, y nunca envía headers CORS.

### 2. CORS en tu backend

Si tu backend puede responder con `Access-Control-Allow-Origin` apuntando a `http://localhost:5173` (dev) o a `https://esteladev.netlify.app` (producción), la web hace las requests directamente con fetch. Sin instalar nada. Es la opción que usan muchos backends en desarrollo (Vite, Express con `cors`, FastAPI con `CORSMiddleware`).

### 3. Extensión de Chrome

Si no puedes tocar la configuración de CORS de tu backend, instala la extensión MV3 de `packages/extension`: pega a localhost sin restricciones de CORS sin exponer tu API a otros orígenes. Instrucciones de instalación en [Correr en local](#correr-en-local).

## Deploy

Vive en Netlify: `esteladev.netlify.app` (build `npm run build -w web`, redirect SPA en `netlify.toml`). El dominio propio llega según tracción y feedback, no antes.

## Estructura

- `packages/core` — motor TS puro: cliente HTTP, parser de logs, correlador, buffer/captura del modo proceso (con tests).
- `packages/web` — React + Vite + Zustand + Dexie.
- `packages/extension` — puente MV3, se agrega en fase posterior.
- `packages/demo-backend` — API local de prueba que loguea con request ID.
- `packages/cli` — `npx @estela-dev/cli`: sirve el build local con proxy `/api/proxy`, tail `/api/tail`, salida del modo proceso en `/api/process` (solo builtins de Node, sin dependencias).

## Tipografías

Geist y Geist Mono (autohospedadas en packages/web/public/fonts) están bajo la SIL Open Font License 1.1 — ver [OFL.txt](./packages/web/public/fonts/OFL.txt).
