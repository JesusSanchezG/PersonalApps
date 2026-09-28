# AGENTS.md

> Estado de trabajo: ver `PENDIENTE.md` (handoff del despliegue de CursosTube sin Supabase).

Monorepo de aplicaciones web personales. **No hay `package.json` en la raíz**: cada app trae su propio toolchain y no comparten dependencias. Apps: `calendarioTrabajo` (PWA vanilla, sin build) y `cursosTube` (React/Vite + API propia en Node).

## Comandos

```bash
python3 -m http.server 8080   # servir cualquier app vanilla (SW/PWA requiere localhost o HTTPS)
python3 calendarioTrabajo/tools/make_icons.py   # regenerar iconos (requiere Pillow)

npm --prefix cursosTube ci      # instalar (desde la raíz: el prefijo es obligatorio)
npm --prefix cursosTube run api        # API en http://127.0.0.1:8787 (en otra terminal)
npm --prefix cursosTube run dev        # http://localhost:5173 (hace de proxy de /api)
npm --prefix cursosTube run build      # tsc -b && vite build -> cursosTube/dist/
npm --prefix cursosTube run lint       # oxlint (config en .oxlintrc.json)
npm --prefix cursosTube run preview    # sirve el build local
npm --prefix cursosTube run create-user   # crea/cambia la cuenta (ver abajo)
```

No hay tests. No hay typecheck separado: `npm run build` ya corre `tsc -b`. Verificar cambios abriendo la app en un navegador.

## calendarioTrabajo (/calendarioTrabajo)

- Vanilla HTML/CSS/JS: `index.html`, `style.css`, `app.js`; PWA: `manifest.webmanifest`, `sw.js`, `icons/`. Sin dependencias ni build.
- Semana base por defecto **lunes 2026-09-14 (Semana A)** (`DEFAULT_REF` en `app.js:15`); se cambia en Ajustes.
- Estado en localStorage: `turno.ref.v1`, `turno.overrides.v1`, `turno.theme.v1`.
- **Gotcha crítico:** `sw.js` precachea `CORE` (`./`, `index.html`, `style.css`, `app.js`, manifest, iconos) con un `VERSION = "calendario-v1"` hardcodeado. Si tocas un asset de `CORE` y no incrementas `VERSION`, los navegadores con la PWA instalada siguen sirviendo la versión vieja. Incrementar siempre.
- "Hoy" se recalcula cada 60 s (`setInterval` en `init`).

## cursosTube (/cursosTube)

- React 19 + TypeScript ~6 + Vite 8 + Tailwind v4. PWA con `vite-plugin-pwa` (`registerType: 'autoUpdate'`).
- **Tailwind v4 es CSS-first: no existe `tailwind.config.js`.** Los tokens van en el bloque `@theme` de `src/index.css`; los colores de marca son `--color-oyster-*` (gris ostra) sobre navy.
- **`devOptions.enabled: true` en el service worker:** en `npm run dev` el SW cachea igual. Si ves una vista vieja, purga la caché desde DevTools.
- `tsconfig.app.json` es estricto y no obvious: `verbatimModuleSyntax` (obligatorio `import type` para tipos), `erasableSyntaxOnly` (prohibidos `enum`, `namespace` y parameter properties), `noUnusedLocals`/`noUnusedParameters`.
- Offline-first: todo vive en localStorage bajo `yt_courses_app_*` (`_courses_v1`, `_progress_v1`, `_settings_v1`, `_deleted_v1`). La nube (API propia) se usa solo con sesión iniciada.
- `npm run dev` **necesita la API en paralelo** en el puerto 8787: Vite hace de proxy de `/api` (`vite.config.ts`).

### API propia (sin Supabase, sin base de datos)

