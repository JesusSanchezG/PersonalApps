# CursosTube 🎓

Plataforma web estilo Udemy para convertir **cursos de YouTube** (playlists o videos largos) en cursos estructurados con seguimiento de progreso, apuntes y sincronización.

> **Producción:** https://cursos.jesussanchez.me
>
> 🗂 Este proyecto vive dentro del monorepo personal `personales`, en `cursosTube/`.
>
> 🔒 La cuenta es privada: todo el contenido (cursos, progreso y apuntes) requiere iniciar sesión con usuario y contraseña.

---

## ✨ Características

- **Añadir cursos de YouTube** pegando la URL de una playlist o un video individual (sin necesidad de API key: usa endpoints públicos gratuitos con fallback automático).
- **Progreso automático**: al terminar un video se marca con una bolita verde, se guarda el checkpoint (segundo exacto) y hay autoplay hacia la siguiente clase con 1s de espera.
- **Reanudación**: al volver a entrar en un curso, el player arranca en el segundo exacto donde lo dejaste y en la clase correcta.
- **Al volver a una clase anterior**, el video arranca desde 0 (no salta sola a la siguiente).
- **Apuntes por lección y por curso**: botón para insertar el minuto actual `[12:34]`, saltos rápidos a esos minutos, copiar/descargar en Markdown, guardado automático.
- **Favoritos** con sección dedicada en el home.
- **Cuenta privada con usuario y contraseña**: la contraseña se verifica contra un hash `scrypt` guardado en el servidor; el navegador solo recibe una cookie de sesión opaca.
- **Offline-first**: los datos viven en `localStorage` como caché y se suben al servidor cuando hay conexión.
- **Eliminación segura en multi-dispositivo**: los cursos borrados no se "resucitan" al sincronizar (tombstones).
- **Diseño minimalista** navy + gris ostra, responsive, con fullscreen de video contenido y rotación automática a horizontal en móvil.

---

## 🛠 Stack

| Capa | Tecnología |
|---|---|
| Frontend | React 19 + TypeScript + Vite 8 |
| Estilos | Tailwind CSS v4 |
| Iconos | lucide-react |
| Backend | Node 22 puro (`node:http` + `node:crypto`), **sin dependencias ni base de datos** |
| Persistencia | Un único `state.json` en el VPS, escrito de forma atómica |
| Auth | `scrypt` + cookie de sesión opaca (`HttpOnly`, `SameSite=Strict`, `Secure`) |
| API de YouTube | oEmbed + instancias públicas Invidious/Piped (gratis) |
| Despliegue | VPS IONOS + Nginx (proxy a la API) + systemd + Certbot |

> No hay `.env` ni claves de API: el frontend siempre habla con `/api` en el mismo origen.

---

## 📦 Uso en desarrollo

El `dev` necesita dos procesos: la API y el Vite (que hace de proxy de `/api`).

```bash
npm install
npm run api        # API en http://127.0.0.1:8787
npm run dev        # http://localhost:5173 (proxy /api -> 8787)
```

Otros scripts:

```bash
npm run build      # compila a dist/
npm run lint       # oxlint
npm run preview    # sirve el build local
npm run create-user   # crea o cambia la cuenta (ver abajo)
```

### Crear la cuenta

El login por HTTP **nunca** crea cuentas: así, quien descubra un servidor recién desplegado no puede quedarse con él. La cuenta se configura por SSH, una sola vez.

```bash
# Interactivo (pregunta usuario y contraseña; no queda en el historial)
CURSOS_DATA_DIR=./server/data npm run create-user
```

O con variables de entorno (útil para provisionar el VPS):

```bash
CURSOS_DATA_DIR=/opt/cursostube/data CURSOS_USER=jesus CURSOS_PASSWORD='...' \
  node server/create-user.js
```

Para **cambiar la contraseña**, vuelve a ejecutar el script con la cuenta nueva: las sesiones ya abiertas siguen siendo válidas hasta que caduquen.

