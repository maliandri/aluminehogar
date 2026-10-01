# Estructura del panel admin (sidebar + pestañas con URLs) — Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reemplazar el panel admin de una sola página con pestañas por un marco con sidebar a la izquierda, pestañas por sección arriba y una URL real por pestaña, sin Header/Footer públicos y con el rol verificado contra el servidor.

**Architecture:** Primero se mueven los paneles existentes, sin cambiar su código, de `app/admin/page.js` a `components/admin/` (un commit por panel, con un script que deduce los imports). Después se agrega el menú en `lib/admin-menu.js`, un endpoint `GET /api/admin?action=me`, `PublicChrome` (oculta el chrome público en `/admin`) y un `layout.js` del admin con una página por pestaña. `page.js` termina siendo solo un redirect a Productos.

**Tech Stack:** Next.js 16 (App Router), React, Tailwind, `lucide-react`, Zustand (`authStore`), axios (`services/api.js`), Node 22 para los scripts.

**Spec:** `docs/superpowers/specs/2026-09-30-admin-shell-design.md` (leerlo antes de empezar)

## Global Constraints

- Trabajar en la rama `admin-shell`. **No** commitear en `master` ni mergear a `master` sin aprobación explícita del dueño (`master` deploya a producción en `aluminehogar.com.ar`).
- No modificar `nextjs/lib/auth-helpers.js`, `nextjs/lib/models/User.js` ni el formato del JWT. No tocar `nextjs/lib/db.js` ni `nextjs/app/api/mercadopago/route.js`.
- Mover código **sin cambiar su lógica**: ningún panel cambia de comportamiento.
- Preservar el fin de línea (CRLF/LF) de cada archivo existente que se edite. Los scripts del plan ya lo hacen; con la herramienta Edit, si no encuentra un texto por los saltos de línea, usar un `node -e` que reemplace respetando `\r\n`.
- Estilos con Tailwind e íconos de `lucide-react` (ya instalados). No instalar dependencias nuevas.
- Textos de la interfaz en español rioplatense, igual que el panel actual.
- Cada commit debe compilar: `cd nextjs && npx next build`. Al compilar sin `DB_URI` aparecen errores de Mongo del sitemap; son esperados y no cuentan. Lo que importa es la línea `✓ Compiled successfully`.
- Terminar cada commit con la línea `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`.
- Para probar con `next dev` (Tasks 10 y 11) hace falta que `nextjs/.env.local` tenga `DB_URI`, `JWT_SECRET` y las claves de Cloudinary. Si falta alguna, copiar esa línea desde el `.env` de la raíz (ambos archivos están en `.gitignore`; nunca commitearlos ni pegar su contenido en el chat).
- `scripts/` está en `.gitignore`: las herramientas de este plan viven en `docs/superpowers/plans/`.

## Review Focus

1. **Sin sesión, token vencido o usuario no admin en `/admin/...`:** no se ve nada del panel (ni un instante) y se redirige a `/`. Cubierto en Task 11 (pantalla de carga hasta que `me` responde) y en la lista de comprobación de Task 12.
2. **`/admin/inexistente` o una ruta de `/admin` que no está en el menú:** Next muestra su 404 y el marco no marca ninguna sección ni muestra pestañas. Cubierto por `seccionDeRuta` en `verificar-menu.mjs` (Task 9).
3. **Rutas públicas que empiezan parecido (`/administrador`, `/producto/admin`) no deben perder Header/Footer.** Cubierto por `esRutaAdmin` en `verificar-menu.mjs` (Task 9).
4. **Recargar la página o usar Atrás/Adelante en una pestaña** mantiene la pestaña, y el link viejo `/admin` (que usa el Header) cae en Productos. Task 11 y Task 12.
5. **Celular:** el sidebar no ocupa el contenido, se abre con un botón y se cierra al elegir una pestaña. Task 11 y Task 12.

---

### Task 1: Extraer DepositosPanel

**Files:**
- Create: `nextjs/components/admin/DepositosPanel.jsx` (lo genera el script)
- Modify: `nextjs/app/admin/page.js` (el script saca el bloque y agrega el import)
- Tools (ya commiteadas con el plan): `docs/superpowers/plans/extraer-panel.cjs`

**Interfaces:**
- Consumes: nada.
- Produces: `components/admin/DepositosPanel.jsx` con `export default function DepositosPanel()`.

- [ ] **Step 1: Verificar el punto de partida**

Run (desde la raíz del repo `C:\proyectos\AlumineHogar`):
```bash
git branch --show-current && git status --short
```
Expected: `admin-shell`; solo aparecen sin commitear `Presupuesto - S02222 (1).pdf` y `backups/` (no tocarlos ni commitearlos).

- [ ] **Step 2: Correr el script de extracción**

```bash
node docs/superpowers/plans/extraer-panel.cjs DepositosPanel DepositosPanel DepositosPanel
```
Expected: `OK  nextjs\components\admin\DepositosPanel.jsx  (DepositosPanel; 117 líneas)` y una línea `imports: react[useState,useEffect] lucide[0] api[4]`.

