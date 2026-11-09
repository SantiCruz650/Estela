# Auditoría técnica — Estela

Auditoría de solo lectura (ningún archivo del proyecto fue modificado para este reporte).
Fecha: 2026-10-16. Repo: `SantiCruz650/devtool`, rama auditada según `git log`: `a9b8384` (árbol limpio).
Regla del reporte: sin cita de archivo/línea no hay afirmación; lo no confirmado se marca.

---

## 1. Resumen

1. Estela es un cliente HTTP para localhost más un visor de logs en vivo que resalta las líneas del log que contienen el ID de cada request, todo 100% en el navegador (`README.md:1-5`).
2. El motor (`packages/core/src`, 13 ficheros) es TypeScript puro sin DOM: parser de logs, tres fuentes de log, correlador por UUID y cliente HTTP (`packages/core/src/index.ts:1-11`).
3. La app (`packages/web/src`) es React 18 + Vite + Tailwind con dos pantallas: landing `/` y herramienta `/app` (`packages/web/src/App.tsx`, verificado en inspección previa).
4. La extensión de Chrome MV3 (`packages/extension/`) ejecuta las requests desde el service worker para esquivar CORS y se comunica con la web por `window.postMessage` (`packages/extension/background.js`, `content-script.js`).
5. No hay backend, login, analytics ni telemetría en el código; la persistencia es IndexedDB + localStorage y el deploy es estático en Netlify (`netlify.toml:6-18`, verificado en vivo).

---

## 2. Stack

- Framework UI: React 18.3.1 + React DOM 18.3.1, router `react-router-dom` 7.18.4 (`packages/web/package.json:14-20`).
- Build: Vite 8.2.2 + `@vitejs/plugin-react` 6.1.0, `base: '/'` explícito (`packages/web/vite.config.ts`, `packages/web/package.json:37`).
- Estilos: Tailwind CSS 4.3.3 + `@tailwindcss/vite` 4.3.3 (`packages/web/package.json:15,21`).
- Estado/datos: Zustand 5.0.15 (stores en memoria), Dexie 4.4.5 (IndexedDB) (`packages/web/package.json:16,22`).
- Lenguaje: TypeScript ~6.0.2 en modo `strict: true` (`packages/core/tsconfig.json:3`; `packages/web/tsconfig.app.json` hereda de core). `noUnusedLocals` y `noUnusedParameters` activos (`packages/web/tsconfig.app.json:20-21`).
- Tests: Vitest 5.0.1 (web) / `latest` (core); `fake-indexeddb` 6.2.5 para tests de Dexie (`packages/web/package.json:34`, `packages/core/package.json:11`).
- Lint: ESLint 10.9.0 + `typescript-eslint` 8.67.0 + plugins react-hooks/react-refresh (`packages/web/package.json:29-33`).
- Node: sin campo `engines` en ningún `package.json` (NO EXISTE); Netlify fija `NODE_VERSION = "20"` (`netlify.toml:10-11`); `AGENTS.md:6` dice Node 20.
- `packages/demo-backend`: cero dependencias, solo builtins de Node (`http`, `crypto`, `fs`) (`packages/demo-backend/package.json`, `packages/demo-backend/index.js:1-5`).
- `packages/extension`: sin `package.json` (JS plano, sin build).

Dependencias de `packages/web` y propósito:

| Dependencia | Propósito en el código |
|---|---|
| `@devtool/core` (`file:../core`) | Motor: HTTP, parser, fuentes, correlador |
| `dexie` | Historial persistente en IndexedDB (`src/lib/db.ts:1`) |
| `react` / `react-dom` | UI |
| `react-router-dom` | Rutas `/`, `/app`, `/privacidad`, `/terminos` |
| `tailwindcss` / `@tailwindcss/vite` | Estilos utility-first |
| `zustand` | Stores `correlation-store` y líneas de log (`src/LogStreamPanel.tsx:2`) |

Scripts disponibles:

| Paquete | Scripts |
|---|---|
| raíz | `dev`, `lint`, `test`, `typecheck` (propagan a workspaces) (`package.json:7-12`) |
| `web` | `dev` (vite), `build` (`tsc -b && vite build`), `typecheck` (`tsc -b`), `test` (`vitest run`), `lint` (`eslint .`), `preview` |
| `core` | `test` (`vitest run`), `typecheck` (`tsc --noEmit`) (`packages/core/package.json:5-8`) |
| `demo-backend` | `dev` (`node index.js`), `typecheck`/`lint` (`node --check`), `test` (`node --test`) |

