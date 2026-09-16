#!/usr/bin/env bash
# Keep-alive de Supabase: evita que el proyecto del plan gratis se pause
# por inactividad (~7 días). Ejecutar desde un cron de un servidor SIEMPRE
# encendido (p. ej. el VPS donde vive la web).
#
# Uso:
#   SUPABASE_URL=https://xxx.supabase.co SUPABASE_ANON_KEY=eyJ... ./keepalive.sh
#
# Instalación en el VPS (una sola vez):
#   install -m 755 tools/keepalive.sh /usr/local/bin/cursostube-keepalive
#   crontab -e  ->  añadir:
#     0 */6 * * * SUPABASE_URL=https://xxx.supabase.co SUPABASE_ANON_KEY=eyJ... \
#         /usr/local/bin/cursostube-keepalive >> /var/log/cursostube-keepalive.log 2>&1
#   (6 horas es más que suficiente: Supabase pausa tras ~7 días sin actividad)

SUPABASE_URL="${SUPABASE_URL:-}"
SUPABASE_ANON_KEY="${SUPABASE_ANON_KEY:-}"

if [ -z "$SUPABASE_URL" ] || [ -z "$SUPABASE_ANON_KEY" ]; then
  echo "ERROR: define SUPABASE_URL y SUPABASE_ANON_KEY (ver cabecera del script)." >&2
  exit 1
fi

# Un GET a /auth/v1/health despierta el compute de Supabase y responde 200
# con la anon key. /rest/v1/ con anon ya no sirve: exige service_role.
code="$(curl -sS -o /dev/null -w '%{http_code}' --max-time 30 \
  -H "apikey: $SUPABASE_ANON_KEY" \
  -H "Authorization: Bearer $SUPABASE_ANON_KEY" \
  "$SUPABASE_URL/auth/v1/health")"

if [ "${code:-000}" = "200" ]; then
  echo "$(date -Is) OK: Supabase activo (HTTP $code)"
else
  echo "$(date -Is) ERROR: HTTP $code al despertar Supabase" >&2
fi