- El backend vive en `cursosTube/server/` y usa **solo `node:http` + `node:crypto`**: cero dependencias, cero `npm install` en el servidor.
- **La cuenta se crea por SSH con `create-user.js`, nunca por HTTP**, para que quien descubra un servidor recién desplegado no pueda quedarse con él. Cambiar la contraseña = volver a ejecutar el script.
- Contraseña con hash `scrypt`; los tokens de sesión se guardan **hasheados** (SHA-256) en `sessions.json`. Cookie `HttpOnly` + `SameSite=Strict`, y `Secure` solo si `CURSOS_SECURE_COOKIES=1` (**obligatorio en producción**, detrás de nginx con TLS).
- `state.json` es el estado completo (`courses`, `progress`, `updatedAt`); se escribe con temporal + `rename` para que un corte no lo corrompa. `data/` va en `.gitignore`.
- **El merge es por `updatedAt`, campo a campo**: cada curso y cada entrada de `videoProgress` se comparan por su propia fecha, para que un dispositivo con el reloj atrasado no pise la posición ni las notas de otro. Esa es la razón de ser de la reanudación entre dispositivos.
- El proceso aplica `umask 0o077` al arrancar (y `create-user.js` también): `data/` en `700` y los JSON en `600`.
- La API rechaza peticiones con `Origin` distinto del `Host`, limita el cuerpo a 4 MB y hace rate limit de login (8 intentos por IP cada 15 min).
- ⚠️ Al hacer `rsync --delete` de `server/` **excluir `data/`** o se borra la cuenta y todos los cursos.

### Sincronización en el cliente

- `src/services/sync.ts` es el único que habla con la API (`api.ts` es un wrapper de `fetch` con la cookie). Las escrituras van en **colas debounced** (curso 500 ms, progreso 2 s, borrado 300 ms) y hay `flush` en `pagehide`/visibilidad, además de sync al iniciar sesión, al recuperar el foco y cada 45 s.
- Las notas de lección viven en `videoProgress[videoId].notes`; las generales del curso en `overallNotes`. Ajustes de reproducción son **por dispositivo**, no se suben.
- Borrados usan **tombstones** en `yt_courses_app_deleted_v1`; sin ellos, un curso borrado en un dispositivo "resucita" al sincronizar desde otro.
- La reanudación depende de `YouTubePlayer` (muestrea la posición cada 3 s) → `saveVideoPosition` → `lastPositionSeconds` + `lastPlayedVideoId`.

### Despliegue e infraestructura

- GitHub Actions solo descubre workflows en la raíz. El deploy vive en `.github/workflows/deploy-cursos-tube.yml` y solo dispara con `paths: cursosTube/**`; publica en `https://cursos.jesussanchez.me` (VPS IONOS `74.208.197.7`).
- Secrets requeridos en el repo `personales`: `VPS_HOST`, `VPS_PORT`, `VPS_SSH_KEY` (los de Supabase sobran y se pueden borrar).
- El workflow fija `defaults.run.working-directory: cursosTube`; **el paso de rsync lo sobrescribe a `${{ github.workspace }}`** a propósito (relative-from `..` sacaba el workspace). No unificar ambos.
- `rsync -az --delete` de `cursosTube/dist/` a `/var/www/cursos.jesussanchez.me/` + `chown -R 1000:1000`. Los assets de Vite llevan hash, así que la caché inmutable de nginx es segura.
- La API corre como **systemd `cursostube-api`** (unidad en `server/cursostube-api.service`), usuario `cursostube`, código en `/opt/cursostube/server/`, datos en `/opt/cursostube/data/`, escuchando solo en `127.0.0.1:8787`.
- Nginx hace de proxy con `location ^~ /api/`. El `^~` es necesario para que ese bloque gane al regex de assets de más abajo.
- La unidad usa `ProtectSystem=strict` + `ReadWritePaths=/opt/cursostube/data`: si añades rutas que la API deba escribir, hay que declararlas ahí o el servicio no arrancó.
- Acceso al VPS: alias SSH `vps`.
- No hay `.env` ni claves de API: el frontend siempre habla con `/api` en el mismo origen, así que no hay credenciales que proteger en el repo.

## Convenciones

- Todo el contenido (UI, comentarios, README, commits) está en **español**; mantenerlo.
- Comentarios de código existentes en inglés: no es обязаatorio traducirlos, pero los nuevos que expliquen *por qué* pueden ir en español.