---

## 3. Árbol de directorios (3 niveles; excluye `node_modules`, `dist`, `.git`)

```text
devtool/
├── .devcontainer/devcontainer.json   # Config de contenedor dev (contenido NO VERIFICADO)
├── AGENTS.md                         # Reglas del proyecto (npm workspaces, strict, convenciones)
├── LICENSE                           # GNU AGPL v3 completa (661 líneas, verificada)
├── README.md                         # Docs de Estela: uso, local, deploy, estructura
├── ESTELA_AUDIT.md                   # Este reporte
├── netlify.toml                      # Build + publish + redirect SPA (sección 9)
├── package.json / package-lock.json  # Workspaces npm: packages/*
└── packages/
    ├── core/src/          # Motor TS puro (http-client, log-parser, correlator,
    │                       # fs/remote/mock-log-source, types, index + 5 tests)
    ├── demo-backend/      # API Node de prueba :3000 con /logs/tail (index.js, 93 líneas)
    ├── extension/         # MV3: manifest.json, background.js, content-script.js
    └── web/
        ├── public/estela.svg   # Único logo (punto + 2 rayas)
        ├── index.html          # SPA shell, favicon → /estela.svg, título ES
        ├── vite.config.ts      # React + Tailwind + base '/'
        └── src/
            ├── main.tsx / App.tsx / index.css / config.ts / RequestRunner.tsx / LogStreamPanel.tsx
            ├── app/DashboardLayout.tsx        # Pantalla /app (2 columnas)
            ├── landing/ (LandingPage, Hero, Features, HowItWorks, CtaFooter)  # Landing /
            ├── legal/ (PrivacidadPage, TerminosPage, SiteFooter)
            ├── components/ (RequestForm, ResponseViewer, HistoryPanel)
            ├── lib/ (correlation-store, db, extension-bridge, fs-bridge + 2 tests)
            ├── hooks/useExtensionStatus.ts
            └── ui/primitives.tsx               # Badges, Panel, ExtensionIndicator…
```

Carpetas clave: `core/src` es la única con lógica testeable sin DOM; `web/src/lib` son los puentes entre UI y navegador (postMessage, File System Access, OPFS, Dexie); `extension/` es el bypass de CORS; `demo-backend/` es el backend de juguete que implementa el protocolo `/logs/tail` que la UI espera.

---

## 4. Arquitectura

Módulos principales: `http-client` (disparo), `log-parser` (línea → `LogLine`), tres `*LogSource` (orígenes), `Correlator` (cruce), stores Zustand (`correlation-store`, líneas), Dexie (`db`), bridges (`extension-bridge`, `fs-bridge`).

### (a) Request runner

`RequestForm` (método/URL/headers/body, `src/components/RequestForm.tsx:32-64`) → `RequestRunner.handleSend` (`src/RequestRunner.tsx:20-51`): si la extensión está `connected` usa `executeRequestViaExtension` con fallback a `executeRequest` directo; si no, fetch directo. `executeRequest` inyecta `X-Request-ID` (uuid v4) si falta (`packages/core/src/http-client.ts:28-32`), mide `durationMs`, trunca el body a `MAX_BODY_CHARS = 1_000_000` (`http-client.ts:22,56-60`) e intenta extraer `backendRequestId` del JSON (`http-client.ts:68-79`). La respuesta se pinta en `ResponseViewer` y se registra en el store + historial Dexie (`RequestRunner.tsx:34-47`).

### (b) Log stream

