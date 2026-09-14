# AGENTS.md

Repositorio con aplicaciones web personales. Cada app vive en su propia carpeta sin dependencias cruzadas; algunas son vanilla sin build y otras traen su propio toolchain (Node/Vite). Hay dos ahora: `calendarioTrabajo` (PWA vanilla) y `cursosTube` (React/Vite + Supabase).

## Comandos

```bash
python3 -m http.server 8080   # servir cualquier app vanilla localmente (SW/PWA requiere localhost o HTTPS)
python3 calendarioTrabajo/tools/make_icons.py   # regenerar iconos (requiere Pillow)
npm --prefix cursosTube run dev    # CursosTube en desarrollo (http://localhost:5173)
npm --prefix cursosTube run build  # compila a cursosTube/dist/
npm --prefix cursosTube run lint   # oxlint
```

No hay tests ni typecheck separado (`npm run build` ya corre `tsc -b`). Verificar cambios abriendo la app en un navegador.

## calandarioTrabajo (/calendarioTrabajo)

- Vanilla HTML/CSS/JS: `index.html`, `style.css`, `app.js`; PWA: `manifest.webmanifest`, `sw.js`, `icons/`.
- La semana base por defecto es **lunes 2026-09-14 (Semana A)**; se puede cambiar en Ajustes.
- Estado guardado en localStorage bajo las claves `turno.ref.v1`, `turno.overrides.v1`, `turno.theme.v1`.
- **Gotcha critic:** `sw.js` cachea `./`, `index.html`, `style.css`, `app.js`, etc. con un `VERSION = "calendario-v1"` hardcodeado. Si modificas un archivo cacheado y no incrementas `VERSION`, navegadores con la PWA instalada seguirán sirviendo la versión vieja offline. Incrementar siempre que cambie un asset core.
- El día actual se recalcula cada 60s (`setInterval` en `init`) y por el patrón de turno (Semana A/B alternando cada lunes).

## cursosTube (/cursosTube)

- React 19 + TypeScript + Vite + Tailwind v4. PWA generada con `vite-plugin-pwa`. Despliegue por GitHub Actions a `misclases.jesussanchez.me` (VPS IONOS).
- Offline-first: cursos/progreso/notas viven en `localStorage` (`yt_courses_app_*`); la nube es Supabase (Postgres + login Google) y se usa solo con sesión iniciada.
- Config de Supabase en `.env` (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`) solo para el build; sin ella la app funciona en modo local.
- **Keep-alive:** el plan gratuito de Supabase pausa el proyecto tras ~7 días sin actividad. El cron del VPS (`tools/keepalive.sh`, cada 6h) lo mantiene despierto. Si tocáis algo de esto, no romper el intervalo.
- **Gotcha:** GitHub Actions solo descubre workflows en la raíz del repo. El deploy de CursosTube vive en `.github/workflows/deploy-cursos-tube.yml` (raíz) y dispara solo con `paths: cursosTube/**`; necesita secrets (`VITE_SUPABASE_*`, `VPS_*`) en el repo `personales`.
- `npm run build` ya corre `tsc -b`; no hay otro typecheck. El build de PWA genera `dist/` con hashes; rsync usa `--delete`.

## Convenciones

- Todo el contenido (UI, comentarios de código, README, commits) está en **español**; mantenerlo.
- Los commits describen el cambio en español (ver `git log`).