- [ ] **Step 3: Compilar**

```bash
cd nextjs && npx next build 2>&1 | grep -E "Compiled|rror:|Failed|Type error"; cd ..
```
Expected: `✓ Compiled successfully`. Si aparece un error de "is not defined", falta un import: abrir el archivo nuevo y agregarlo.

- [ ] **Step 4: Revisar el diff**

```bash
git diff --stat
```
Expected: `page.js` pierde alrededor de 118 líneas y gana 1 (el import); `DepositosPanel.jsx` aparece como archivo nuevo de ~117 líneas.

- [ ] **Step 5: Commit**

```bash
git add nextjs/components/admin/DepositosPanel.jsx nextjs/app/admin/page.js
git commit -m "$(cat <<'EOF'
refactor: Extraer DepositosPanel del admin a components/admin

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 2: Extraer ConversationsPanel

**Files:**
- Create: `nextjs/components/admin/ConversationsPanel.jsx`
- Modify: `nextjs/app/admin/page.js`

**Interfaces:**
- Consumes: `extraer-panel.cjs` (Task 1).
- Produces: `components/admin/ConversationsPanel.jsx` con `export default function ConversationsPanel()`.

- [ ] **Step 1: Correr el script**

```bash
node docs/superpowers/plans/extraer-panel.cjs ConversationsPanel ConversationsPanel ConversationsPanel
```
Expected: `OK ... (ConversationsPanel; 272 líneas)`, `imports: react[useState,useEffect] lucide[3] api[2]`.

- [ ] **Step 2: Compilar**

```bash
cd nextjs && npx next build 2>&1 | grep -E "Compiled|rror:|Failed|Type error"; cd ..
```
Expected: `✓ Compiled successfully`.

- [ ] **Step 3: Commit**

```bash
git add nextjs/components/admin/ConversationsPanel.jsx nextjs/app/admin/page.js
git commit -m "$(cat <<'EOF'
refactor: Extraer ConversationsPanel del admin a components/admin

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 3: Extraer UsersPanel (con InvitationsBlock)

**Files:**
- Create: `nextjs/components/admin/UsersPanel.jsx`
- Modify: `nextjs/app/admin/page.js`

**Interfaces:**
- Consumes: `extraer-panel.cjs`.
- Produces: `components/admin/UsersPanel.jsx` con `export default function UsersPanel({ currentUserId })`. `InvitationsBlock` y `ROLE_LABELS_INVITACION` van en el mismo archivo (solo los usa `UsersPanel`).

- [ ] **Step 1: Correr el script** (mueve las tres piezas juntas)

```bash
node docs/superpowers/plans/extraer-panel.cjs UsersPanel UsersPanel ROLE_LABELS_INVITACION,InvitationsBlock,UsersPanel
```
Expected: `OK ... (ROLE_LABELS_INVITACION, InvitationsBlock, UsersPanel; 280 líneas)`, `imports: react[useState,useEffect] lucide[5] api[6]`.

- [ ] **Step 2: Compilar**

```bash
cd nextjs && npx next build 2>&1 | grep -E "Compiled|rror:|Failed|Type error"; cd ..
```
Expected: `✓ Compiled successfully`.

- [ ] **Step 3: Commit**

```bash
git add nextjs/components/admin/UsersPanel.jsx nextjs/app/admin/page.js
git commit -m "$(cat <<'EOF'
refactor: Extraer UsersPanel e InvitationsBlock del admin a components/admin

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 4: Extraer CreditosPanel

**Files:**
- Create: `nextjs/components/admin/CreditosPanel.jsx`
- Modify: `nextjs/app/admin/page.js`

**Interfaces:**
- Consumes: `extraer-panel.cjs`.
- Produces: `components/admin/CreditosPanel.jsx` con `export default function CreditosPanel()` (incluye `ESTADO_CREDITO_LABELS`).

- [ ] **Step 1: Correr el script**

```bash
node docs/superpowers/plans/extraer-panel.cjs CreditosPanel CreditosPanel ESTADO_CREDITO_LABELS,CreditosPanel
```
Expected: `OK ... (ESTADO_CREDITO_LABELS, CreditosPanel; 161 líneas)`, `imports: react[useState,useEffect] lucide[2] api[5]`.

- [ ] **Step 2: Compilar**

```bash
cd nextjs && npx next build 2>&1 | grep -E "Compiled|rror:|Failed|Type error"; cd ..
```
Expected: `✓ Compiled successfully`.

- [ ] **Step 3: Commit**

```bash
git add nextjs/components/admin/CreditosPanel.jsx nextjs/app/admin/page.js
git commit -m "$(cat <<'EOF'
refactor: Extraer CreditosPanel del admin a components/admin

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 5: Extraer MediosPagoPanel (y mover APLICA_A_LABELS a un archivo compartido)

`APLICA_A_LABELS` la usan `MediosPagoPanel` y `PromocionesPanel`, por eso va a su propio archivo antes de extraer los dos.