Cuatro fuentes tras la misma interfaz `LogSource` (`core/src/types.ts:10-16`), con polling de 300 ms salvo mock:
- `MockLogSource`: líneas aleatorias de plantilla cada 300 ms (`core/src/mock-log-source.ts:26-39`).
- `FileSystemLogSource`: `file.slice(offset).arrayBuffer()` incremental + `TextDecoder` streaming + `extractCompleteLines` (`core/src/fs-log-source.ts:114-145`). Lee solo el delta desde el offset; `readFrom: "end"` por defecto (la UI lo usa así en `LogStreamPanel.tsx:134,176`).
- `RemoteLogSource`: `GET <base>/logs/tail?offset=N` → JSON `{size, truncated, data}` (`core/src/remote-log-source.ts:75-108`). **Polling HTTP, NO SSE ni WebSocket.**
- Demo OPFS: `OpfsLogSimulator` escribe líneas inventadas (70% con requestIds reales recientes, `src/lib/fs-bridge.ts:84-87`) a `demo/demo.log` en OPFS y se lee con `FileSystemLogSource` (`LogStreamPanel.tsx:129-150`).

La UI mantiene como máximo 200 líneas en memoria (`.slice(-200)`, `LogStreamPanel.tsx:31`).

### (c) Correlaciones

Criterio **único: UUID v4 exacto** extraído de cada línea (`uuidV4Pattern`, `core/src/log-parser.ts:4,21`). `Correlator` guarda requests (`upsertRequest`) y un buffer circular de 5000 líneas; `correlate(id)` devuelve matches + N líneas de contexto antes/después (`core/src/correlator.ts:25,52-79`). La UI instancia `new Correlator(2)` (contexto ±2, `src/lib/correlation-store.ts:16`), guarda 50 requests recientes (`correlation-store.ts:25`) y pinta el detalle al hacer clic (`LogStreamPanel.tsx:348-360`).

### (d) Extensión ↔ app web

Solo `window.postMessage` con etiquetas `devtool-webapp` / `devtool-extension`. Sin `externally_connectable` (NO EXISTE en el manifest). Flujo: `executeRequestViaExtension` postea `EXECUTE_REQUEST` (`src/lib/extension-bridge.ts:67-81`) → content-script lo reenvía por `chrome.runtime.sendMessage` (`content-script.js:18-31`) → el service worker hace `fetch` con `host_permissions` y responde (`background.js:9-28`). Detección: ping/pong con timeout de 600 ms; requests con timeout de 30 s (`extension-bridge.ts:5-6,57-65`).

```text
[RequestForm] ──input──▶ [RequestRunner.handleSend]
      │                        │ ext connected? ──sí──▶ postMessage ─▶ [content-script]
      │                        │                                   ─▶ chrome.runtime ─▶ [SW background.js]
      │                        │                                                        fetch(localhost) ─┐
      │                        ▼ no / fallback                                        (sin CORS)         │
      │                  [core executeRequest] ──fetch directo──▶ backend ◀───────────────────────────────┘
      │                        │ X-Request-ID auto
      ▼                        ▼
[ResponseViewer]        [correlator.upsertRequest + Dexie historial]
                                  ▲
[Mock | FS slice | Remote /logs/tail | OPFS demo] ──LogLine[]──▶ ingest ─▶ [Correlator ring 5000]
                                                                          ─▶ [UI lista 200 + detalle ±2]
```

---

## 5. Extensión

- `manifest_version`: **3** (`packages/extension/manifest.json:2`). Nombre: `"DevTool Local Bridge"` v0.1.0 (líneas 3-4; nótese: dice DevTool, no Estela).
- `permissions`: `[]` — vacío (`manifest.json:7`).
- `host_permissions`: `["http://localhost/*", "http://127.0.0.1/*"]` (`manifest.json:8`). Solo http, no https, no puertos remotos.
- `content_scripts`: `matches` = localhost + 127.0.0.1 + **`https://*/*`** (`manifest.json:11`), `run_at: document_start` (línea 13). El script se inyecta en **todas** las páginas HTTPS.
- Comunicación: exclusivamente `window.postMessage` con `source`/`type` (`content-script.js:1-32`, `src/lib/extension-bridge.ts:20-55`). **Sin `externally_connectable`** (NO EXISTE).
- Validación de origen: **NO**. La web filtra por `data.source === "devtool-extension"` pero **no comprueba `event.origin`** (`extension-bridge.ts:31-38`); el content-script comprueba `event.source === window` + etiqueta (`content-script.js:2-8`); ambos postean con `"*"` (`content-script.js:13,25`, `extension-bridge.ts:18`). Cualquier JS de la página puede emitir mensajes con la etiqueta válida.
- CORS: lo resuelve el service worker haciendo `fetch` fuera del contexto de la página, amparado por `host_permissions` (`background.js:43`). Lógica duplicada a mano desde `http-client.ts` (comentario "Replica EXACTA", `background.js:31`).

