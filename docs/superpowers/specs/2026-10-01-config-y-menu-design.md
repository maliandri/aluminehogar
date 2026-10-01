# Proyecto B — Configuración del sitio + Editar menú del panel (con roles)

Fecha: 2026-10-01 · Estado: decisiones del dueño tomadas en la conversación; se trabaja directo sobre `master` (pedido explícito, sin ramas)
Continúa el proyecto A (marco con sidebar y pestañas con URL propia, ya en `master`).

## Objetivo

1. **Configuración del sitio:** que el dueño cambie desde el panel los datos que hoy están escritos en el código en ~20 lugares, sin deployar.
2. **Editar menú del panel (como Almamod):** renombrar, reordenar, ocultar, mover entre secciones, crear secciones y elegir qué rol ve cada opción.
3. **Vendedores dentro del panel:** el vendedor entra al panel y ve solo lo que el menú le permite, con el servidor mandando.

## Decisiones del dueño

- Las dos partes van en un solo proyecto (se ordena en tareas separadas dentro del plan).
- Datos editables: **datos de la tienda** (nombre, teléfono, WhatsApp, emails de contacto/notificaciones/info, dirección, ciudad), **redes** (Instagram, Facebook), **textos del inicio** (título y subtítulo del hero), **chatbot** (envío, formas de pago, políticas). Quedan fuera: SEO, plantillas de email, píxel de Facebook, dominio.
- Menú: alcance "todo como Almamod": renombrar, reordenar, ocultar, mover opciones entre secciones, crear secciones, roles por opción, "Restaurar de fábrica". No se pueden inventar pantallas nuevas: solo se ordenan las existentes.
- Roles: los vendedores **sí entran** al panel. Pantallas iniciales del vendedor: **Créditos** (solo los suyos, ya filtrado por el servidor), **Productos y stock** (solo ver), **Depósitos** (solo ver).
- Actualización de datos: **guardado al instante**; el sitio guarda una copia de la configuración y la renueva en el momento de guardar (no consulta la base en cada visita).

## Diseño

### Datos
- `SiteConfig`: un solo documento (`_id: 'default'`) con grupos `tienda`, `redes`, `inicio`, `chatbot`. Los valores actuales del código son los **valores por defecto** (`lib/site-defaults.js`): si no hay nada guardado, o la base falla, el sitio se ve exactamente igual que hoy.
- `MenuConfig`: un solo documento (`_id: 'default'`) con `secciones` y `items` (nombre, sección, visible, roles; el orden es el orden del arreglo). La **ruta y el ícono de cada pantalla salen siempre del catálogo en código** (`lib/admin-menu.js`); lo guardado no puede apuntar a rutas inventadas.
- Candado: las opciones `config-sitio` y `editar-menu` no se pueden ocultar ni sacarle el rol admin. Las secciones de fábrica no se borran (solo se ocultan). "Restaurar de fábrica" borra el documento y vuelve al menú del código.

### Permisos (el servidor manda)
- `lib/permisos.js`: tabla pantalla → `{ ver: [roles], editar: [roles] }`. Arranque: `productos`, `depositos`, `creditos`: ver = admin y vendedor, editar = solo admin; todo lo demás (`conversaciones`, `importar-pdf`, `promociones`, `medios-pago`, `usuarios`, `config-sitio`, `editar-menu`): solo admin.
- El menú **no puede dar más permisos** que la tabla: las casillas de rol solo ofrecen los roles con permiso de ver esa pantalla, y el servidor valida y descarta lo demás. La visibilidad del menú es cosmética; cada endpoint sigue validando el rol.
- Cambios de servidor: `GET /api/admin` (`me` y listado de productos) acepta también vendedor; el resto de las acciones de ese endpoint siguen siendo solo admin. `requireRole` produce un mensaje distinto de `requireAdmin`, por eso el mapeo de errores a 403 debe contemplarlo. No se modifica `lib/auth-helpers.js`.

### Lectura de la configuración
- `getSiteConfig()` (servidor): `unstable_cache` con etiqueta `site-config`; si falla devuelve los valores por defecto sin cachear el error. Al guardar, el endpoint llama `revalidateTag('site-config', { expire: 0 })` para que el cambio se vea al instante.
- El layout raíz (servidor) carga la configuración y la entrega a los componentes cliente con un `SiteProvider` / `useSite()`. Emails, chatbot y notificaciones la leen directo con `getSiteConfig()`.
- El menú del panel: después de `me`, el marco pide `GET /api/admin-menu` (ya filtrado por rol y permisos). Si falla, usa el menú de fábrica del código.

### Pantallas
- `Configuración → Configuración del sitio` (formulario de 4 bloques, con validación y mensajes claros).
- `Configuración → Editar menú del panel` (lista por sección; renombrar, subir/bajar, ocultar, cambiar de sección, casillas de rol, agregar sección, guardar, restaurar de fábrica).
- En modo solo lectura (vendedor), Productos y Depósitos ocultan los controles de edición; Créditos oculta aprobar/rechazar y la configuración de límites.

## Seguridad y errores
- Validación en servidor de todo lo que se guarda (largos máximos, formatos de teléfono/WhatsApp/email, URLs de redes solo `https`, ids del menú contra el catálogo, roles contra la tabla de permisos). Lo desconocido se descarta.
- Solo admin puede escribir configuración y menú. Lectura pública de `site-config` expone únicamente datos que ya son públicos en el sitio.
- Sin tests automáticos en el proyecto: verificadores en Node de las funciones puras (validación, permisos, menú) y lista de comprobación manual.

## Fuera de alcance
SEO, plantillas de email, píxel, dominio, ABM de clientes (proyecto C), AlumiCrédito (D), órdenes online (E), crear pantallas nuevas desde el editor.