**Files:**
- Create: `nextjs/components/admin/etiquetas.js`
- Create: `nextjs/components/admin/MediosPagoPanel.jsx`
- Modify: `nextjs/app/admin/page.js`

**Interfaces:**
- Consumes: `extraer-panel.cjs`.
- Produces: `components/admin/etiquetas.js` exporta `APLICA_A_LABELS` (objeto con claves `todos`, `categoria`, `marca`, `producto`); `MediosPagoPanel.jsx` con `export default function MediosPagoPanel()`.

- [ ] **Step 1: Crear el archivo compartido**

Create `nextjs/components/admin/etiquetas.js` con exactamente:
```js
export const APLICA_A_LABELS = { todos: 'Todos los productos', categoria: 'Categoria', marca: 'Marca', producto: 'Producto especifico' };
```

- [ ] **Step 2: Cambiar `page.js` para que use el archivo compartido**

En `nextjs/app/admin/page.js`: (a) borrar la línea `const APLICA_A_LABELS = { todos: 'Todos los productos', categoria: 'Categoria', marca: 'Marca', producto: 'Producto especifico' };` (está justo antes de `function MediosPagoPanel`); (b) agregar, junto a los demás imports del principio del archivo (después de la línea `} from '@/services/api';`):
```js
import { APLICA_A_LABELS } from '@/components/admin/etiquetas';
```

- [ ] **Step 3: Correr el script, indicando el import extra**

```bash
ADMIN_EXTRA_IMPORTS="import { APLICA_A_LABELS } from './etiquetas';" node docs/superpowers/plans/extraer-panel.cjs MediosPagoPanel MediosPagoPanel MediosPagoPanel
```
Expected: `OK ... (MediosPagoPanel; 170 líneas)`, `imports: react[useState,useEffect] lucide[0] api[4]`.

- [ ] **Step 4: Compilar**

```bash
cd nextjs && npx next build 2>&1 | grep -E "Compiled|rror:|Failed|Type error"; cd ..
```
Expected: `✓ Compiled successfully`.

- [ ] **Step 5: Commit**

```bash
git add nextjs/components/admin/etiquetas.js nextjs/components/admin/MediosPagoPanel.jsx nextjs/app/admin/page.js
git commit -m "$(cat <<'EOF'
refactor: Extraer MediosPagoPanel y APLICA_A_LABELS compartido

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 6: Extraer PromocionesPanel

**Files:**
- Create: `nextjs/components/admin/PromocionesPanel.jsx`
- Modify: `nextjs/app/admin/page.js`

**Interfaces:**
- Consumes: `extraer-panel.cjs`; `APLICA_A_LABELS` de `components/admin/etiquetas.js` (Task 5).
- Produces: `components/admin/PromocionesPanel.jsx` con `export default function PromocionesPanel()`.

- [ ] **Step 1: Correr el script**

```bash
ADMIN_EXTRA_IMPORTS="import { APLICA_A_LABELS } from './etiquetas';" node docs/superpowers/plans/extraer-panel.cjs PromocionesPanel PromocionesPanel PromocionesPanel
```
Expected: `OK ... (PromocionesPanel; ~176 líneas)`, `imports: react[useState,useEffect] lucide[0] api[4]`.

- [ ] **Step 2: Compilar**

```bash
cd nextjs && npx next build 2>&1 | grep -E "Compiled|rror:|Failed|Type error"; cd ..
```
Expected: `✓ Compiled successfully`.

- [ ] **Step 3: Commit**

```bash
git add nextjs/components/admin/PromocionesPanel.jsx nextjs/app/admin/page.js
git commit -m "$(cat <<'EOF'
refactor: Extraer PromocionesPanel del admin a components/admin

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 7: Extraer PresupuestoPanel (Importar PDF)

**Files:**
- Create: `nextjs/components/admin/PresupuestoPanel.jsx`
- Modify: `nextjs/app/admin/page.js`

**Interfaces:**
- Consumes: `extraer-panel.cjs`.
- Produces: `components/admin/PresupuestoPanel.jsx` con `export default function PresupuestoPanel()` (incluye `fmtPrecio`, que solo usa este panel).

- [ ] **Step 1: Correr el script**

```bash
node docs/superpowers/plans/extraer-panel.cjs PresupuestoPanel PresupuestoPanel fmtPrecio,PresupuestoPanel
```
Expected: `OK ... (fmtPrecio, PresupuestoPanel; 190 líneas)`, `imports: react[useState,useEffect] lucide[2] api[3]`.

- [ ] **Step 2: Compilar**

```bash
cd nextjs && npx next build 2>&1 | grep -E "Compiled|rror:|Failed|Type error"; cd ..
```
Expected: `✓ Compiled successfully`.

- [ ] **Step 3: Commit**

