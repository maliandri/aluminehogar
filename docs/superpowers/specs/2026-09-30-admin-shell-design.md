# Proyecto A — Estructura del panel admin (sidebar + pestañas con URLs)

Fecha: 2026-09-30 · Estado: diseño aprobado, pendiente de revisión del spec
Rama de trabajo: `admin-shell` (no se trabaja sobre `master`, que deploya a producción)

## Contexto y objetivo

El panel admin de Aluminé Hogar es hoy un único componente `AdminPanel` en `nextjs/app/admin/page.js`
(~2.270 líneas) con 8 pestañas planas controladas por `useState('productos')`. Consecuencias:

- No hay URL por pestaña: no se puede recargar ni compartir un link ni usar el botón Atrás.
- El admin se dibuja dentro del layout público (Header, Footer, WhatsApp, chatbot).
- El control de acceso es solo del navegador (`isAdmin()` lee el rol del JWT decodificado desde `localStorage`
  y muestra un `alert`). Los endpoints ya protegen los datos con `requireAdmin`; la pantalla no.

Objetivo: adoptar el patrón del sistema Almamod del dueño: un **sidebar con secciones**; al elegir una sección
aparecen **arriba, como pestañas, las funciones de esa sección**. Este proyecto (A) es solo la estructura.
Los proyectos siguientes se enchufan acá: **B** (editar menú + configuración del sitio), **C** (ABM de clientes),
**D** (AlumiCrédito), **E** (órdenes online).

Criterio de éxito: el admin ve el mismo contenido y funcionalidad que hoy, reorganizado en sidebar + pestañas
con URL propia, sin Header/Footer público, y alguien que no es admin no llega a ver el panel.

## Decisiones tomadas

- Enfoque: **marco con URLs reales** (descartados: sidebar sobre el `page.js` actual; reorganizar todo el sitio en grupos de rutas).
- Sidebar a la izquierda (como en las capturas de Almamod); en celular se oculta detrás de un botón de menú.
- Reparto de las pestañas actuales:

| Sección | Pestañas |
|---|---|
| Gestión de Ventas | Créditos · Conversaciones |
| Store | Productos · Depósitos · Importar PDF |
| Marketing | Promociones · Medios de pago |
| Configuración | Usuarios |

Las secciones sin pestañas todavía (Clientes, Órdenes, etc.) se agregan en proyectos posteriores.

## Estructura

```
nextjs/app/admin/
  layout.js                         marco: sidebar, pestañas, barra superior, verificación de rol
  page.js                           redirige a /admin/store/productos
  store/productos/page.js
  store/depositos/page.js
  store/importar-pdf/page.js
  ventas/creditos/page.js
  ventas/conversaciones/page.js
  marketing/promociones/page.js
  marketing/medios-pago/page.js
  configuracion/usuarios/page.js
nextjs/components/admin/            un archivo por panel (movido desde page.js sin cambiar su lógica)
nextjs/lib/admin-menu.js            única fuente del menú
```

### Menú (`lib/admin-menu.js`)

Lista de ítems `{ id, seccion, etiqueta, icono, ruta, roles }`, más el orden y la etiqueta de cada sección.
En A todos los ítems llevan `roles: ['admin']`. El campo existe para que B reemplace el origen del menú
(código → base de datos) sin cambiar el marco, y para permitir más adelante que otro rol vea alguna pestaña.

### Marco (`app/admin/layout.js`)

- Sidebar con las secciones; la sección activa se deduce de la URL.
- Pestañas de la sección activa arriba del contenido.
- Barra superior propia: usuario, "Ver tienda", "Cerrar sesión".
- `/admin` redirige a Productos para no romper links existentes.

## Seguridad

- Nuevo `GET /api/admin?action=me` (solo admin): devuelve `{ ok: true, usuario }` con token válido y rol admin;
  401/403 en otro caso. Reutiliza `authenticateAdmin` del mismo `route.js`.
- El layout llama a `me` al entrar. Mientras responde muestra una pantalla de carga **sin dibujar** sidebar ni panel.
  Con 401/403 redirige a `/` sin `alert`.
- Los endpoints existentes siguen validando `requireAdmin`; `me` es una capa adicional.
- No se modifican `lib/auth-helpers.js`, `lib/models/User.js` ni el formato del JWT.
- Fuera de alcance: acceso del vendedor al panel (sigue usando `VendedorModal`) y limpieza de sesión al vencer el token
  (el 403 en lugar de 401 es un hallazgo previo de la auditoría; el marco redirige igual).

## Layout público

Un componente `PublicChrome` (cliente, usa `usePathname`) envuelve Header, Footer, WhatsAppButton y ChatBot en
`app/layout.js` y no los dibuja cuando la ruta empieza con `/admin`. Es el único cambio al layout raíz;
no se mueve ninguna página pública.

## Plan de migración (rama `admin-shell`, un commit por paso, cada uno compila y se puede desplegar)

1. Extraer a `components/admin/` los paneles autónomos, uno por commit: Conversaciones, Usuarios (con Invitaciones),
   Créditos, Depósitos, Medios de pago, Promociones, Importar PDF. `page.js` los importa. El admin se ve idéntico.
2. Extraer Productos: lista, filtros, stock, `ProductForm`, `BuscarImagenModal` y el toggle Mostrar, con todo su estado.
3. Agregar `lib/admin-menu.js`, el endpoint `me`, `PublicChrome`, el marco y las páginas por pestaña; `/admin` redirige.
4. Limpieza: borrar lo que quedó sin uso en `page.js` y revisar imports.

Se revisa en la URL de prueba que Vercel genera para la rama y recién después se une a `master`.

## Verificación

- `next build` sin errores en cada commit.
- Lista de comprobación por pestaña en la URL de prueba: abrir, listar, crear/editar/eliminar donde aplique, y repetir lo
  construido recientemente: toggle Mostrar, Importar PDF, Buscar imagen, stock por depósito.
- Acceso: sin sesión y con un usuario no admin no se ve el panel; con admin sí.
- Si el proyecto ya tiene herramienta de tests, una prueba chica de que cada ruta del menú tiene su página.
  Si no la tiene, no se instala una solo para esto (se confirma en el plan).

## Riesgos

- Partir `page.js`: un panel podría depender de estado compartido que no se vio. Mitigación: ir de a uno por commit.
- Hidratación de Zustand: el marco no debe decidir antes de que el store cargue; se espera a la verificación con `me`.
- Saltos de línea mixtos (CRLF/LF) en los archivos: preservar el existente al mover código.

## Fuera de alcance

Menú editable y configuración del sitio (B), pestañas nuevas como Clientes y Órdenes (C y E), acceso del vendedor,
rediseño del contenido interno de cada panel.
