# PENDIENTE: migración CursosTube, Supabase y keep-alive

> Estado al 2026-09-14. Este fichero lo usan sesiones futuras de OpenCode para retomar el trabajo donde se quedó.

## Qué está hecho

- **Migrado** `CursosTube` → `cursosTube/` con historial completo (`git subtree`, 12 commits). Build y lint OK (`npm --prefix cursosTube run build` / `run lint`).
- **Despliegue adaptado al monorepo**: `.github/workflows/deploy-cursos-tube.yml` en la raíz (GitHub solo descubre workflows de la raíz), dispara con `paths: cursosTube/**` hacia el VPS (`/var/www/misclases.jesussanchez.me`, dominio verificado byte a byte).
- **Secrets** en `JesusSanchezG/PersonalApps`: los 5 creados (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VPS_HOST=74.208.197.7`, `VPS_PORT=22`, `VPS_SSH_KEY`).
- **Keep-alive instalado en el VPS**: `/usr/local/bin/cursostube-keepalive` (copia de `cursosTube/tools/keepalive.sh`), chmod 755. **Aún sin cron** (falta el proyecto).

## Bloqueo: el proyecto de Supabase antiguo ya no existe

La app apunta a `kaulvejowumizovgdhbs.supabase.co` (bundle desplegado y `supabase/schema.sql`), pero ese subdominio **no resuelve en ningún DNS** (NXDOMAIN en Google/Cloudflare; `supabase.co` sí resuelve). No está "pausado", está **borrado/cambiado**. El usuario va a crear un proyecto Supabase nuevo gratuito.

## Al recibir los 3 datos del usuario (Project URL, anon key, connection string PG)

1. `gh secret set VITE_SUPABASE_URL -R JesusSanchezG/PersonalApps`
2. `gh secret set VITE_SUPABASE_ANON_KEY -R JesusSanchezG/PersonalApps`
3. Ejecutar el esquema: `psql "$CONNECTION_STRING" -f supabase/schema.sql`
4. Cron en el VPS (root):
   `0 */6 * * * SUPABASE_URL=<nueva_url> SUPABASE_ANON_KEY=<nueva_anon> /usr/local/bin/cursostube-keepalive >> /var/log/cursostube-keepalive.log 2>&1`
   y probar una ejecución manual.
5. Pushear un cambio bajo `cursosTube/**` para disparar el deploy por GitHub Actions y que el bundle use el nuevo proyecto. Verificar en `https://misclases.jesussanchez.me`.

## Notas

- Acceso al VPS: alias SSH real `vps` (`root@74.208.197.7`, `~/.ssh/id_ed25519`). El README de CursosTube menciona el alias `ionos`, que no existe — corregir si se retoca el README.
- Login por **Google**: hay que reconfigurarlo en el Dashboard (Authentication → Providers → Google). Sin login la app funciona igual en modo local (offline-first).