```bash
git add nextjs/components/admin/PresupuestoPanel.jsx nextjs/app/admin/page.js
git commit -m "$(cat <<'EOF'
refactor: Extraer PresupuestoPanel (Importar PDF) a components/admin

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 8: Extraer ProductForm y crear ProductosPanel

`ProductForm` (con `BuscarImagenModal`) se mueve con el script. `ProductosPanel` se **crea** a partir del bloque Productos de `AdminPanel`; `page.js` todavía no lo usa (sigue funcionando como hasta ahora hasta Task 11), por eso en este commit hay código duplicado a propósito.

**Files:**
- Create: `nextjs/components/admin/ProductForm.jsx` (script)
- Create: `nextjs/components/admin/ProductosPanel.jsx` (script `crear-productos-panel.cjs`)
- Modify: `nextjs/app/admin/page.js` (solo por `ProductForm`)

**Interfaces:**
- Consumes: `extraer-panel.cjs`, `crear-productos-panel.cjs`.
- Produces: `components/admin/ProductForm.jsx` con `export default function ProductForm({ producto, categorias, onClose, onSuccess })`; `components/admin/ProductosPanel.jsx` con `export default function ProductosPanel()` (sin props; carga sus productos al montarse).

- [ ] **Step 1: Mover ProductForm y BuscarImagenModal**

```bash
node docs/superpowers/plans/extraer-panel.cjs ProductForm ProductForm ProductForm,BuscarImagenModal
```
Expected: `OK ... (ProductForm, BuscarImagenModal; 344 líneas)`, `imports: react[useState] lucide[7] api[6]`.

- [ ] **Step 2: Compilar** (comprueba que `page.js` sigue andando con el import nuevo)

```bash
cd nextjs && npx next build 2>&1 | grep -E "Compiled|rror:|Failed|Type error"; cd ..
```
Expected: `✓ Compiled successfully`.

- [ ] **Step 3: Crear ProductosPanel**

```bash
node docs/superpowers/plans/crear-productos-panel.cjs
```
Expected: `OK  nextjs\components\admin\ProductosPanel.jsx  (~367 líneas)`. Si falla con `"..." aparece N veces`, `page.js` cambió de forma desde que se escribió el script: leer el mensaje, ajustar el texto esperado del script y repetir.

- [ ] **Step 4: Inspeccionar el archivo generado**

```bash
head -16 nextjs/components/admin/ProductosPanel.jsx
grep -n "activeTab\|useAuthStore\|useRouter\|isAdmin\|hydrated" nextjs/components/admin/ProductosPanel.jsx
```
Expected: el `head` muestra `'use client';`, los imports (`useState, useEffect, useMemo`, lucide, `xlsxClient`, la API y `import ProductForm from './ProductForm';`) y `export default function ProductosPanel() {`; el `grep` no devuelve nada.

- [ ] **Step 5: Compilar**

```bash
cd nextjs && npx next build 2>&1 | grep -E "Compiled|rror:|Failed|Type error"; cd ..
```
Expected: `✓ Compiled successfully`.

- [ ] **Step 6: Commit**

```bash
git add nextjs/components/admin/ProductForm.jsx nextjs/components/admin/ProductosPanel.jsx nextjs/app/admin/page.js
git commit -m "$(cat <<'EOF'
refactor: Extraer ProductForm y crear ProductosPanel para el nuevo marco

ProductosPanel todavía no se usa: page.js sigue con su AdminPanel hasta
que el marco nuevo lo reemplace.

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 9: Menú, endpoint `me` y verificador

**Files:**
- Create: `nextjs/lib/admin-menu.js`
- Modify: `nextjs/app/api/admin/route.js` (agregar `action=me` en el GET)
- Modify: `nextjs/services/api.js` (agregar `verificarAdmin`)
- Tools: `docs/superpowers/plans/verificar-menu.mjs` (ya commiteado con el plan)

**Interfaces:**
- Consumes: `authenticateAdmin` (ya existe en `route.js`).
- Produces: de `lib/admin-menu.js`: `RUTA_INICIAL: string`, `SECCIONES: {id, etiqueta, icono}[]`, `ITEMS: {id, seccion, etiqueta, icono, ruta, roles}[]`, `esRutaAdmin(pathname): boolean`, `seccionesVisibles(rol): (Seccion & {items})[]`, `seccionDeRuta(pathname): string | null`. De `services/api.js`: `verificarAdmin(): Promise<{ ok: true, usuario: { id, email, role } }>`.

- [ ] **Step 1: Escribir el verificador y correrlo para que falle**

El verificador ya existe (`docs/superpowers/plans/verificar-menu.mjs`). Correrlo antes de crear el menú:
```bash
node docs/superpowers/plans/verificar-menu.mjs 2>&1 | tail -3
```
Expected: error de módulo no encontrado (`admin-menu.js` todavía no existe).

- [ ] **Step 2: Crear `nextjs/lib/admin-menu.js`**

```js
// Única fuente del menú del panel admin.
// El proyecto B (menú editable) reemplaza el origen de SECCIONES e ITEMS por la base de datos sin tocar el marco.

export const RUTA_INICIAL = '/admin/store/productos';

export const SECCIONES = [
  { id: 'ventas', etiqueta: 'Gestión de Ventas', icono: 'ShoppingCart' },
  { id: 'store', etiqueta: 'Store', icono: 'Store' },
  { id: 'marketing', etiqueta: 'Marketing', icono: 'Megaphone' },
  { id: 'configuracion', etiqueta: 'Configuración', icono: 'Settings' },
];

export const ITEMS = [
  { id: 'creditos', seccion: 'ventas', etiqueta: 'Créditos', icono: 'CreditCard', ruta: '/admin/ventas/creditos', roles: ['admin'] },
  { id: 'conversaciones', seccion: 'ventas', etiqueta: 'Conversaciones', icono: 'MessageSquare', ruta: '/admin/ventas/conversaciones', roles: ['admin'] },
  { id: 'productos', seccion: 'store', etiqueta: 'Productos', icono: 'Package', ruta: '/admin/store/productos', roles: ['admin'] },
  { id: 'depositos', seccion: 'store', etiqueta: 'Depósitos', icono: 'Warehouse', ruta: '/admin/store/depositos', roles: ['admin'] },
  { id: 'importar-pdf', seccion: 'store', etiqueta: 'Importar PDF', icono: 'FileUp', ruta: '/admin/store/importar-pdf', roles: ['admin'] },
  { id: 'promociones', seccion: 'marketing', etiqueta: 'Promociones', icono: 'Sparkles', ruta: '/admin/marketing/promociones', roles: ['admin'] },
  { id: 'medios-pago', seccion: 'marketing', etiqueta: 'Medios de pago', icono: 'Wallet', ruta: '/admin/marketing/medios-pago', roles: ['admin'] },
  { id: 'usuarios', seccion: 'configuracion', etiqueta: 'Usuarios', icono: 'Users', ruta: '/admin/configuracion/usuarios', roles: ['admin'] },
];

// true solo para /admin y /admin/...; no para rutas que apenas empiezan igual (/administrador)
export function esRutaAdmin(pathname) {
  return typeof pathname === 'string' && (pathname === '/admin' || pathname.startsWith('/admin/'));
}

// Secciones con sus pestañas, solo las que el rol puede ver (las vacías se omiten)
export function seccionesVisibles(rol) {
  return SECCIONES
    .map((s) => ({ ...s, items: ITEMS.filter((i) => i.seccion === s.id && i.roles.includes(rol)) }))
    .filter((s) => s.items.length > 0);
}

// Id de la sección a la que pertenece la ruta, o null si la ruta no está en el menú
export function seccionDeRuta(pathname) {
  if (typeof pathname !== 'string') return null;
  const item = ITEMS.find((i) => pathname === i.ruta || pathname.startsWith(i.ruta + '/'));
  return item ? item.seccion : null;
}
```

- [ ] **Step 3: Correr el verificador y confirmar que falla solo por las páginas**

```bash
node docs/superpowers/plans/verificar-menu.mjs 2>&1 | grep -v "Warning\|trace-warnings\|MODULE_TYPELESS\|reparsing"
```
Expected: `✗ 8 problema(s)` y las 8 líneas `falta la página de "..."`, ningún otro problema (las funciones puras ya pasan).

- [ ] **Step 4: Agregar `verificarAdmin` a `services/api.js`**

Al final de `nextjs/services/api.js`:
```js

// =================== VERIFICAR ACCESO ADMIN ===================

export const verificarAdmin = async () => {
  const response = await api.get('/admin?action=me');
  return response.data;
};
```

- [ ] **Step 5: Agregar `action=me` al GET de `nextjs/app/api/admin/route.js`**

Buscar, dentro de `export async function GET(request)`, el texto:
```js
    const decoded = authenticateAdmin(request);
    await connectDB();

    const action = request.nextUrl.searchParams.get('action');
```
y reemplazarlo por:
```js
    const decoded = authenticateAdmin(request);

    // El panel pregunta acá si el token pertenece a un admin antes de mostrar nada (no toca la base)
    if (request.nextUrl.searchParams.get('action') === 'me') {
      return NextResponse.json({
        ok: true,
        usuario: { id: decoded.userId, email: decoded.email, role: decoded.role }
      });
    }

    await connectDB();

    const action = request.nextUrl.searchParams.get('action');
```
(Ese texto aparece una sola vez: el `POST` no tiene `await connectDB()` justo después de `authenticateAdmin`.) Un token inválido o de un no-admin hace que `authenticateAdmin` lance, y el `catch` existente responde 403.

- [ ] **Step 6: Compilar**

```bash
cd nextjs && npx next build 2>&1 | grep -E "Compiled|rror:|Failed|Type error"; cd ..
```
Expected: `✓ Compiled successfully`.

- [ ] **Step 7: Commit**

```bash
git add nextjs/lib/admin-menu.js nextjs/app/api/admin/route.js nextjs/services/api.js
git commit -m "$(cat <<'EOF'
feat: Menú del admin en lib/admin-menu.js y endpoint GET /api/admin?action=me

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 10: PublicChrome (ocultar Header/Footer públicos en /admin)

**Files:**
- Create: `nextjs/components/PublicChrome.jsx`
- Modify: `nextjs/app/layout.js`

**Interfaces:**
- Consumes: `esRutaAdmin(pathname)` de `lib/admin-menu.js` (Task 9).
- Produces: `PublicChrome({ children })` (export con nombre): dibuja `children` salvo cuando la ruta es de admin.

- [ ] **Step 1: Crear `nextjs/components/PublicChrome.jsx`**

```jsx
'use client';

import { usePathname } from 'next/navigation';
import { esRutaAdmin } from '@/lib/admin-menu';

// Dibuja el contenido solo en el sitio público: el panel admin tiene su propio marco
export function PublicChrome({ children }) {
  const pathname = usePathname();
  if (esRutaAdmin(pathname)) return null;
  return <>{children}</>;
}
```

- [ ] **Step 2: Usarlo en `nextjs/app/layout.js`**

Agregar el import después de la línea `import ChatBot from '@/components/ChatBot';`:
```js
import { PublicChrome } from '@/components/PublicChrome';
```
Y reemplazar este bloque:
```jsx
            <Header />
            <main className="flex-grow">{children}</main>
            <Footer />
            <WhatsAppButton />
            <ChatBot />
```
por:
```jsx
            <PublicChrome>
              <Header />
            </PublicChrome>
            <main className="flex-grow">{children}</main>
            <PublicChrome>
              <Footer />
              <WhatsAppButton />
              <ChatBot />
            </PublicChrome>
```

- [ ] **Step 3: Compilar**

```bash
cd nextjs && npx next build 2>&1 | grep -E "Compiled|rror:|Failed|Type error"; cd ..
```
Expected: `✓ Compiled successfully`.

- [ ] **Step 4: Comprobar en local que el sitio público no cambió**

```bash
cd nextjs && npx next dev -p 3100
```
(en otra terminal) abrir `http://localhost:3100/` y confirmar que se ven Header, Footer, botón de WhatsApp y chatbot. Abrir `http://localhost:3100/admin`: el Header y el Footer públicos ya **no** aparecen (el panel viejo sigue viéndose sin ellos). Cortar el servidor con Ctrl+C.

- [ ] **Step 5: Commit**

```bash
git add nextjs/components/PublicChrome.jsx nextjs/app/layout.js
git commit -m "$(cat <<'EOF'
feat: Ocultar Header, Footer, WhatsApp y chatbot públicos en /admin

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 11: Marco del admin, páginas por pestaña y redirect de /admin

**Files:**
- Create: `nextjs/app/admin/layout.js`
- Create (8 páginas): `nextjs/app/admin/store/productos/page.js`, `nextjs/app/admin/store/depositos/page.js`, `nextjs/app/admin/store/importar-pdf/page.js`, `nextjs/app/admin/ventas/creditos/page.js`, `nextjs/app/admin/ventas/conversaciones/page.js`, `nextjs/app/admin/marketing/promociones/page.js`, `nextjs/app/admin/marketing/medios-pago/page.js`, `nextjs/app/admin/configuracion/usuarios/page.js`
- Replace: `nextjs/app/admin/page.js` (pasa a ser solo el redirect)

**Interfaces:**
- Consumes: `verificarAdmin` (Task 9), `seccionesVisibles` y `seccionDeRuta` y `RUTA_INICIAL` (Task 9), los paneles de `components/admin/` (Tasks 1-8), `useAuthStore().logout` (ya existe).
- Produces: las 8 rutas de `ITEMS`, y `/admin` → redirige a `RUTA_INICIAL`.

- [ ] **Step 1: Crear el marco `nextjs/app/admin/layout.js`**

```jsx
'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  Menu, LogOut, ExternalLink, Loader2,
  ShoppingCart, Store, Megaphone, Settings,
  CreditCard, MessageSquare, Package, Warehouse, FileUp, Sparkles, Wallet, Users,
} from 'lucide-react';
import { useAuthStore } from '@/store/authStore';
import { verificarAdmin } from '@/services/api';
import { seccionesVisibles, seccionDeRuta } from '@/lib/admin-menu';