---

## 6. Estado de features

| Feature | Estado | Evidencia |
|---|---|---|
| Métodos HTTP | Funciona | 7 métodos en `RequestForm.tsx:18`; GET/HEAD sin body (`http-client.ts:34-35`) |
| Headers | Funciona | Editor añadir/quitar/activar (`RequestForm.tsx:98-140`) |
| Body | Funciona | Textarea solo si método lo admite (`RequestForm.tsx:39,141-151`) |
| Historial | Funciona | Dexie `history`, prune a 500, UI lista 50 (`lib/db.ts:53-72`, `HistoryPanel.tsx:31,43`); bodies truncados a 10 000 (`db.ts:17`) |
| Mock en memoria | Funciona | Plantillas aleatorias c/300 ms (`mock-log-source.ts:5-39`); el UUID es fijo y nunca coincide con requests reales (línea 4) |
| Simular backend | Funciona | OPFS `demo/demo.log` + simulador que cita requestIds reales al 70% (`fs-bridge.ts:13-21,84-87`) |
| Conectar archivo `.log` | Funciona (Chromium) | `showOpenFilePicker` con error explícito si no existe (`fs-bridge.ts:132-155`); File System Access = solo Chromium (`README.md:18`) |
| Backend remoto tail | Funciona (protocolo propio) | **Polling** JSON `GET /logs/tail?offset=` cada 300 ms (`remote-log-source.ts:75-108`); SSE/WebSocket: NO EXISTEN; el demo-backend implementa la ruta (`demo-backend/index.js:40-56`) |
| Correlaciones | Funciona | Criterio: **request-id (UUID v4 estricto)** (`log-parser.ts:4,21,28-30`); nada por timestamp ni fuzzy |
| Persistencia | Funciona | IndexedDB `devtool` (historial) + localStorage `devtool.requestUrl`, `devtool.remoteBase` (`RequestForm.tsx:16,34`, `LogStreamPanel.tsx:65`); sin cuentas |
| Límite en memoria | Funciona | 200 líneas UI (`LogStreamPanel.tsx:31`), anillo 5000 correlador (`correlator.ts:25`), 50 requests UI (`correlation-store.ts:25`), 500 historial (`db.ts:66`) |

---

## 7. Calidad

Ejecutado el 2026-10-16 (salidas resumidas; todo en verde):

- `npx tsc --noEmit -p packages/web` / `-p packages/core`: sin salida, exit 0. (Nota: los scripts canónicos son `tsc -b` en web y `tsc --noEmit` en core; ambos exit 0.)
- `npm run lint -w web` (`eslint .`): limpio, exit 0.
- `npm test -w web`: 2 ficheros, **8/8** (`correlation-store.test.ts`, `db.test.ts`).
- `npm test -w @devtool/core`: 5 ficheros, **48/48**.
- `npm run build -w web`: ok, 56 módulos. `dist/`: `index.html` 592 B, `index-Da3pzmtN.css` 32 637 B (gzip 6,63 kB), `index-DgH8_7Fh.js` 324 397 B (gzip 103,33 kB). Bundle total ≈ 357 kB (≈ 110 kB gzip).

Conteos en `packages/{core,web}/src`, `demo-backend`, `extension` (`*.ts/tsx/js`):

- `any` (como anotación/casteo): **0**. `@ts-ignore`/`@ts-expect-error`: **0**. `eslint-disable`: **0**.
- `TODO` (case-sensitive): **2** — `Hero.tsx:4` (subir woff2 de marca post-MVP), `primitives.tsx:85` (fallback `execCommand` post-MVP). `FIXME`/`HACK`: **0**. `VERIFY-API`: 2 (`fs-bridge.ts:111,138`, ambos sobre File System Access, declarados, no adivinados).
- 10 ficheros fuente más grandes (bytes; `dist` excluido): `LogStreamPanel.tsx` 15 615, `primitives.tsx` 6 164, `HistoryPanel.tsx` 6 080, `RequestForm.tsx` 5 661, `fs-bridge.ts` 4 985, `fs-log-source.ts` 4 361, `Hero.tsx` 3 791, `remote-log-source.ts` 3 772, `demo-backend/index.js` 3 720, y el 10.º por debajo de estos (NO VERIFICADO el nombre exacto; el resto son ficheros pequeños de <3,5 kB).
- Cobertura de tests: solo stores/persistencia en web (8 tests) y motor en core (48). **Cero tests de componentes, rutas o flujos UI.**