---

## 🔌 API

Todas las rutas cuelgan de `/api` y exigen la cookie de sesión, salvo `GET /api/health`.

| Método | Ruta | Qué hace |
|---|---|---|
| `GET` | `/api/health` | Estado y si hay cuenta creada (no requiere sesión) |
| `GET` | `/api/session` | Usuario de la sesión actual, o `null` |
| `POST` | `/api/session` | Login. Cuerpo `{ username, password }` |
| `DELETE` | `/api/session` | Logout (invalida el token en el servidor) |
| `GET` | `/api/state` | Estado completo: `{ courses, progress, updatedAt }` |
| `PUT` | `/api/courses/:id` | Upsert de un curso. Responde `{ course }` |
| `DELETE` | `/api/courses/:id` | Borra el curso **y** su progreso |
| `PUT` | `/api/progress/:courseId` | Upsert de progreso y apuntes. Responde `{ progress }` |

Notas de diseño:

- **El merge es por `updatedAt`, campo a campo.** Cada curso y cada entrada de `videoProgress` se comparan por su propia fecha, así que un dispositivo con el reloj atrasado no pisa la nota o la posición de otro dispositivo.
- **Notas y posiciones nunca se pierden**: se escriben con `Math.floor` y se comparan como enteros, no como `float`.
- **La API es idempotente**: subir dos veces el mismo curso no duplica nada.

### Variables de entorno del servidor

| Variable | Por defecto | Para qué |
|---|---|---|
| `PORT` | `8787` | Puerto de escucha |
| `HOST` | `127.0.0.1` | Solo local; nginx hace de proxy |
| `CURSOS_DATA_DIR` | `server/data` | Dónde se guardan `auth.json`, `sessions.json` y `state.json` |
| `CURSOS_SECURE_COOKIES` | *(desactivado)* | **Actívalo en producción**: marca la cookie como `Secure` |

---

## 🚀 Despliegue en IONOS (VPS + Nginx)

El despliegue lo hace el workflow del monorepo (`.github/workflows/deploy-cursos-tube.yml`): en cada push a `main` que toca `cursosTube/**` compila, sube `dist/` y el código del servidor, y reinicia la API. Necesita estos **secrets** en el repo `personales`: `VPS_HOST`, `VPS_PORT`, `VPS_SSH_KEY`.

Manual (fallback), desde `cursosTube/`:

```bash
npm run build
rsync -az --delete dist/ vps:/var/www/cursos.jesussanchez.me/
rsync -az --delete --exclude 'data' server/ vps:/opt/cursostube/server/
ssh vps "chown -R cursostube:cursostube /opt/cursostube \
       && systemctl restart cursostube-api && nginx -t && systemctl reload nginx"
```

> `vps` es un alias SSH definido en `~/.ssh/config`. El `--exclude 'data'` es importante: sin él, un `rsync --delete` borraría los cursos y la cuenta del servidor.

### Configuración inicial (solo la primera vez)

```bash
# 1. Usuario de servicio y directorio de la API
ssh vps "useradd --system --home /opt/cursostube --shell /usr/sbin/nologin cursostube
         && mkdir -p /opt/cursostube/data && chown -R cursostube:cursostube /opt/cursostube
         && chmod 700 /opt/cursostube/data"

# 2. Código, unidad systemd y arranque
rsync -az --delete --exclude 'data' server/ vps:/opt/cursostube/server/
ssh vps "chown -R cursostube:cursostube /opt/cursostube
         && install -m 644 /opt/cursostube/server/cursostube-api.service /etc/systemd/system/
         && systemctl daemon-reload && systemctl enable --now cursostube-api"

# 3. Cuenta
ssh vps "sudo -u cursostube env CURSOS_DATA_DIR=/opt/cursostube/data \
         CURSOS_USER=jesus CURSOS_PASSWORD='...' node /opt/cursostube/server/create-user.js"

# 4. SPA + certificado
ssh vps "mkdir -p /var/www/cursos.jesussanchez.me"
ssh vps "certbot --nginx -d cursos.jesussanchez.me --non-interactive --agree-tos"
```

