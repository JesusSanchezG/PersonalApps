# PENDIENTE: verificación del despliegue de CursosTube sin Supabase

> Estado al 2026-09-28. Este fichero lo usan sesiones futuras de OpenCode para retomar el trabajo donde se quedó.

## Contexto

`cursosTube` ya **no usa Supabase**. Se sustituyó por una API propia en Node, sin dependencias
y sin base de datos, que corre en el mismo VPS que sirve la SPA. La cuenta es privada
(usuario + contraseña) y el caché offline en `localStorage` se mantiene.

Ver el `cursosTube/README.md` para la arquitectura completa y `AGENTS.md` para los gotchas.

## Qué está hecho y desplegado

- **API en `/opt/cursostube/server/`**, servida por systemd (`cursostube-api`), escuchando solo en `127.0.0.1:8787`.
  - Usuario de servicio `cursostube` (sin privilegios), `ProtectSystem=strict`, escritura limitada a `data/`.
  - `data/` en `700` y los JSON en `600` (`umask 0o077` en el arranque y en `create-user.js`).
  - Contraseña con hash `scrypt`; tokens de sesión guardados como SHA-256. Cookie `HttpOnly` + `SameSite=Strict` + `Secure` (producción).
- **Nginx** con `location ^~ /api/` haciendo proxy a la API (backup en `cursos.jesussanchez.me.bak-api`).
- **SPA** desplegada en `/var/www/cursos.jesussanchez.me` (owner 1000:1000).
- **Cuenta creada** en el VPS para el usuario `jesus` (contraseña la elige el usuario; para cambiarla, `create-user.js` en el VPS).
- **Keep-alive de Supabase eliminado**: borrados el cron, `/usr/local/bin/cursostube-keepalive` y su log. El crontab del VPS está vacío.
- **Workflow actualizado**: sube `dist/` + `server/` y reinicia la API. Ya **no** usa secrets de Supabase (quedan huérfanos en el repo y se pueden borrar: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`).
- **Supabase borrado del repo**: `supabase/schema.sql`, `tools/keepalive.sh`, `src/services/supabaseClient.ts`, `.env.example` y la dependencia `@supabase/supabase-js`.

## Verificación automática hecha (E2E contra producción)

Comprobado por HTTP contra `https://cursos.jesussanchez.me`: SPA servida sin referencias a
Supabase, `health` correcto, `401` sin sesión, `401` con contraseña incorrecta, login real con
cookie `HttpOnly`/`Secure`/`SameSite=Strict`, alta de curso y progreso, persistencia de la
posición exacta (421 s) y de las notas, merge que no deja que una escritura vieja pise la nueva,
borrado en cascada, validaciones `400`, rate limit (`429` tras 8 intentos) y logout.

Los scripts están en `/tmp/ct-prod-e2e.py` y `/tmp/ct-test-e2e.py` (temporales, no versionados).

## Pendiente

1. **Probar de extremo a extremo en el navegador** (lo único que no se puede hacer por HTTP):
   - Abrir `https://cursos.jesussanchez.me` → iniciar sesión como `jesus`.
   - Añadir un curso, ver un vídeo unos segundos, **recargar** y comprobar que reaparece en el
     segundo exacto y en la misma clase.
   - Comprobar en `console` que no hay errores de red y que en `Application → Cookies` la sesión
     es `HttpOnly` y `Secure`.
   - Desprobar: si no hay red, la app debe seguir mostrando los datos desde `localStorage`.
2. **Borrar los secrets de Supabase** del repo `JesusSanchezG/PersonalApps` si ya no se usan.
3. **Commit**: los cambios están sin commitear en `main`.
4. Opcional: `npm audit` reporta vulnerabilidades en dependencias transitivas de `vite-plugin-pwa`;
   no se ha tocado por no afectar al bundle de la app.

## Notas

- Acceso al VPS: alias SSH real `vps` (`root@74.208.197.7`).
- `data/auth.json` es el único sitio con el hash de la contraseña: si se pierde, hay que volver a
  ejecutar `create-user.js` (las sesiones abiertas siguen siendo válidas).
- **Copia de seguridad** = `state.json` (y `auth.json` si se quiere conservar la contraseña).
- El `dist/` local está en `.gitignore`; solo existe el remoto.