---

## 8. Seguridad y privacidad

- ¿Datos fuera del navegador? **No**: fetch solo al backend que el usuario indica; tail al backend indicado; cero llamadas a terceros en el código (grep de `analytics|telemetry|posthog|gtag|sentry`: 0 resultados).
- ¿Analytics/telemetría? **NO EXISTE**.
- ¿Secrets/`.env`/API keys? **No**: sin ficheros `.env` (verificado raíz y `packages/web`); grep de `api[_-]?key|secret|token|password|bearer` solo da falsos positivos dentro del bundle compilado (`dist/*.js`, internos de React), nada en fuente.
- ¿XSS? **No hay `dangerouslySetInnerHTML` ni `innerHTML`** (0 resultados). Logs y respuestas se renderizan como texto (`{line.raw}`, `{prettyBody}`); el único `JSON.parse` es para pretty-print con fallback a texto (`ResponseViewer.tsx:21-27`).
- ¿CSP/headers? **NO EXISTE**: `netlify.toml` no tiene sección `[[headers]]` y no hay fichero `public/_headers` (`public/` contiene solo `estela.svg`).
- Matices que sí importan: (1) el historial guarda **headers íntegros sin filtrar** (incluido un eventual `Authorization`) en IndexedDB (`db.ts:38-51` + `RequestForm.tsx:56-62`); (2) el bridge `postMessage` no valida `event.origin` y el content-script vive en `https://*/*` (sección 5) — cualquier web puede pedir lecturas de localhost a la extensión si el usuario la tiene instalada; (3) `window.postMessage(msg, "*")` en ambos sentidos.

---

## 9. Deploy

- `netlify.toml` (raíz, 18 líneas): `command = "npm run build -w web"`, `publish = "packages/web/dist"`, `NODE_VERSION = "20"`, redirect SPA `/* → /index.html 200` (sin esto `/app` daría 404 al recargar).
- El `publish` coincide con la salida real del build (`dist/index.html` + `assets/`, verificado §7).
- Rutas: `/`, `/app`, `/privacidad`, `/terminos`, `* → /` (verificado en inspección previa de `App.tsx`).
- Privacidad y Términos **tienen contenido real**: Privacidad explica local-first/IndexedDB/sin tracking en 3 párrafos (`PrivacidadPage.tsx:13-28`), aunque termina en "escríbenos" **sin contacto** (línea 26). Términos trae 4 párrafos breves más un comentario que lo declara **borrador** (`TerminosPage.tsx:3-4,15-20`).
- Despliegue verificado en vivo: `https://esteladev.netlify.app` responde con el título "Estela — Tu API y sus logs, en la misma pantalla" (fetch HTTP el 2026-10-16). Ojo: el comentario de `netlify.toml:1` dice `estela.netlify.app`, pero la URL real es `esteladev.netlify.app` (el `git log` muestra "Update Netlify URL in README").

---

## 10. Pruebas de estrés (según el código, no ejecutadas con carga real)

- **`.log` de 500 MB**: la apertura es barata (`readFrom: "end"` arranca en `file.size`, `fs-log-source.ts:65`). Pero cada poll de 300 ms carga **el delta entero en un `ArrayBuffer` sin tope** (`fs-log-source.ts:132-134`): si el archivo crece rápido, picos de memoria del tamaño del delta. La UI solo retiene 200 líneas y el correlador 5 000 (amortiguan, no evitan el pico).
- **JSON de 20 MB**: `res.text()` lo carga entero (20 MB en memoria), `bodyText` se trunca a 1 MB pero `bytesRead` conserva el total (`http-client.ts:56-60`); el pretty-print hace `JSON.parse` del texto truncado (casi seguro falla → muestra texto crudo, `ResponseViewer.tsx:21-27`); al historial van 10 000 caracteres (`db.ts:17`). No rompe, desperdicia memoria.
- **Respuesta binaria**: **sin manejo**: `res.text()` decodifica a UTF-8 a ciegas (`http-client.ts:56`), sin detección de content-type ni ruta de descarga/blob. Resultado: mojibake en pantalla, sin crash. Parcial.
- **Request que nunca responde**: **sin `AbortController` ni timeout** en `executeRequest` (`http-client.ts:39-54`): el fetch cuelga para siempre, `sending` queda en `true` y el botón Enviar deshabilitado (`RequestForm.tsx:90`). Por extensión hay timeout de 30 s, pero el fallback es… el fetch directo que cuelga (`RequestRunner.tsx:24-33`). La UI queda atascada hasta recargar.
- **50 000 líneas de log**: el anillo del correlador conserva las últimas 5 000 y la UI las últimas 200; `correlate()` escanea el buffer en O(n) por clic (`correlator.ts:52-64`). Sin crash, con pérdida silenciosa de matches antiguos.

