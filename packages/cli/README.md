# @estela-dev/cli

Estela es un cliente HTTP local-first que correlaciona cada request con sus líneas de log en tiempo real, sin cuentas ni nube. Este paquete la sirve en tu propia máquina y elimina los problemas de CORS entre la app y tu backend en localhost.

## Instalación

No requiere instalación previa. **Modo recomendado**: Estela arranca tu backend captura la salida en vivo (stdout y stderr) con la hora exacta de cada línea, sin archivos de log:

```bash
npx @estela-dev/cli -- npm run dev
```

Si usas otro runtime: `npx @estela-dev/cli -- python -u app.py`, `npx @estela-dev/cli -- flask run`, etc. (todo lo que va tras `--` es tu comando). Con Ctrl+C cierras Estela y tu backend a la vez.

El separador `--` es **opcional**: `npx @estela-dev/cli npm run dev` también funciona (útil porque en PowerShell el propio `--` se pierde antes de llegar al comando). Sí conviene usarlo si tu comando empieza con `--` o `-` (por ejemplo `-- --fix`): sin él, Estela los leería como opciones propias.

Alternativa: apuntar a archivos de log ya existentes con `--log` (repetible, solo esos archivos quedan disponibles para el stream):

```bash
npx @estela-dev/cli --port 4000 --log ruta/al/archivo.log
npx @estela-dev/cli --port 4000 --log ./mi-backend/app.log --log ./mi-backend/error.log
```

Ambos modos se pueden combinar: `npx @estela-dev/cli --log extra.log -- npm run dev`.

En ambos casos abre http://localhost:4000/app en tu navegador.

| Opción | Descripción |
| --- | --- |
| `-- <comando>` | Arranca tu comando con Estela y captura su salida en el stream de logs. |
| `--port <n>` | Puerto (defecto 4000). Siempre escucha solo en 127.0.0.1. |
| `--log <ruta>` | Archivo de log a exponer en vivo (repetible). |
| `--no-open` | No abrir el navegador (útil en servidores o pruebas). |
| `-h`, `--help` | Ayuda. |

## Modo proceso (`--`)

- Estela ejecuta tu comando como hijo y muestra su salida como fuente "Proceso: &lt;comando&gt;" en el panel de logs, con la hora exacta en que llegó cada línea.
- La salida del hijo sigue apareciendo en tu terminal, tal como siempre (Estela la copia a la UI sin robarla).
- Si el proceso termina, Estela lo anuncia en el panel con su código de salida y sigue sirviendo la app; para volver a arrancarlo, corre el comando de nuevo.
- Ctrl+C mata Estela y el árbol completo del proceso hijo (también en Windows).

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
- `/api/process` **solo** expone la salida del comando que arrancaste tú con `--`, con buffer circular (máx. 20 000 líneas / 5 MB).

## Requisitos

Node.js >= 20. Sin dependencias: solo builtins de Node.

## Enlaces

- Repo: https://github.com/SantiCruz650/Estela
- Issues: https://github.com/SantiCruz650/Estela/issues
- App en producción: https://esteladev.netlify.app

## Licencia

AGPL-3.0-only — ver [LICENSE](./LICENSE).