// El menú guarda los íconos por nombre (para poder editarlo desde la base en el proyecto B); acá se resuelven
const ICONOS = { ShoppingCart, Store, Megaphone, Settings, CreditCard, MessageSquare, Package, Warehouse, FileUp, Sparkles, Wallet, Users };

function Icono({ nombre, className }) {
  const Componente = ICONOS[nombre];
  return Componente ? <Componente className={className} /> : null;
}

export default function AdminLayout({ children }) {
  const pathname = usePathname();
  const router = useRouter();
  const logout = useAuthStore((s) => s.logout);
  const [usuario, setUsuario] = useState(null);
  const [menuAbierto, setMenuAbierto] = useState(false);

  // Verifica el rol contra el servidor. No se dibuja nada del panel hasta tener respuesta.
  useEffect(() => {
    let cancelado = false;
    verificarAdmin()
      .then((data) => { if (!cancelado) setUsuario(data.usuario); })
      .catch(() => { if (!cancelado) router.replace('/'); });
    return () => { cancelado = true; };
  }, [router]);

  // En celular el menú se cierra al navegar
  useEffect(() => { setMenuAbierto(false); }, [pathname]);

  if (!usuario) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 text-gray-500">
        <Loader2 className="w-6 h-6 animate-spin mr-2" /> Verificando acceso...
      </div>
    );
  }

  const secciones = seccionesVisibles(usuario.role);
  const idActiva = seccionDeRuta(pathname);
  const activa = secciones.find((s) => s.id === idActiva);

  const handleLogout = () => {
    logout();
    router.push('/');
  };

  const sidebar = (
    <nav className="flex flex-col h-full">
      <div className="px-5 py-5 border-b border-white/10">
        <div className="text-lg font-bold">Aluminé Hogar</div>
        <div className="text-xs text-white/60 uppercase tracking-wide">Sistema de gestión</div>
      </div>
      <ul className="flex-1 overflow-y-auto py-3">
        {secciones.map((s) => (
          <li key={s.id}>
            <Link
              href={s.items[0].ruta}
              className={`flex items-center gap-3 mx-3 my-1 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                s.id === idActiva ? 'bg-blue-600 text-white' : 'text-white/80 hover:bg-white/10'
              }`}
            >
              <Icono nombre={s.icono} className="w-4 h-4" />
              {s.etiqueta}
            </Link>
          </li>
        ))}
      </ul>
      <div className="px-5 py-4 border-t border-white/10 text-sm">
        <div className="font-medium truncate">{usuario.email}</div>
        <div className="text-xs text-white/60 mb-3">Administrador</div>
        <Link href="/" className="flex items-center gap-2 text-white/80 hover:text-white mb-2">
          <ExternalLink className="w-4 h-4" /> Ver tienda
        </Link>
        <button type="button" onClick={handleLogout} className="flex items-center gap-2 text-white/80 hover:text-white">
          <LogOut className="w-4 h-4" /> Cerrar sesión
        </button>
      </div>
    </nav>
  );

  return (
    <div className="min-h-screen bg-gray-50 md:flex">
      {/* Pantallas medianas y grandes: sidebar fijo a la izquierda */}
      <aside className="hidden md:block w-64 shrink-0 bg-slate-900 text-white sticky top-0 h-screen">
        {sidebar}
      </aside>

      {/* Celular: barra superior con botón que abre el menú */}
      <div className="md:hidden flex items-center justify-between bg-slate-900 text-white px-4 py-3">
        <span className="font-bold">Aluminé Hogar</span>
        <button type="button" aria-label="Abrir menú" onClick={() => setMenuAbierto(true)}>
          <Menu className="w-6 h-6" />
        </button>
      </div>
      {menuAbierto && (
        <div className="md:hidden fixed inset-0 z-50 flex">
          <div className="w-64 bg-slate-900 text-white">{sidebar}</div>
          <button type="button" aria-label="Cerrar menú" className="flex-1 bg-black/50" onClick={() => setMenuAbierto(false)} />
        </div>
      )}

      <div className="flex-1 min-w-0">
        {activa && (
          <div className="bg-white border-b px-6 flex gap-1 overflow-x-auto">
            {activa.items.map((it) => {
              const actual = pathname === it.ruta || pathname.startsWith(it.ruta + '/');
              return (
                <Link
                  key={it.id}
                  href={it.ruta}
                  className={`flex items-center gap-2 px-4 py-3 text-sm font-medium whitespace-nowrap transition-colors ${
                    actual ? 'border-b-2 border-blue-600 text-blue-600' : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  <Icono nombre={it.icono} className="w-4 h-4" />
                  {it.etiqueta}
                </Link>
              );
            })}
          </div>
        )}
        <main className="p-6">{children}</main>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Crear las 7 páginas simples**

Cada una es un archivo de 4 líneas. Crear estos archivos con su contenido exacto (cambia solo el nombre del panel y la ruta):

`nextjs/app/admin/store/productos/page.js`
```jsx
import ProductosPanel from '@/components/admin/ProductosPanel';

export default function Page() {
  return <ProductosPanel />;
}
```
`nextjs/app/admin/store/depositos/page.js`
```jsx
import DepositosPanel from '@/components/admin/DepositosPanel';

export default function Page() {
  return <DepositosPanel />;
}
```
`nextjs/app/admin/store/importar-pdf/page.js`
```jsx
import PresupuestoPanel from '@/components/admin/PresupuestoPanel';

export default function Page() {
  return <PresupuestoPanel />;
}
```
`nextjs/app/admin/ventas/creditos/page.js`
```jsx
import CreditosPanel from '@/components/admin/CreditosPanel';

export default function Page() {
  return <CreditosPanel />;
}
```
`nextjs/app/admin/ventas/conversaciones/page.js`
```jsx
import ConversationsPanel from '@/components/admin/ConversationsPanel';

export default function Page() {
  return <ConversationsPanel />;
}
```
`nextjs/app/admin/marketing/promociones/page.js`
```jsx
import PromocionesPanel from '@/components/admin/PromocionesPanel';

export default function Page() {
  return <PromocionesPanel />;
}
```
`nextjs/app/admin/marketing/medios-pago/page.js`
```jsx
import MediosPagoPanel from '@/components/admin/MediosPagoPanel';

export default function Page() {
  return <MediosPagoPanel />;
}
```

- [ ] **Step 3: Crear la página de Usuarios** (necesita el id del admin logueado)

`nextjs/app/admin/configuracion/usuarios/page.js`
```jsx
'use client';

import { useAuthStore } from '@/store/authStore';
import UsersPanel from '@/components/admin/UsersPanel';

export default function Page() {
  const user = useAuthStore((s) => s.user);
  return <UsersPanel currentUserId={user?.id} />;
}
```

- [ ] **Step 4: Reemplazar `nextjs/app/admin/page.js` por el redirect**

Reemplazar **todo** el contenido del archivo por:
```jsx
import { redirect } from 'next/navigation';
import { RUTA_INICIAL } from '@/lib/admin-menu';

// El panel vivía todo acá; ahora cada pestaña tiene su URL. Los links viejos a /admin caen en Productos.
export default function AdminIndex() {
  redirect(RUTA_INICIAL);
}
```

- [ ] **Step 5: Correr el verificador (ahora debe pasar)**

```bash
node docs/superpowers/plans/verificar-menu.mjs 2>&1 | grep -v "Warning\|trace-warnings\|MODULE_TYPELESS\|reparsing"
```
Expected: `✓ Menú OK: 4 secciones, 8 pestañas, todas con su página`.

- [ ] **Step 6: Compilar**

```bash
cd nextjs && npx next build 2>&1 | grep -E "Compiled|rror:|Failed|Type error|/admin"; cd ..
```
Expected: `✓ Compiled successfully` y en la lista de rutas aparecen `/admin` y las 8 rutas nuevas bajo `/admin/...`.

- [ ] **Step 7: Probar en local**

```bash
cd nextjs && npx next dev -p 3100
```
Con sesión de admin en `http://localhost:3100`: abrir `/admin` → debe redirigir a `/admin/store/productos` y mostrar sidebar a la izquierda, sección Store marcada y las pestañas Productos · Depósitos · Importar PDF arriba. Recargar la página: sigue en la misma pestaña. Sin sesión (ventana privada): abrir `/admin/store/productos` → ve "Verificando acceso..." y termina en `/`, sin mostrar el panel. Cortar el servidor.

- [ ] **Step 8: Commit**

```bash
git add nextjs/app/admin
git commit -m "$(cat <<'EOF'
feat: Panel admin con sidebar por secciones y una URL por pestaña

El layout verifica el rol contra /api/admin?action=me antes de mostrar
nada. /admin redirige a /admin/store/productos.

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 12: Verificación final y entrega para revisión

**Files:** ninguno nuevo.

- [ ] **Step 1: Estado limpio y build final**

```bash
git status --short
cd nextjs && npx next build 2>&1 | grep -E "Compiled|rror:|Failed|Type error"; cd ..
node docs/superpowers/plans/verificar-menu.mjs 2>&1 | grep -v "Warning\|trace-warnings\|MODULE_TYPELESS\|reparsing"
```
Expected: solo `Presupuesto - S02222 (1).pdf` y `backups/` sin commitear; `✓ Compiled successfully`; `✓ Menú OK`.

- [ ] **Step 2: Subir la rama (genera una URL de prueba de Vercel, no toca producción)**

```bash
git push -u origin admin-shell
```
Esperar a que Vercel termine el deploy de la rama y anotar la URL de prueba (`npx vercel ls --scope mariano-aliandris-projects` la muestra como `Preview`).

- [ ] **Step 3: Lista de comprobación en la URL de prueba (el dueño la recorre con sesión de admin)**

Por cada pestaña, abrirla desde el sidebar y por URL directa, y comprobar que carga la lista:
- Gestión de Ventas → Créditos, Conversaciones
- Store → Productos, Depósitos, Importar PDF
- Marketing → Promociones, Medios de pago
- Configuración → Usuarios

Funciones recientes que no deben haberse roto: toggle **Mostrar** (Sí/No), **Importar PDF** (subir el presupuesto y ver la tabla), **Buscar imagen** en el formulario de un producto, cambiar el stock con los botones − y +, crear y editar un producto.

Acceso:
- Ventana privada sin sesión en `/admin/store/productos` → termina en `/` sin ver el panel.
- Con una cuenta de cliente (no admin) → termina en `/`.
- `/admin` redirige a Productos; `/admin/inexistente` muestra el 404 de la tienda.
- Recargar y usar Atrás/Adelante mantienen la pestaña.
- En el sitio público (`/`, un producto, el checkout) siguen apareciendo Header, Footer, WhatsApp y chatbot.
- Celular (o ancho angosto del navegador): el sidebar se abre con el botón de menú y se cierra al elegir una pestaña.

- [ ] **Step 4: Reportar y esperar la decisión del dueño**

Informar el resultado de la lista. **No mergear a `master` ni pushear a `master`**: eso lo decide el dueño después de revisar la URL de prueba.
