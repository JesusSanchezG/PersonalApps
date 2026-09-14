# CursosTube 🎓

Plataforma web estilo Udemy para convertir **cursos de YouTube** (playlists o videos largos) en cursos estructurados con seguimiento de progreso, apuntes y sincronización en la nube.

> **Producción:** https://cursos.jesussanchez.me

---

## ✨ Características

- **Añadir cursos de YouTube** pegando la URL de una playlist o un video individual (sin necesidad de API key: usa endpoints públicos gratuitos con fallback automático).
- **Progreso automático**: al terminar un video se marca con una bolita verde, se guarda el checkpoint (segundo exacto) y hay autoplay hacia la siguiente clase con 1s de espera.
- **Al volver a una clase anterior**, el video arranca desde 0 (no salta sola a la siguiente).
- **Apuntes por lección y por curso**: botón para insertar el minuto actual `[12:34]`, saltos rápidos a esos minutos, copiar/descargar en Markdown, guardado automático.
- **Favoritos** con sección dedicada en el home.
- **Sincronización en la nube con Supabase**: login por email + contraseña. Cursos, progreso y notas se sincronizan entre dispositivos (merge por fecha de modificación, sin pérdidas).
- **Offline-first**: los datos viven en `localStorage` como caché; la nube se usa solo con sesión iniciada.
- **Eliminación segura en multi-dispositivo**: los cursos borrados no se "resucitan" al sincronizar (tombstones).
- **Diseño minimalista** navy + gris ostra, responsive, con fullscreen de video contenido y rotación automática a horizontal en móvil.

---

## 🛠 Stack

| Capa | Tecnología |
|---|---|
| Frontend | React 19 + TypeScript + Vite 8 |
| Estilos | Tailwind CSS v4 |
| Iconos | lucide-react |
| Base de datos / Auth | Supabase (PostgreSQL + Auth) |
| API de YouTube | oEmbed + instancias públicas Invidious/Piped (gratis) |
| Despliegue | VPS IONOS + Nginx + Certbot (Let's Encrypt) |

---

## 📦 Uso en desarrollo

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # compila a dist/
npm run lint       # oxlint
npm run preview    # sirve el build local
```

### Configuración de Supabase (opcional pero recomendada)

1. Crea un proyecto en [supabase.com](https://supabase.com).
2. Copia `.env.example` a `.env` y pega tus credenciales:

```bash
cp .env.example .env
```

```env
VITE_SUPABASE_URL=https://TU_PROYECTO.supabase.co
VITE_SUPABASE_ANON_KEY=tu_anon_public_key
```

> ⚠️ `.env` está en `.gitignore` — **nunca lo subas a GitHub**. La anon key es pública por diseño y está protegida por Row Level Security.

3. En el **SQL Editor** de Supabase, ejecuta el contenido de `supabase/schema.sql` (tablas + políticas RLS).
4. En **Authentication → Providers → Email**, desactiva **"Confirm email"** para que el registro sea inmediato.
5. Sin Supabase configurado la app funciona igual con almacenamiento local.

---

## 🚀 Despliegue en IONOS (VPS + Nginx)

El servidor ya tiene Nginx y Certbot configurados. Cada dominio vive en `/var/www/<dominio>`.

### 1. Compilar

```bash
npm run build
```

### 2. Subir al servidor

```bash
rsync -az --delete dist/ ionos:/var/www/cursos.jesussanchez.me/
```

(`ionos` es un alias SSH definido en `~/.ssh/config` apuntando a tu VPS.)

### 3. Configuración inicial (solo la primera vez)

Ya realizada en el despliegue inicial; documentada aquí por si se replica:

```bash
# Crear la carpeta del sitio
ssh ionos "mkdir -p /var/www/cursos.jesussanchez.me"

# Crear el server block de nginx (ver plantilla abajo)
ssh ionos "nano /etc/nginx/sites-available/cursos.jesussanchez.me"
ln -sf /etc/nginx/sites-available/cursos.jesussanchez.me /etc/nginx/sites-enabled/
nginx -t && systemctl reload nginx

# Certificado SSL
certbot --nginx -d cursos.jesussanchez.me --non-interactive --agree-tos
```

Plantilla del server block (SPA):

```nginx
server {
    server_name cursos.jesussanchez.me;
    root /var/www/cursos.jesussanchez.me;
    index index.html;

    gzip on;
    gzip_vary on;
    gzip_proxied any;
    gzip_comp_level 6;
    gzip_types text/plain text/css text/xml application/json application/javascript image/svg+xml;

    location / {
        try_files $uri $uri/ /index.html;
    }

    location ~* \.(?:ico|css|js|gif|jpe?g|png|svg|woff2?|eot|ttf|otf)$ {
        expires 6M;
        access_log off;
        add_header Cache-Control "public, max-age=15552000, immutable";
    }
}
```

> Los assets de Vite tienen hash (`index-abc123.js`), así que la caché inmutable es segura: cada deploy genera nombres nuevos.

---

## 🔄 Flujo de trabajo con GitHub

### Subir el proyecto por primera vez

```bash
git init
git add .
git commit -m "Primer commit: CursosTube"
git branch -M main
git remote add origin https://github.com/TU_USUARIO/cursos-web.git
git push -u origin main
```

### Después de cada cambio (desarrollo → GitHub → producción)

```bash
# 1. Ver qué cambió
git status
git diff

# 2. Subir los cambios a GitHub
git add .
git commit -m "Descripción del cambio"
git push

# 3. Desplegar en producción (desde tu máquina)
npm run build
rsync -az --delete dist/ ionos:/var/www/cursos.jesussanchez.me/
```

### Reglas de oro

- **Nunca** hagas `git add` de `.env`, `node_modules/` o `dist/` (ya están en `.gitignore`).
- La **anon key de Supabase** es pública por diseño (protegida por RLS); el **service_role key** jamás debe aparecer en el frontend ni en el repo.
- Si clonas el proyecto en otra máquina: `cp .env.example .env` y pega tus credenciales.
- Certbot renueva el certificado automáticamente (tarea programada en el servidor).

---

## 🔒 Seguridad

| Qué | Dónde está | ¿Existe riesgo? |
|---|---|---|
| Anon key Supabase | `.env` (ignorado) | No — pública por diseño, RLS protege los datos |
| Service role key | Nunca en el repo | Nunca exponer |
| Datos de usuarios | PostgreSQL Supabase | RLS: cada usuario solo ve/edita sus filas |
| Credenciales SSH | `~/.ssh/` (fuera del repo) | No |

---

## 📁 Estructura del proyecto

```
├── ideas/                 # Mockups de referencia
├── supabase/schema.sql    # Esquema de base de datos + RLS
├── src/
│   ├── components/
│   │   ├── auth/          # Modal de login/registro
│   │   ├── common/        # Navbar, Modal
│   │   ├── course/        # Reproductor, temario, notas, curso
│   │   └── home/          # Home, tarjetas, favoritos, añadir curso
│   ├── context/           # AuthContext, CourseContext
│   ├── services/          # youtube.ts, storage.ts, sync.ts, supabaseClient.ts
│   └── types/             # Tipos del dominio
└── .env.example           # Plantilla de configuración (copiar a .env)
```
