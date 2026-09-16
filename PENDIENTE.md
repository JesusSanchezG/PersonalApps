# PENDIENTE: migración CursosTube, Supabase y keep-alive

> Estado al 2026-09-16. Este fichero lo usan sesiones futuras de OpenCode para retomar el trabajo donde se quedó.

## Qué está hecho

- **Migrado** `CursosTube` → `cursosTube/` con historial completo (`git subtree`, 12 commits). Build y lint OK (`npm --prefix cursosTube run build` / `run lint`).
- **Despliegue adaptado al monorepo**: `.github/workflows/deploy-cursos-tube.yml` en la raíz (GitHub solo descubre workflows de la raíz), dispara con `paths: cursosTube/**` hacia el VPS (`/var/www/cursos.jesussanchez.me`).
- **Secrets** en `JesusSanchezG/PersonalApps`: los 5 creados (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VPS_HOST=74.208.197.7`, `VPS_PORT=22`, `VPS_SSH_KEY`).
- **Proyecto Supabase nuevo creado**: `djbobmvgqezcpzfawksp` (region `us-west-2`).
  - `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY` actualizados a los valores del nuevo proyecto.
  - **Esquema aplicado** (`supabase/schema.sql`): tablas `courses`, `video_progress`, `course_notes` + políticas RLS + índices. Verificado.
- **Keep-alive funcional en el VPS**:
  - `tools/keepalive.sh` corregido: el GET va ahora a `/auth/v1/health` (el nuevo gateway de Supabase devuelve 401 en `/rest/v1/` con anon; exige `service_role`). Probado a mano → HTTP 200.
  - Copia instalada en `/usr/local/bin/cursostube-keepalive` y **cron activo**: `0 */6 * * *` con `SUPABASE_URL` y `SUPABASE_ANON_KEY` del nuevo proyecto; log en `/var/log/cursostube-keepalive.log`. Prueba manual OK.
- **README de CursosTube** corregido: alias `ionos` → `vps`, y descripción del keep-alive actualizada.
- **Dominio final de producción: `cursos.jesussanchez.me`** (no `misclases.jesussanchez.me`):
  - DNS ya resolvía al VPS (`74.208.197.7`) y había certificado Let's Encrypt para el subdominio (antes redirigía a misclases).
  - Nginx reescrito: el site `cursos.jesussanchez.me` ahora sirve la SPA desde `/var/www/cursos.jesussanchez.me` (created, owner 1000:1000). `nginx -t` OK. Backup del antiguo en `cursos.jesussanchez.me.bak`.
  - Workflow, README y AGENTS.md actualizados al nuevo dominio.

## Pendiente

1. **Pushear un cambio bajo `cursosTube/**`** para disparar el deploy por GitHub Actions (el bundle desplegado aún se construyó sin el nuevo proyecto; el workflow inyecta los secrets del repo `personales`). Verificar en `https://cursos.jesussanchez.me`.
2. **Login por Google** (credenciales ya facilitadas por el usuario, fuera del repo; falta confirmar su aplicación en el panel):
   - Dashboard Supabase → Authentication → Providers → Google → activar y pegar el Client ID y Secret de Google OAuth del usuario.
   - Google Cloud Console → OAuth client → Authorized redirect URIs: `https://djbobmvgqezcpzfawksp.supabase.co/auth/v1/callback`; Authorized JavaScript origins: `https://cursos.jesussanchez.me`.
   - Si el OAuth está en modo Testing, publicarlo para acceso general.
   - **Cuidado:** no versionar las credenciales (GitHub push protection bloquea el push si detecta el Client ID/Secret).
   - La app redirige a `window.location.origin` (AuthContext.tsx), por lo que en cursos.jesussanchez.me encaja sin cambios de código.

## Notas

- Acceso al VPS: alias SSH real `vps` (`root@74.208.197.7`, `~/.ssh/id_ed25519`).
- DB de Supabase: **directo solo resuelve IPv6**; desde esta máquina hay que usar el pooler de transacción (`aws-0-us-west-2.pooler.supabase.com:6543`), host/user `postgres.djbobmvgqezcpzfawksp`. Contraseña con caracteres especiales: usar `PGPASSWORD` (o codificar la URI) en `psql`.
- El bundle local `dist/` está en `.gitignore`; solo existe el `dist/` remoto del VPS.