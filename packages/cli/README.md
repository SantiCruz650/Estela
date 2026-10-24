# @estela-dev/cli

Estela es un cliente HTTP local-first que correlaciona cada request con sus líneas de log en tiempo real, sin cuentas ni nube. Este paquete la sirve en tu propia máquina y elimina los problemas de CORS entre la app y tu backend en localhost.

## Instalación

No requiere instalación previa:

```bash
npx @estela-dev/cli --port 4000 --log ruta/al/archivo.log
```

Abre http://localhost:4000/app en tu navegador. La opción `--log` es repetible (puedes pasar varios archivos) y solo esos archivos quedan disponibles para el stream de logs:

```bash
npx @estela-dev/cli --port 4000 --log ./mi-backend/app.log --log ./mi-backend/error.log
```

| Opción | Descripción |
| --- | --- |
| `--port <n>` | Puerto (defecto 4000). Siempre escucha solo en 127.0.0.1. |
| `--log <ruta>` | Archivo de log a exponer en vivo (repetible). |
| `--no-open` | No abrir el navegador (útil en servidores o pruebas). |
| `-h`, `--help` | Ayuda. |

## Modo local

Cuando la app detecta que fue servida por este CLI (token inyectado en el HTML), activa el **Modo local**:

- Las requests salen por `POST /api/proxy` hacia tu backend en localhost, sin bloqueos de CORS.
- El stream de logs hace tail en vivo de tus archivos `--log` vía `GET /api/tail?offset=N`.
- El indicador de conexión muestra "Modo local" en lugar de "Extensión no disponible".

La versión de https://esteladev.netlify.app sigue funcionando igual (fetch directo, CORS o extensión).

## Seguridad

- Escucha **solo en 127.0.0.1** (nunca 0.0.0.0) y valida el header `Host` (anti DNS rebinding).
- Cada arranque genera un **token aleatorio** exigido en todos los endpoints `/api` (solo header, comparación constante).
- Valida el header `Origin` (bloquea sitios ajenos) y no envía headers CORS.
- `/api/proxy` solo acepta destinos `localhost`, `127.0.0.1` y `[::1]`, con timeout de 30 s y body truncado a 1 MB; cada redirección se revalida.
- `/api/tail` **solo** lee los archivos que pasaste con `--log`, con tope de 1 MB por respuesta.

## Requisitos

Node.js >= 20. Sin dependencias: solo builtins de Node.

## Enlaces

- Repo: https://github.com/SantiCruz650/devtool
- App en producción: https://esteladev.netlify.app

## Licencia

AGPL-3.0-only — ver [LICENSE](./LICENSE).
