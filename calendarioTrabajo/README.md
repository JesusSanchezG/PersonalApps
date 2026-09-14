# Calendario · 3×4

Aplicación web (PWA) personal para tener siempre a mano tu calendario laboral **3×4**: una semana trabajas 4 días y descansas 3; la siguiente se invierte. Sin servidor, sin dependencias, funciona offline.

## Cómo funciona el turno 3×4

Cada semana empieza el lunes y alterna:

| | L–M | X–J–V | S–D |
|---|---|---|---|
| **Semana A** | Trabajo | Descanso | Trabajo |
| **Semana B** | Descanso | Trabajo | Descanso |

La secuencia se repite: semana A → semana B → semana A → … La referencia por defecto es el **lunes 14 de septiembre de 2026 (Semana A)**.

## Características

- **Hoy**: tarjeta que indica si hoy trabajas o descansas y en qué semana (A/B) estás.
- **Calendario mensual** con los días coloreados: amarillo = trabajo, verde = descanso. El día actual se marca con rayado diagonal.
- **Navegación**: meses anteriores/siguientes, botón *Hoy* y campo *Ir a una fecha* para consultar cualquier día.
- **Día modificado**: verde con borde azul = trabajo cambiado a descanso; amarillo con borde rojo = descanso cambiado a trabajo. Se pueden añadir notas (festivos, horas extra, etc.).
- **Ajustes**: cambiar la semana base (lunes de referencia y tipo A/B) y restablecer todo.
- **PWA**: instalable y usable sin conexión. Tema claro/oscuro.

Los cambios se guardan localmente en el dispositivo (localStorage), no se envían a ningún servidor.

## Uso local

```bash
python3 -m http.server 8080
# abre http://localhost:8080
```

El service worker y la instalación como PWA requieren servir la app por `localhost` o HTTPS.

## Estructura

```
index.html            # interfaz
style.css             # estilos (variables de tema claro/oscuro)
app.js                # lógica del turno, calendario y edición
manifest.webmanifest  # metadatos de la PWA
sw.js                 # service worker (offline)
icons/                # iconos de la app
tools/make_icons.py   # regenera los iconos
```

Para regenerar los iconos:

```bash
python3 tools/make_icons.py
```

## Tecnologías

HTML, CSS y JavaScript puros, sin frameworks ni build. Iconos generados con Pillow (Python).