---

## 11. Bugs y riesgos conocidos

1. **Grave — request colgada bloquea la UI**: sin timeout/cancelación en fetch directo (§10). `RequestRunner.tsx:20-51` + `http-client.ts:39-54`.
2. **Grave — headers sensibles en historial**: `Authorization` y demás se persisten en claro en IndexedDB sin filtrar (`db.ts:38-51`).
3. **Grave/medio — bridge sin validación de origen + content-script global**: `https://*/*` + `postMessage("*")` + sin `event.origin` permiten a cualquier web usar la extensión instalada como proxy de lectura contra localhost (§5, §8).
4. **Medio — tails sin tope**: delta ilimitado por poll en FS (`fs-log-source.ts:132`) y `Buffer.alloc(size-from)` en el demo (`demo-backend/index.js:49`).
5. **Medio — sin CSP ni headers de seguridad** (§8).
6. **Medio — binarios sin manejo** (§10).
7. **Leve — lógica duplicada**: `background.js:30-85` reimplementa `http-client.ts` a mano (riesgo de drift; ya difiere: `durationMs: 0` en error, línea 21).
8. **Leve — correlación solo UUID v4 estricto** (`log-parser.ts:4`): IDs no-v4 jamás correlacionan; documentado en ningún lado visible.
9. **Leve — legales con cabos sueltos**: "escríbenos" sin contacto; Términos declarado borrador (§9).
10. **Leve — marca inconsistente**: `DevTool/devtool` en manifest, DB, storage keys y paquete vs `Estela` en UI.
11. **Leve — el mock no demuestra correlación real**: UUID fijo (`mock-log-source.ts:4`); solo el simulador OPFS cita IDs reales.

---

## 12. Checklist para lanzamiento público

1. **[Bloqueante]** Timeout + botón Cancelar en requests (AbortController; p. ej. 30 s + cancel manual). Evidencia: §10, bug #1.
2. **[Bloqueante]** No persistir headers sensibles (lista de denegación `authorization|cookie|set-cookie` o allowlist) en `toHistoryEntry`. Evidencia: §8, bug #2.
3. **[Bloqueante]** Endurecer el bridge: validar `event.origin`/`event.source`, restringir `matches` del content-script a las páginas necesarias y documentar el riesgo. Evidencia: §5, bug #3.
4. **[Importante]** CSP + headers (`X-Content-Type-Options`, `Referrer-Policy`, `frame-ancestors`) vía `[[headers]]` o `_headers`. Evidencia: §8.
5. **[Importante]** Tope por poll en tails (delta máximo + rebase de offset) en `fs-log-source.ts` y demo `handleTail`. Evidencia: §10, bug #4.
6. **[Importante]** Respuestas no-JSON/binarias: no parsear a ciegas; ofrecer ver/descargar crudo según content-type. Evidencia: §10, bug #6.
7. **[Importante]** Tests de flujos UI (disparo→error, fuentes, correlación visible): hoy solo hay tests de stores/motor (§7).
8. **[Importante]** Contacto real en Privacidad y cerrar el borrador de Términos (o declararlos explícitamente provisionales en la UI). Evidencia: §9.
9. **[Opcional]** Unificar marca `devtool` → `estela` en identificadores visibles (manifest, nombre DB, títulos). Evidencia: bug #10.
10. **[Opcional]** Dominio propio, woff2 de marca y fallback de copia (`Hero.tsx:4`, `primitives.tsx:85`). Deuda declarada, no bloquea.