Verifica que la API quedó viva (responde sin sesión, así que no hace falta login):

```bash
ssh vps "curl -sf http://127.0.0.1:8787/api/health"     # -> {"ok":true,"hasAccount":true}
```

### Nginx

El server block sirve la SPA y hace de proxy a la API. El prefijo `^~` da prioridad al bloque `/api/` sobre el regex de assets de abajo:

```nginx
location ^~ /api/ {
    proxy_pass http://127.0.0.1:8787;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_read_timeout 30s;
    client_max_body_size 8m;
}

location / {
    try_files $uri $uri/ /index.html;
}
```

> Los assets de Vite llevan hash (`index-abc123.js`), así que la caché inmutable es segura: cada deploy genera nombres nuevos. El service worker se sirve con `no-cache` a propósito.

### La unidad systemd

`server/cursostube-api.service` corre la API como el usuario sin privilegios `cursostube`, con `ProtectSystem=strict` y `ReadWritePaths` limitado a `data/`: el proceso no puede escribir nada más en el disco.

---

## 🔄 Flujo de trabajo con GitHub

El código vive en el monorepo `personales` (rama `main`).

```bash
git status && git diff
git add . && git commit -m "Descripción del cambio" && git push
# El despliegue a producción es automático (workflow) si el push toca cursosTube/**
```

> Cambios en otras apps del monorepo (p. ej. `calendarioTrabajo/`) **no** disparan el despliegue de CursosTube (filtro de rutas en el workflow).

### Reglas de oro

- **Nunca** hagas `git add` de `node_modules/`, `dist/` ni `server/data/` (ya están en `.gitignore`).
- `server/data/` contiene el hash de la contraseña y las sesiones: solo `cursostube` puede leerlo (`700`/`600`).
- Para hacer una copia de seguridad no hay nada más que `state.json` (y `auth.json` si quieres conservar la contraseña).

---

## 🔒 Seguridad

| Qué | Dónde está | Notas |
|---|---|---|
| Contraseña de la cuenta | `data/auth.json` (hash `scrypt`, 600) | Nunca sale del VPS en claro |
| Tokens de sesión | `data/sessions.json` (hash SHA-256, 600) | Se guardan hasheados; el token va en la cookie |
| Datos de cursos | `data/state.json` (600) | Solo accesibles con una sesión válida |
| Intentos de login | En memoria, 8 por IP cada 15 min | Devuelve `429` al superarlos |
| Credenciales SSH | `~/.ssh/` (fuera del repo) | Secretos de GitHub Actions, nunca en el código |

La API además rechaza peticiones cuyo `Origin` no coincida con el `Host`, y limita el cuerpo a 4 MB.

---

## 📁 Estructura del proyecto

```
├── ideas/                          # Mockups de referencia
├── server/
│   ├── index.js                    # Router HTTP, validaciones, rate limit
│   ├── auth.js                     # scrypt, sesiones, cookie
│   ├── store.js                    # state.json, merges, escritura atómica
│   ├── create-user.js              # Alta/cambio de cuenta por SSH
│   └── cursostube-api.service      # Unidad systemd
├── src/
│   ├── components/
│   │   ├── auth/                   # Modal de login
│   │   ├── common/                 # Navbar, Modal
│   │   ├── course/                 # Reproductor, temario, notas, curso
│   │   └── home/                   # Home, tarjetas, favoritos, añadir curso
│   ├── context/                    # AuthContext, CourseContext
│   ├── services/                   # youtube.ts, storage.ts, api.ts, sync.ts
│   └── types/                      # Tipos del dominio
└── dist/                           # Build (ignorado por git)
```
