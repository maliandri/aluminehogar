# Configuración del sitio + Editar menú del panel (con roles) — Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Que el dueño edite desde el panel los datos del sitio (tienda, redes, textos del inicio, chatbot) y el menú del panel (renombrar, reordenar, ocultar, mover, crear secciones, roles), y que los vendedores entren al panel viendo solo lo que el menú y los permisos del servidor les permitan.

**Architecture:** Dos documentos únicos en MongoDB (`SiteConfig`, `MenuConfig`) con valores de fábrica en el código. La configuración del sitio se lee en el servidor con `unstable_cache` (etiqueta `site-config`, se renueva al guardar) y llega a los componentes cliente por un `SiteProvider`. Una tabla de permisos en código (`lib/permisos.js`) es la autoridad de quién ve/edita cada pantalla; el menú solo decide qué se muestra. El marco del admin (proyecto A) pide el menú ya filtrado por rol a `GET /api/admin-menu`.

**Tech Stack:** Next.js 16 (App Router), React, Tailwind, `lucide-react`, Mongoose, axios (`services/api.js`), Zustand, Node 22 para los verificadores.

**Spec:** `docs/superpowers/specs/2026-10-01-config-y-menu-design.md` (leerlo antes de empezar)

## Global Constraints

- **Se trabaja directo sobre `master`, sin ramas** (pedido explícito del dueño). Commits chicos, uno por tarea. **No hacer `git push`**: `master` deploya a producción; el push lo decide el dueño.
- No modificar `nextjs/lib/auth-helpers.js`, `nextjs/lib/models/User.js` ni el formato del JWT. No tocar `nextjs/lib/db.js`. No cambiar la ruta ni la lógica del webhook de `nextjs/app/api/mercadopago/route.js` (solo se permite cambiar la expresión del email de aviso, Task 5).
- Los valores que hoy están escritos en el código son los **valores por defecto**: sin nada guardado el sitio se ve idéntico a hoy.
- Dominio (`https://aluminehogar.com.ar`), remitente de Resend, SEO (`metadata` de `layout.js`), plantillas de email (salvo datos de contacto del pie) y píxel de Facebook **no** se tocan.
- Solo admin escribe configuración y menú. Todo lo que llega al servidor se valida y lo desconocido se descarta.
- Preservar el fin de línea (CRLF/LF) de cada archivo existente que se edite. Si la herramienta Edit no encuentra un texto por los saltos de línea, usar un script `node` en archivo que reemplace respetando `\r\n`.
- Textos de interfaz en español rioplatense; Tailwind + `lucide-react`; sin dependencias nuevas.
- Los módulos puros que prueban los verificadores (`site-defaults.js`, `site-validate.js`, `site-format.js`, `permisos.js`, `admin-menu.js`, `menu-config.js`) **solo importan con rutas relativas y extensión `.js`** (sin alias `@/`), para que Node pueda cargarlos.
- Cada commit debe compilar: `cd nextjs && npx next build 2>&1 | grep -E "Compiled|rror:|Failed|Type error"` debe mostrar `✓ Compiled successfully` (los errores de MongoDB del sitemap sin `DB_URI` son esperados).
- Cada commit termina con la línea `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`. No commitear `Presupuesto - S02222 (1).pdf` ni `backups/`.

## Review Focus

1. **Un no-admin intenta escribir configuración o menú** (`PUT /api/site-config`, `PUT/DELETE /api/admin-menu`, `GET /api/admin-menu?action=config`): debe recibir 403 (sin token, token vencido, cliente, vendedor). Task 2, 9.
2. **El menú no puede dar más permisos que la tabla:** un `PUT` que marque `vendedor` en `usuarios` se rechaza; un vendedor que entra por URL directa a `/admin/configuracion/usuarios` no ve la pantalla y sus endpoints responden 403. Task 7, 8, 9, 10.
3. **El admin no puede quedarse sin acceso:** no se pueden ocultar ni sacar al admin de `config-sitio` y `editar-menu`; "Restaurar de fábrica" siempre funciona; si `GET /api/admin-menu` falla, el marco usa el menú de fábrica. Task 8, 9, 10, 11.
4. **Datos inválidos no se guardan** (WhatsApp con `+` o letras, email mal escrito, URL de red que no sea `https`, textos demasiado largos, campos que no son texto) y los campos desconocidos se descartan. Task 1, 2.
5. **Base de datos caída o sin nada guardado:** el sitio, los emails y el chatbot siguen mostrando los valores de hoy; un error de lectura no se cachea. Task 2, 5.

---

### Task 1: Datos por defecto, validación y verificador de la configuración del sitio

**Files:**
- Create: `nextjs/lib/site-defaults.js`
- Create: `nextjs/lib/site-validate.js`
- Create: `nextjs/lib/site-format.js`
- Create: `docs/superpowers/plans/verificar-config.mjs`

**Interfaces:**
- Consumes: nada.
- Produces: `SITE_DEFAULTS` (objeto con grupos `tienda`, `redes`, `inicio`, `chatbot`); `mezclarConDefaults(guardado): config`; `validarSiteConfig(entrada): { ok: boolean, errores: string[], valor: config }`; `telHref(telefono): string`; `waUrl(whatsapp, mensaje?): string`.

- [ ] **Step 1: Escribir el verificador (debe fallar)**

Create `docs/superpowers/plans/verificar-config.mjs`:
```js
#!/usr/bin/env node
/**
 * Verifica las funciones puras de la configuración del sitio.
 * Uso (desde la raíz del repo): node docs/superpowers/plans/verificar-config.mjs
 */
import path from 'path';
import { pathToFileURL } from 'url';
import assert from 'assert/strict';

const lib = (f) => import(pathToFileURL(path.join(process.cwd(), 'nextjs/lib', f)).href);
const { SITE_DEFAULTS } = await lib('site-defaults.js');
const { mezclarConDefaults, validarSiteConfig } = await lib('site-validate.js');
const { telHref, waUrl } = await lib('site-format.js');

const problemas = [];
const t = (nombre, fn) => { try { fn(); } catch (e) { problemas.push(`${nombre}: ${e.message.split('\n')[0]}`); } };
const con = (grupo, campo, valor) => {
  const c = structuredClone(SITE_DEFAULTS);
  c[grupo][campo] = valor;
  return validarSiteConfig(c);
};

t('los defaults son válidos', () => assert.equal(validarSiteConfig(SITE_DEFAULTS).ok, true));
t('mezclar({}) devuelve los defaults', () => assert.deepEqual(mezclarConDefaults({}), SITE_DEFAULTS));
t('mezclar(null) devuelve los defaults', () => assert.deepEqual(mezclarConDefaults(null), SITE_DEFAULTS));
t('mezclar respeta lo guardado y descarta lo desconocido', () => {
  const r = mezclarConDefaults({ tienda: { nombre: 'Otra', hack: 'x' }, extra: { a: 1 } });
  assert.equal(r.tienda.nombre, 'Otra');
  assert.equal(r.tienda.telefono, SITE_DEFAULTS.tienda.telefono);
  assert.equal('hack' in r.tienda, false);
  assert.equal('extra' in r, false);
});
t('whatsapp con + es inválido', () => assert.equal(con('tienda', 'whatsapp', '+5492995769999').ok, false));
t('whatsapp con letras es inválido', () => assert.equal(con('tienda', 'whatsapp', '54929957abcd').ok, false));
t('email de contacto inválido', () => assert.equal(con('tienda', 'emailContacto', 'sin-arroba').ok, false));
t('email de info puede quedar vacío', () => assert.equal(con('tienda', 'emailInfo', '').ok, true));
t('instagram con http es inválido', () => assert.equal(con('redes', 'instagram', 'http://instagram.com/x').ok, false));
t('instagram javascript: es inválido', () => assert.equal(con('redes', 'instagram', 'javascript:alert(1)').ok, false));
t('instagram https es válido', () => assert.equal(con('redes', 'instagram', 'https://instagram.com/aluminehogar').ok, true));
t('redes vacías son válidas', () => assert.equal(con('redes', 'facebook', '').ok, true));
t('título del inicio vacío es inválido', () => assert.equal(con('inicio', 'titulo', '   ').ok, false));
t('nombre de 81 caracteres es inválido', () => assert.equal(con('tienda', 'nombre', 'a'.repeat(81)).ok, false));
t('campo que no es texto es inválido', () => assert.equal(con('tienda', 'telefono', 123).ok, false));
t('entrada null es inválida', () => assert.equal(validarSiteConfig(null).ok, false));
t('valor recortado y sin campos extra', () => {
  const c = structuredClone(SITE_DEFAULTS);
  c.tienda.nombre = '  Aluminé  ';
  c.tienda.hack = 'x';
  const r = validarSiteConfig(c);
  assert.equal(r.ok, true);
  assert.equal(r.valor.tienda.nombre, 'Aluminé');
  assert.equal('hack' in r.valor.tienda, false);
});
t('telHref', () => assert.equal(telHref('+54 9 299 576-9999'), 'tel:+5492995769999'));
t('waUrl sin mensaje', () => assert.equal(waUrl('5492995769999'), 'https://wa.me/5492995769999'));
t('waUrl con mensaje', () => assert.equal(waUrl('5492995769999', 'Hola mundo'), 'https://wa.me/5492995769999?text=Hola%20mundo'));

if (problemas.length) {
  console.error(`✗ ${problemas.length} problema(s):\n` + problemas.map((p) => '  - ' + p).join('\n'));
  process.exit(1);
}
console.log('✓ Configuración del sitio OK: validación, mezcla con defaults y formatos');
```

- [ ] **Step 2: Correrlo y ver que falla**

```bash
node docs/superpowers/plans/verificar-config.mjs 2>&1 | tail -4
```
Expected: error `Cannot find module ... site-defaults.js`.

- [ ] **Step 3: Crear `nextjs/lib/site-defaults.js`**

```js
// Valores de fábrica de la configuración del sitio: son exactamente los que estaban escritos en el código.
// Si no hay nada guardado (o la base falla), el sitio muestra esto.
export const SITE_DEFAULTS = {
  tienda: {
    nombre: 'Alumine Hogar',
    telefono: '+54 9 299 576-9999',
    whatsapp: '5492995769999',
    emailContacto: 'aluminehogar@gmail.com',
    emailNotificaciones: 'aluminehogar@gmail.com',
    emailInfo: 'info@aluminehogar.com.ar',
    direccion: '',
    ciudad: 'Neuquen',
  },
  redes: {
    instagram: '',
    facebook: '',
  },
  inicio: {
    titulo: 'Alumine con el calor del HOGAR!',
    subtitulo: 'Encuentra los mejores productos para tu descanso',
  },
  chatbot: {
    envio: 'Envio GRATIS en Neuquen Capital',
    formasDePago: 'Efectivo, transferencia, tarjetas (consultar cuotas)',
    politicas: [
      'Garantia de 5 anos en colchones premium',
      'Garantia de 3 anos en colchones estandar',
      'Garantia de 1 ano en almohadas',
      'Cambios y devoluciones dentro de los 30 dias',
    ].join('\n'),
  },
};
```

- [ ] **Step 4: Crear `nextjs/lib/site-validate.js`**

```js
import { SITE_DEFAULTS } from './site-defaults.js';

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const TELEFONO = /^\+?[\d\s()-]{6,25}$/;
const SOLO_DIGITOS = /^\d{8,15}$/;

// Reglas por campo. Solo estos campos existen: todo lo demás que llegue se descarta.
const CAMPOS = {
  tienda: {
    nombre: { max: 80, requerido: true },
    telefono: { max: 25, requerido: true, regex: TELEFONO, mensaje: 'solo números, espacios, +, ( ) y -' },
    whatsapp: { max: 15, requerido: true, regex: SOLO_DIGITOS, mensaje: 'solo números, con código de país (ej: 5492995769999)' },
    emailContacto: { max: 120, requerido: true, regex: EMAIL, mensaje: 'email inválido' },
    emailNotificaciones: { max: 120, requerido: true, regex: EMAIL, mensaje: 'email inválido' },
    emailInfo: { max: 120, requerido: false, regex: EMAIL, mensaje: 'email inválido' },
    direccion: { max: 120, requerido: false },
    ciudad: { max: 60, requerido: true },
  },
  redes: {
    instagram: { max: 200, requerido: false, https: true },
    facebook: { max: 200, requerido: false, https: true },
  },
  inicio: {
    titulo: { max: 100, requerido: true },
    subtitulo: { max: 160, requerido: false },
  },
  chatbot: {
    envio: { max: 120, requerido: false },
    formasDePago: { max: 200, requerido: false },
    politicas: { max: 1200, requerido: false },
  },
};

const esUrlHttps = (v) => {
  try {
    return new URL(v).protocol === 'https:';
  } catch {
    return false;
  }
};

// Completa lo guardado con los defaults y descarta cualquier campo que no exista en CAMPOS
export function mezclarConDefaults(guardado) {
  const salida = {};
  for (const grupo of Object.keys(CAMPOS)) {
    salida[grupo] = {};
    for (const campo of Object.keys(CAMPOS[grupo])) {
      const v = guardado?.[grupo]?.[campo];
      salida[grupo][campo] = typeof v === 'string' ? v : SITE_DEFAULTS[grupo][campo];
    }
  }
  return salida;
}

// Valida lo que llega del formulario. Devuelve el valor limpio (recortado y sin campos extra).
export function validarSiteConfig(entrada) {
  const errores = [];
  const valor = {};
  for (const grupo of Object.keys(CAMPOS)) {
    valor[grupo] = {};
    for (const [campo, regla] of Object.entries(CAMPOS[grupo])) {
      const crudo = entrada?.[grupo]?.[campo];
      const nombre = `${grupo}.${campo}`;
      if (crudo != null && typeof crudo !== 'string') {
        errores.push(`${nombre}: tiene que ser texto`);
        continue;
      }
      const v = (crudo ?? '').trim();
      if (!v) {
        if (regla.requerido) errores.push(`${nombre}: es obligatorio`);
        valor[grupo][campo] = '';
        continue;
      }
      if (v.length > regla.max) {
        errores.push(`${nombre}: máximo ${regla.max} caracteres`);
        continue;
      }
      if (regla.regex && !regla.regex.test(v)) {
        errores.push(`${nombre}: ${regla.mensaje}`);
        continue;
      }
      if (regla.https && !esUrlHttps(v)) {
        errores.push(`${nombre}: tiene que ser un link que empiece con https://`);
        continue;
      }
      valor[grupo][campo] = v;
    }
  }
  return { ok: errores.length === 0, errores, valor };
}
```

- [ ] **Step 5: Crear `nextjs/lib/site-format.js`**

```js
// Arma el link para llamar: deja solo + y dígitos
export function telHref(telefono) {
  return `tel:${String(telefono).replace(/[^\d+]/g, '')}`;
}

// Link de WhatsApp: el número va solo con dígitos y código de país
export function waUrl(whatsapp, mensaje) {
  const base = `https://wa.me/${whatsapp}`;
  return mensaje ? `${base}?text=${encodeURIComponent(mensaje)}` : base;
}
```

- [ ] **Step 6: Correr el verificador (debe pasar)**

```bash
node docs/superpowers/plans/verificar-config.mjs 2>&1 | grep -v "Warning\|trace-warnings\|MODULE_TYPELESS\|Reparsing\|eliminate this"
```
Expected: `✓ Configuración del sitio OK: validación, mezcla con defaults y formatos`.

- [ ] **Step 7: Commit**

```bash
git add nextjs/lib/site-defaults.js nextjs/lib/site-validate.js nextjs/lib/site-format.js docs/superpowers/plans/verificar-config.mjs
git commit -m "$(cat <<'EOF'
feat: Defaults, validación y formatos de la configuración del sitio

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 2: Modelo, lectura con caché y API de la configuración del sitio

**Files:**
- Create: `nextjs/lib/models/SiteConfig.js`
- Create: `nextjs/lib/site-config.js`
- Create: `nextjs/app/api/site-config/route.js`

**Interfaces:**
- Consumes: `SITE_DEFAULTS`, `mezclarConDefaults`, `validarSiteConfig` (Task 1).
- Produces: `getSiteConfig(): Promise<config>` (servidor, con caché, nunca lanza); `SITE_CONFIG_TAG = 'site-config'`; `GET /api/site-config` → `{ success: true, config }` (público); `PUT /api/site-config` (admin, body = config completa) → `{ success: true, config }` o 400 `{ error, errores }`.

- [ ] **Step 1: Crear `nextjs/lib/models/SiteConfig.js`**

```js
import mongoose from 'mongoose';

// Un solo documento (_id: 'default'), mismo patrón que PaymentSettings
const SiteConfigSchema = new mongoose.Schema({
  _id: { type: String, default: 'default' },
  tienda: { type: Object, default: {} },
  redes: { type: Object, default: {} },
  inicio: { type: Object, default: {} },
  chatbot: { type: Object, default: {} },
  updatedAt: { type: Date, default: Date.now }
}, { minimize: false });

export default mongoose.models.SiteConfig || mongoose.model('SiteConfig', SiteConfigSchema);
```

- [ ] **Step 2: Crear `nextjs/lib/site-config.js`**

```js
import { unstable_cache } from 'next/cache';
import { connectDB } from '@/lib/db';
import SiteConfig from '@/lib/models/SiteConfig';
import { SITE_DEFAULTS } from '@/lib/site-defaults';
import { mezclarConDefaults } from '@/lib/site-validate';

export const SITE_CONFIG_TAG = 'site-config';

// Si la lectura lanza, unstable_cache no guarda nada: un error de la base no queda cacheado
const leerCacheado = unstable_cache(
  async () => {
    await connectDB();
    const doc = await SiteConfig.findById('default').lean();
    return mezclarConDefaults(doc);
  },
  ['site-config-v1'],
  { tags: [SITE_CONFIG_TAG], revalidate: 3600 }
);

// Nunca lanza: ante cualquier problema devuelve los valores de fábrica (el sitio se ve como siempre)
export async function getSiteConfig() {
  try {
    return await leerCacheado();
  } catch (error) {
    console.error('SiteConfig: usando valores por defecto:', error.message);
    return SITE_DEFAULTS;
  }
}
```

- [ ] **Step 3: Crear `nextjs/app/api/site-config/route.js`**

```js
import { NextResponse } from 'next/server';
import { revalidateTag } from 'next/cache';
import { connectDB } from '@/lib/db';
import SiteConfig from '@/lib/models/SiteConfig';
import { extractTokenFromHeaders, verifyToken, requireAdmin } from '@/lib/auth-helpers';
import { getSiteConfig, SITE_CONFIG_TAG } from '@/lib/site-config';
import { validarSiteConfig } from '@/lib/site-validate';

function authenticateAdmin(request) {
  const token = extractTokenFromHeaders(request.headers);
  if (!token) throw new Error('Token de autenticacion requerido');
  const decoded = verifyToken(token);
  requireAdmin(decoded);
  return decoded;
}

// GET público: solo expone datos que el sitio ya muestra (teléfono, WhatsApp, textos, etc.)
export async function GET() {
  const config = await getSiteConfig();
  return NextResponse.json({ success: true, config });
}

export async function PUT(request) {
  try {
    authenticateAdmin(request);

    const body = await request.json().catch(() => null);
    const { ok, errores, valor } = validarSiteConfig(body);
    if (!ok) {
      return NextResponse.json({ error: 'Hay datos inválidos', errores }, { status: 400 });
    }

    await connectDB();
    await SiteConfig.findByIdAndUpdate(
      'default',
      { $set: { ...valor, updatedAt: new Date() } },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    // expire: 0 → el cambio se ve ya en la próxima visita (no queda sirviendo la copia vieja)
    revalidateTag(SITE_CONFIG_TAG, { expire: 0 });

    return NextResponse.json({ success: true, config: valor });
  } catch (error) {
    if (error.message.includes('Token') || error.message.includes('administrador')) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    console.error('Error en site-config PUT:', error);
    return NextResponse.json({ error: 'Error en el servidor' }, { status: 500 });
  }
}
```

- [ ] **Step 4: Compilar**

```bash
cd nextjs && npx next build 2>&1 | grep -E "Compiled|rror:|Failed|Type error|site-config"; cd ..
```
Expected: `✓ Compiled successfully` y `/api/site-config` en la lista de rutas. Si el compilador rechaza `revalidateTag(tag, { expire: 0 })`, mirar la firma en `nextjs/node_modules/next/dist/server/web/spec-extension/revalidate.d.ts` y usar la variante que expira al instante.

- [ ] **Step 5: Commit**

```bash
git add nextjs/lib/models/SiteConfig.js nextjs/lib/site-config.js nextjs/app/api/site-config/route.js
git commit -m "$(cat <<'EOF'
feat: Modelo, lectura con caché y API de la configuración del sitio

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 3: SiteProvider y carga en el layout raíz

**Files:**
- Create: `nextjs/components/SiteProvider.jsx`
- Modify: `nextjs/app/layout.js`

**Interfaces:**
- Consumes: `getSiteConfig()` (Task 2), `SITE_DEFAULTS` (Task 1).
- Produces: `SiteProvider({ value, children })` y `useSite(): config` (si no hay proveedor devuelve `SITE_DEFAULTS`, nunca `undefined`).

- [ ] **Step 1: Crear `nextjs/components/SiteProvider.jsx`**

```jsx
'use client';

import { createContext, useContext } from 'react';
import { SITE_DEFAULTS } from '@/lib/site-defaults';

const SiteContext = createContext(SITE_DEFAULTS);

// El layout (servidor) lee la configuración y la reparte a los componentes cliente
export function SiteProvider({ value, children }) {
  return <SiteContext.Provider value={value}>{children}</SiteContext.Provider>;
}

export function useSite() {
  return useContext(SiteContext);
}
```

- [ ] **Step 2: Editar `nextjs/app/layout.js`**

Agregar los imports junto a los demás:
```js
import { SiteProvider } from '@/components/SiteProvider';
import { getSiteConfig } from '@/lib/site-config';
```
Cambiar `export default function RootLayout({ children }) {` por:
```js
export default async function RootLayout({ children }) {
  const site = await getSiteConfig();
```
Y envolver, dentro de `<body>`, el contenido de `<ClientProviders>`: cambiar
```jsx
        <ClientProviders>
```
por
```jsx
        <SiteProvider value={site}>
        <ClientProviders>
```
y su cierre `</ClientProviders>` por
```jsx
        </ClientProviders>
        </SiteProvider>
```
(la indentación de lo que queda adentro puede quedar como está; no reformatear.)

- [ ] **Step 3: Compilar**

```bash
cd nextjs && npx next build 2>&1 | grep -E "Compiled|rror:|Failed|Type error"; cd ..
```
Expected: `✓ Compiled successfully`.

- [ ] **Step 4: Commit**

```bash
git add nextjs/components/SiteProvider.jsx nextjs/app/layout.js
git commit -m "$(cat <<'EOF'
feat: SiteProvider y carga de la configuración en el layout raíz

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 4: Los componentes cliente leen la configuración

**Files (modify):** `nextjs/components/WhatsAppButton.jsx`, `nextjs/components/ChatBot.jsx`, `nextjs/components/CartModal.jsx`, `nextjs/components/ProductDetailClient.jsx`, `nextjs/app/bot/page.js`, `nextjs/components/Footer.jsx`, `nextjs/components/HomePageClient.jsx`

**Interfaces:**
- Consumes: `useSite()` (Task 3), `telHref` (Task 1).
- Produces: nada nuevo; con los defaults el sitio se ve idéntico.

Regla para cada archivo: agregar `import { useSite } from '@/components/SiteProvider';` junto a los imports y `const site = useSite();` al principio del componente que usa el dato (junto a sus otros hooks, antes de cualquier `return`). Buscar cada literal con `grep -n` (los números de línea son aproximados) y reemplazar así:

| Archivo | Literal actual | Reemplazo |
|---|---|---|
| `WhatsAppButton.jsx` (~l.10) | `const whatsappNumber = '5492995769999'; // +54 9 299 576-9999` | `const whatsappNumber = site.tienda.whatsapp;` |
| `ChatBot.jsx` (~l.234 y ~l.240) | `const whatsappNumber = '5492995769999';` (dos veces) | `const whatsappNumber = site.tienda.whatsapp;` |
| `CartModal.jsx` (~l.31) | `const whatsappNumber = '5492995769999';` | `const whatsappNumber = site.tienda.whatsapp;` |
| `app/bot/page.js` (~l.168 y ~l.185) | `const whatsappNumber = '5492995769999';` (dos veces) | `const whatsappNumber = site.tienda.whatsapp;` |
| `ProductDetailClient.jsx` (~l.46) | `` `https://wa.me/5492995769999?text=${encodeURIComponent(mensaje)}` `` | `` `https://wa.me/${site.tienda.whatsapp}?text=${encodeURIComponent(mensaje)}` `` |
| `Footer.jsx` (~l.10) | `Alumine Hogar` (título `h3`) | `{site.tienda.nombre}` |
| `Footer.jsx` (~l.15) | `...en Neuquen.` | `...en {site.tienda.ciudad}.` |
| `Footer.jsx` (~l.61) | `<span>Neuquen, Argentina</span>` | `<span>{[site.tienda.direccion, site.tienda.ciudad].filter(Boolean).join(', ')}, Argentina</span>` |
| `Footer.jsx` (~l.65-66) | `href="tel:+542995769999"` y el texto `+54 9 299 576-9999` | `href={telHref(site.tienda.telefono)}` y `{site.tienda.telefono}` (importar `telHref` de `@/lib/site-format`) |
| `Footer.jsx` (~l.72-75) | `href="mailto:aluminehogar@gmail.com"` y el texto `aluminehogar@gmail.com` | `href={`mailto:${site.tienda.emailContacto}`}` y `{site.tienda.emailContacto}` |
| `Footer.jsx` (~l.10 `alt`) | `alt="Alumine Hogar"` | `alt={site.tienda.nombre}` |
| `HomePageClient.jsx` (~l.69-70) | `Alumine con el calor del HOGAR!` | `{site.inicio.titulo}` |
| `HomePageClient.jsx` (~l.72-74) | `Encuentra los mejores productos para tu descanso` | `{site.inicio.subtitulo}` |
| `HomePageClient.jsx` (~l.213-214) | el teléfono/WhatsApp y `href="mailto:info@aluminehogar.com.ar"` de la sección de contacto | usar `site.tienda.telefono` / `site.tienda.whatsapp` en el teléfono, y `site.tienda.emailInfo || site.tienda.emailContacto` en el `mailto:` |

Además, en `Footer.jsx`, después del bloque de contacto, agregar los links de redes **solo si están cargadas**:
```jsx
{(site.redes.instagram || site.redes.facebook) && (
  <div className="flex gap-4 mt-4">
    {site.redes.instagram && (
      <a href={site.redes.instagram} target="_blank" rel="noopener noreferrer" className="hover:text-primary transition-colors">Instagram</a>
    )}
    {site.redes.facebook && (
      <a href={site.redes.facebook} target="_blank" rel="noopener noreferrer" className="hover:text-primary transition-colors">Facebook</a>
    )}
  </div>
)}
```

- [ ] **Step 1: Aplicar los reemplazos de la tabla** (leer cada archivo; si un literal ya cambió de lugar, buscarlo con `grep -n "5492995769999\|299 576\|aluminehogar@gmail\|info@aluminehogar\|Neuquen" <archivo>`).

- [ ] **Step 2: Comprobar que no quedaron literales en los componentes cliente**

```bash
cd nextjs && grep -rnE "5492995769999|299 576-9999|542995769999|aluminehogar@gmail|info@aluminehogar|Neuquen" components app/bot app/page.js | grep -v "VendedorModal\|admin"; cd ..
```
Expected: sin resultados (`VendedorModal` guarda "Neuquen" como provincia por defecto del formulario de presupuestos: no es un dato de la tienda y se deja).

- [ ] **Step 3: Compilar**

```bash
cd nextjs && npx next build 2>&1 | grep -E "Compiled|rror:|Failed|Type error"; cd ..
```
Expected: `✓ Compiled successfully`.

- [ ] **Step 4: Commit**

```bash
git add nextjs/components nextjs/app/bot/page.js
git commit -m "$(cat <<'EOF'
feat: Footer, WhatsApp, chatbot, carrito, home y producto leen la configuración del sitio

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 5: El servidor (chatbot de IA, emails, avisos) lee la configuración

**Files (modify):** `nextjs/lib/gemini.js`, `nextjs/lib/email.js`, `nextjs/app/api/chatbot/route.js`, `nextjs/app/api/mercadopago/route.js`

**Interfaces:**
- Consumes: `getSiteConfig()` (Task 2).
- Produces: nada nuevo; con los defaults los textos son los de hoy (salvo el detalle indicado de "Ubicacion").

- [ ] **Step 1: `gemini.js`**

Importar `import { getSiteConfig } from '@/lib/site-config';`. En `generateAIResponse`, antes de llamar a `buildSystemPrompt(productContext)`, agregar `const site = await getSiteConfig();` y pasar `site`: `buildSystemPrompt(productContext, site)`. Cambiar la firma a `function buildSystemPrompt(productContext, site)` y, al principio de la función, `const t = site.tienda; const c = site.chatbot;`. En el texto del prompt reemplazar:
- `"Alumine Hogar"` (primera línea) → `"${t.nombre}"`, y `en Neuquen, Argentina` → `en ${t.ciudad}, Argentina`.
- `- Nombre: Alumine Hogar` → `- Nombre: ${t.nombre}`.
- `- Ubicacion: Neuquen Capital, Argentina` → `- Ubicacion: ${[t.direccion, t.ciudad].filter(Boolean).join(', ')}, Argentina` (con los datos de fábrica pasa de "Neuquen Capital" a "Neuquen").
- `- WhatsApp: +54 9 299 576-9999` → `- WhatsApp: ${t.telefono}`.
- `- Envio GRATIS en Neuquen Capital` → `- ${c.envio}`.
- `- Formas de pago: Efectivo, transferencia, tarjetas (consultar cuotas)` → `- Formas de pago: ${c.formasDePago}`.
- Las cuatro líneas de `**POLITICAS:**` (garantías y cambios) → una sola expresión: `${c.politicas.split('\n').map((l) => l.trim()).filter(Boolean).map((l) => `- ${l}`).join('\n')}`.
- El sitio web (`https://aluminehogar.com.ar`) y el slogan se dejan.

- [ ] **Step 2: `email.js`**

Importar `import { getSiteConfig } from '@/lib/site-config';`. Los pies de las plantillas repiten `Alumine Hogar - Neuquen, Argentina` y `+54 9 299 576-9999 | aluminehogar@gmail.com` (4 veces). Agregar al archivo una función `function pieEmail(t)` que devuelva exactamente esas dos líneas de HTML con `${t.nombre} - ${t.ciudad}, Argentina` y `${t.telefono} | ${t.emailContacto}` (mismo estilo `style="margin: 0;"` / `style="margin: 5px 0 0;"` que hoy). Cada función de plantilla recibe `t` (la parte `tienda` de la configuración) como parámetro nuevo y usa `${pieEmail(t)}` en lugar del bloque repetido; cada función que envía hace `const { tienda } = await getSiteConfig();` y se lo pasa. El remitente `Alumine Hogar <noreply@aluminehogar.com.ar>` y el link del dominio se dejan.

- [ ] **Step 3: Emails de aviso**

En `app/api/chatbot/route.js` (~l.77): `destinatario: process.env.ADMIN_EMAIL || 'aluminehogar@gmail.com'` → `destinatario: process.env.ADMIN_EMAIL || (await getSiteConfig()).tienda.emailNotificaciones` (importar `getSiteConfig`; confirmar que el contexto es `async`, si no, calcular `const { tienda } = await getSiteConfig();` antes). Lo mismo en `app/api/mercadopago/route.js` (~l.175): **cambiar solo esa expresión**, sin tocar la ruta, el método ni nada de la lógica del webhook.

- [ ] **Step 4: Compilar y comprobar que no quedan literales**

```bash
cd nextjs && npx next build 2>&1 | grep -E "Compiled|rror:|Failed|Type error"; grep -rnE "299 576-9999|aluminehogar@gmail|Neuquen" lib/gemini.js lib/email.js app/api/chatbot app/api/mercadopago; cd ..
```
Expected: `✓ Compiled successfully` y el `grep` sin resultados.

- [ ] **Step 5: Commit**

```bash
git add nextjs/lib/gemini.js nextjs/lib/email.js nextjs/app/api/chatbot/route.js nextjs/app/api/mercadopago/route.js
git commit -m "$(cat <<'EOF'
feat: Chatbot de IA, emails y avisos leen la configuración del sitio

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 6: Pantalla "Configuración del sitio"

**Files:**
- Create: `nextjs/components/admin/ConfigSitioPanel.jsx`
- Create: `nextjs/app/admin/configuracion/sitio/page.js`
- Modify: `nextjs/services/api.js` (funciones `obtenerSiteConfig`, `guardarSiteConfig`)
- Modify: `nextjs/lib/admin-menu.js` (nuevo ítem `config-sitio`)

**Interfaces:**
- Consumes: `GET/PUT /api/site-config` (Task 2).
- Produces: ítem de menú `config-sitio` (sección `configuracion`, ruta `/admin/configuracion/sitio`, ícono `Settings`, roles `['admin']`); `obtenerSiteConfig(): Promise<{ success, config }>`, `guardarSiteConfig(config): Promise<{ success, config }>`.

- [ ] **Step 1: Funciones de API.** Al final de `nextjs/services/api.js`:
```js

// =================== CONFIGURACION DEL SITIO ===================

export const obtenerSiteConfig = async () => {
  const response = await api.get('/site-config');
  return response.data;
};

export const guardarSiteConfig = async (config) => {
  const response = await api.put('/site-config', config);
  return response.data;
};
```

- [ ] **Step 2: Crear `nextjs/components/admin/ConfigSitioPanel.jsx`**

```jsx
'use client';

import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { obtenerSiteConfig, guardarSiteConfig } from '@/services/api';

// Grupos y campos del formulario (los mismos que valida el servidor)
const GRUPOS = [
  {
    id: 'tienda',
    titulo: 'Datos de la tienda',
    campos: [
      { id: 'nombre', etiqueta: 'Nombre comercial' },
      { id: 'telefono', etiqueta: 'Teléfono', ayuda: 'Como se muestra en el sitio. Ej: +54 9 299 576-9999' },
      { id: 'whatsapp', etiqueta: 'WhatsApp', ayuda: 'Solo números, con código de país y sin +. Ej: 5492995769999' },
      { id: 'emailContacto', etiqueta: 'Email de contacto', ayuda: 'Se muestra en el pie de página y en los emails' },
      { id: 'emailNotificaciones', etiqueta: 'Email para avisos', ayuda: 'Acá llegan los avisos de ventas y consultas del chatbot' },
      { id: 'emailInfo', etiqueta: 'Email de la sección "Contacto" del inicio', ayuda: 'Opcional. Si lo dejás vacío se usa el de contacto' },
      { id: 'direccion', etiqueta: 'Dirección', ayuda: 'Opcional' },
      { id: 'ciudad', etiqueta: 'Ciudad' },
    ],
  },
  {
    id: 'redes',
    titulo: 'Redes sociales',
    campos: [
      { id: 'instagram', etiqueta: 'Instagram', ayuda: 'Link completo con https://. Si lo dejás vacío no se muestra' },
      { id: 'facebook', etiqueta: 'Facebook', ayuda: 'Link completo con https://. Si lo dejás vacío no se muestra' },
    ],
  },
  {
    id: 'inicio',
    titulo: 'Textos de la página de inicio',
    campos: [
      { id: 'titulo', etiqueta: 'Título grande' },
      { id: 'subtitulo', etiqueta: 'Subtítulo' },
    ],
  },
  {
    id: 'chatbot',
    titulo: 'Lo que sabe decir el chatbot',
    campos: [
      { id: 'envio', etiqueta: 'Envíos' },
      { id: 'formasDePago', etiqueta: 'Formas de pago' },
      { id: 'politicas', etiqueta: 'Políticas (garantías, cambios)', ayuda: 'Una por línea', multilinea: true },
    ],
  },
];

export default function ConfigSitioPanel() {
  const [config, setConfig] = useState(null);
  const [guardando, setGuardando] = useState(false);
  const [mensaje, setMensaje] = useState(null);
  const [errores, setErrores] = useState([]);

  useEffect(() => {
    obtenerSiteConfig()
      .then((data) => setConfig(data.config))
      .catch(() => setMensaje({ tipo: 'error', texto: 'No se pudo cargar la configuración' }));
  }, []);

  const cambiar = (grupo, campo, valor) =>
    setConfig((prev) => ({ ...prev, [grupo]: { ...prev[grupo], [campo]: valor } }));

  const handleGuardar = async (e) => {
    e.preventDefault();
    setGuardando(true);
    setMensaje(null);
    setErrores([]);
    try {
      const data = await guardarSiteConfig(config);
      setConfig(data.config);
      setMensaje({ tipo: 'ok', texto: 'Guardado. El sitio ya muestra los cambios.' });
    } catch (err) {
      setErrores(err.response?.data?.errores || []);
      setMensaje({ tipo: 'error', texto: err.response?.data?.error || 'No se pudo guardar' });
    } finally {
      setGuardando(false);
    }
  };

  if (!config) {
    return <div className="text-center py-12 text-gray-500">{mensaje ? mensaje.texto : 'Cargando...'}</div>;
  }

  return (
    <form onSubmit={handleGuardar} className="space-y-6 max-w-3xl">
      <div>
        <h2 className="text-2xl font-bold">Configuración del sitio</h2>
        <p className="text-sm text-gray-500">Los cambios se ven en el sitio apenas guardás.</p>
      </div>

      {GRUPOS.map((g) => (
        <section key={g.id} className="bg-white shadow rounded-lg p-6 space-y-4">
          <h3 className="text-lg font-semibold">{g.titulo}</h3>
          {g.campos.map((c) => (
            <div key={c.id}>
              <label className="block text-sm font-medium mb-1" htmlFor={`${g.id}-${c.id}`}>{c.etiqueta}</label>
              {c.multilinea ? (
                <textarea id={`${g.id}-${c.id}`} rows={5} value={config[g.id][c.id]}
                  onChange={(e) => cambiar(g.id, c.id, e.target.value)}
                  className="w-full border rounded px-3 py-2 text-sm" />
              ) : (
                <input id={`${g.id}-${c.id}`} type="text" value={config[g.id][c.id]}
                  onChange={(e) => cambiar(g.id, c.id, e.target.value)}
                  className="w-full border rounded px-3 py-2 text-sm" />
              )}
              {c.ayuda && <p className="text-xs text-gray-500 mt-1">{c.ayuda}</p>}
            </div>
          ))}
        </section>
      ))}

      {mensaje && (
        <div className={`rounded-lg p-4 text-sm border ${mensaje.tipo === 'ok' ? 'bg-green-50 border-green-200 text-green-800' : 'bg-red-50 border-red-200 text-red-800'}`}>
          {mensaje.texto}
          {errores.length > 0 && (
            <ul className="list-disc ml-5 mt-2">
              {errores.map((er) => <li key={er}>{er}</li>)}
            </ul>
          )}
        </div>
      )}

      <button type="submit" disabled={guardando}
        className="bg-blue-600 text-white px-5 py-2 rounded text-sm hover:bg-blue-700 disabled:bg-gray-400 flex items-center gap-2">
        {guardando && <Loader2 className="w-4 h-4 animate-spin" />}
        {guardando ? 'Guardando...' : 'Guardar'}
      </button>
    </form>
  );
}
```

- [ ] **Step 3: Crear `nextjs/app/admin/configuracion/sitio/page.js`**
```jsx
import ConfigSitioPanel from '@/components/admin/ConfigSitioPanel';

export default function Page() {
  return <ConfigSitioPanel />;
}
```

- [ ] **Step 4: Agregar el ítem al menú.** En `nextjs/lib/admin-menu.js`, dentro de `ITEMS`, después de `usuarios`:
```js
  { id: 'config-sitio', seccion: 'configuracion', etiqueta: 'Configuración del sitio', icono: 'Settings', ruta: '/admin/configuracion/sitio', roles: ['admin'] },
```

- [ ] **Step 5: Verificadores y build**

```bash
node docs/superpowers/plans/verificar-menu.mjs 2>&1 | grep -E "✓|✗"
node docs/superpowers/plans/verificar-config.mjs 2>&1 | grep -E "✓|✗"
cd nextjs && npx next build 2>&1 | grep -E "Compiled|rror:|Failed|Type error|/admin/configuracion"; cd ..
```
Expected: `✓ Menú OK: 4 secciones, 9 pestañas...`, `✓ Configuración del sitio OK`, `✓ Compiled successfully` y la ruta `/admin/configuracion/sitio`.

- [ ] **Step 6: Commit**
```bash
git add nextjs/components/admin/ConfigSitioPanel.jsx nextjs/app/admin/configuracion/sitio nextjs/services/api.js nextjs/lib/admin-menu.js
git commit -m "$(cat <<'EOF'
feat: Pantalla Configuración del sitio en el panel admin

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 7: Tabla de permisos, sesión del admin y vendedores en modo solo lectura

**Files:**
- Create: `nextjs/lib/permisos.js`
- Create: `docs/superpowers/plans/verificar-permisos.mjs`
- Create: `nextjs/components/admin/AdminSession.jsx`
- Modify: `nextjs/lib/admin-menu.js` (roles de vendedor en `creditos`, `productos`, `depositos`)
- Modify: `nextjs/app/api/admin/route.js` (`me` y listado de productos también para vendedor)
- Modify: `nextjs/app/admin/layout.js` (provee la sesión; etiqueta de rol)
- Modify: `nextjs/components/admin/ProductosPanel.jsx`, `DepositosPanel.jsx`, `CreditosPanel.jsx` (ocultar controles de edición si el rol no puede editar)

**Interfaces:**
- Consumes: `ITEMS` de `lib/admin-menu.js`.
- Produces: `PANTALLAS` (`{ [pantallaId]: { ver: string[], editar: string[] } }`), `puedeVer(rol, pantalla): boolean`, `puedeEditar(rol, pantalla): boolean`, `rolesQueVen(pantalla): string[]` (de `lib/permisos.js`); `AdminSessionProvider` y `useAdminSession(): { role, email, id }` (sin proveedor devuelve `{ role: 'customer' }`).

- [ ] **Step 1: Escribir el verificador (debe fallar)**

Create `docs/superpowers/plans/verificar-permisos.mjs`:
```js
#!/usr/bin/env node
/**
 * Verifica la tabla de permisos y su coherencia con el menú.
 * Uso (desde la raíz del repo): node docs/superpowers/plans/verificar-permisos.mjs
 */
import path from 'path';
import { pathToFileURL } from 'url';
import assert from 'assert/strict';

const lib = (f) => import(pathToFileURL(path.join(process.cwd(), 'nextjs/lib', f)).href);
const { PANTALLAS, puedeVer, puedeEditar, rolesQueVen } = await lib('permisos.js');
const { ITEMS } = await lib('admin-menu.js');

const problemas = [];
const t = (nombre, fn) => { try { fn(); } catch (e) { problemas.push(`${nombre}: ${e.message.split('\n')[0]}`); } };

t('admin ve y edita todo', () => {
  for (const id of Object.keys(PANTALLAS)) {
    assert.equal(puedeVer('admin', id), true, `ver ${id}`);
    assert.equal(puedeEditar('admin', id), true, `editar ${id}`);
  }
});
t('vendedor ve productos pero no edita', () => {
  assert.equal(puedeVer('vendedor', 'productos'), true);
  assert.equal(puedeEditar('vendedor', 'productos'), false);
});
t('vendedor ve depósitos pero no edita', () => {
  assert.equal(puedeVer('vendedor', 'depositos'), true);
  assert.equal(puedeEditar('vendedor', 'depositos'), false);
});
t('vendedor ve créditos pero no los administra', () => {
  assert.equal(puedeVer('vendedor', 'creditos'), true);
  assert.equal(puedeEditar('vendedor', 'creditos'), false);
});
for (const id of ['usuarios', 'conversaciones', 'importar-pdf', 'promociones', 'medios-pago', 'config-sitio', 'editar-menu']) {
  t(`vendedor no ve ${id}`, () => assert.equal(puedeVer('vendedor', id), false));
}
t('cliente no ve nada', () => {
  for (const id of Object.keys(PANTALLAS)) assert.equal(puedeVer('customer', id), false, id);
});
t('rol o pantalla desconocidos no ven nada', () => {
  assert.equal(puedeVer('hacker', 'productos'), false);
  assert.equal(puedeVer('admin', 'no-existe'), false);
  assert.equal(puedeVer(undefined, 'productos'), false);
});
t('rolesQueVen', () => {
  assert.deepEqual(rolesQueVen('creditos'), ['admin', 'vendedor']);
  assert.deepEqual(rolesQueVen('usuarios'), ['admin']);
  assert.deepEqual(rolesQueVen('no-existe'), []);
});
t('cada pantalla del menú tiene permisos', () => {
  for (const i of ITEMS) assert.ok(PANTALLAS[i.id], `falta ${i.id} en PANTALLAS`);
});
t('los roles por defecto del menú están permitidos', () => {
  for (const i of ITEMS) for (const r of i.roles) assert.ok(rolesQueVen(i.id).includes(r), `${i.id}: ${r} no puede verla`);
});

if (problemas.length) {
  console.error(`✗ ${problemas.length} problema(s):\n` + problemas.map((p) => '  - ' + p).join('\n'));
  process.exit(1);
}
console.log('✓ Permisos OK: matriz rol × pantalla coherente con el menú');
```
Run: `node docs/superpowers/plans/verificar-permisos.mjs 2>&1 | tail -3` → Expected: `Cannot find module ... permisos.js`.

- [ ] **Step 2: Crear `nextjs/lib/permisos.js`**

```js
// Autoridad de permisos del panel: qué rol puede VER y EDITAR cada pantalla.
// El menú (lib/menu-config.js) solo decide qué se muestra y nunca puede dar más permisos que esta tabla.
// Los ids son los de lib/admin-menu.js.
export const PANTALLAS = {
  productos: { ver: ['admin', 'vendedor'], editar: ['admin'] },
  depositos: { ver: ['admin', 'vendedor'], editar: ['admin'] },
  creditos: { ver: ['admin', 'vendedor'], editar: ['admin'] },
  conversaciones: { ver: ['admin'], editar: ['admin'] },
  'importar-pdf': { ver: ['admin'], editar: ['admin'] },
  promociones: { ver: ['admin'], editar: ['admin'] },
  'medios-pago': { ver: ['admin'], editar: ['admin'] },
  usuarios: { ver: ['admin'], editar: ['admin'] },
  'config-sitio': { ver: ['admin'], editar: ['admin'] },
  'editar-menu': { ver: ['admin'], editar: ['admin'] },
};

export function puedeVer(rol, pantalla) {
  return Boolean(PANTALLAS[pantalla]?.ver.includes(rol));
}

export function puedeEditar(rol, pantalla) {
  return Boolean(PANTALLAS[pantalla]?.editar.includes(rol));
}

export function rolesQueVen(pantalla) {
  return [...(PANTALLAS[pantalla]?.ver ?? [])];
}
```

- [ ] **Step 3: Roles por defecto en el menú.** En `nextjs/lib/admin-menu.js` cambiar `roles: ['admin']` por `roles: ['admin', 'vendedor']` en los ítems `creditos`, `productos` y `depositos` (los demás quedan en `['admin']`).

- [ ] **Step 4: Correr el verificador (debe pasar)**
```bash
node docs/superpowers/plans/verificar-permisos.mjs 2>&1 | grep -E "✓|✗|  - "
```
Expected: `✓ Permisos OK ...`.

- [ ] **Step 5: Crear `nextjs/components/admin/AdminSession.jsx`**
```jsx
'use client';

import { createContext, useContext } from 'react';

const AdminSessionContext = createContext(null);

// El marco entrega acá el usuario verificado por el servidor ({ id, email, role })
export const AdminSessionProvider = AdminSessionContext.Provider;

// Sin proveedor devuelve rol "customer" (sin permisos): ante la duda, no se muestra nada de edición
export function useAdminSession() {
  return useContext(AdminSessionContext) || { role: 'customer' };
}
```

- [ ] **Step 6: Servidor — `nextjs/app/api/admin/route.js`**

(a) Importar `requireRole` junto a los otros helpers de `@/lib/auth-helpers` y agregar, debajo de `authenticateAdmin`:
```js
function authenticateRole(request, roles) {
  const token = extractTokenFromHeaders(request.headers);
  if (!token) throw new Error('Token de autenticacion requerido');
  const decoded = verifyToken(token);
  requireRole(decoded, roles);
  return decoded;
}
```
(b) En `export async function GET(request)`: cambiar `const decoded = authenticateAdmin(request);` por `const decoded = authenticateRole(request, ['admin', 'vendedor']);`. El bloque `me` queda igual (devuelve el rol real). Justo después del bloque `me` y **antes** de `await connectDB();` agregar:
```js
    // Solo el listado de productos (sin action) puede verlo un vendedor; el resto de las acciones es solo admin
    const accionGet = request.nextUrl.searchParams.get('action');
    if (accionGet) requireAdmin(decoded);
```
(c) En el `catch` del GET (y solo ahí), ampliar la condición: `error.message.includes('Token') || error.message.includes('administrador') || error.message.includes('Acceso denegado')` → 403. (`requireRole` lanza "Acceso denegado: se requiere rol ...".) Verificar que `requireAdmin` esté importado (ya lo está).

- [ ] **Step 7: Marco — `nextjs/app/admin/layout.js`**

Importar `import { AdminSessionProvider } from '@/components/admin/AdminSession';`. Envolver el `{children}` final: `<div className="p-6"><AdminSessionProvider value={usuario}>{children}</AdminSessionProvider></div>`. Reemplazar la etiqueta fija `Administrador` por `{usuario.role === 'vendedor' ? 'Vendedor' : 'Administrador'}`.

- [ ] **Step 8: Paneles en solo lectura.** En cada panel agregar `import { useAdminSession } from '@/components/admin/AdminSession';`, `import { puedeEditar } from '@/lib/permisos';` y, dentro del componente, `const { role } = useAdminSession(); const puedeEditarX = puedeEditar(role, '<id>');` (ids: `productos`, `depositos`, `creditos`). Ocultar (no deshabilitar) lo siguiente cuando `puedeEditarX` es `false`:
  - `ProductosPanel.jsx`: botón **Importar stock**, botón **+ Crear Producto**, los botones − y + del stock (mostrar solo el número), el control de **Mostrar** (mostrar solo "Sí"/"No" como texto) y los links **Editar** / **Eliminar** de la columna Acciones. Se mantienen **Exportar stock**, buscador, filtros y orden.
  - `DepositosPanel.jsx`: el formulario **Nuevo deposito** y los botones **Activar/Desactivar** y **Eliminar**.
  - `CreditosPanel.jsx`: los botones de **aprobar / rechazar** y el bloque de configuración de límites/cuotas (el vendedor solo ve la lista).

- [ ] **Step 9: Verificadores y build**
```bash
node docs/superpowers/plans/verificar-permisos.mjs 2>&1 | grep -E "✓|✗"
node docs/superpowers/plans/verificar-menu.mjs 2>&1 | grep -E "✓|✗"
cd nextjs && npx next build 2>&1 | grep -E "Compiled|rror:|Failed|Type error"; cd ..
```
Expected: `✓ Permisos OK`, `✓ Menú OK`, `✓ Compiled successfully`.

- [ ] **Step 10: Commit**
```bash
git add nextjs/lib/permisos.js nextjs/lib/admin-menu.js docs/superpowers/plans/verificar-permisos.mjs nextjs/components/admin nextjs/app/api/admin/route.js nextjs/app/admin/layout.js
git commit -m "$(cat <<'EOF'
feat: Tabla de permisos por pantalla, sesión del admin y vendedores en solo lectura

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 8: Lógica pura del menú editable (normalizar, validar, resolver)

**Files:**
- Create: `nextjs/lib/menu-config.js`
- Create: `docs/superpowers/plans/verificar-menu-config.mjs`

**Interfaces:**
- Consumes: `ITEMS`, `SECCIONES` (`lib/admin-menu.js`), `rolesQueVen`, `puedeVer` (`lib/permisos.js`).
- Produces: `ITEMS_BLOQUEADOS: string[]`, `ICONOS_SECCION: string[]`, `menuDeFabrica(): { secciones, items }`, `normalizarMenu(guardado): { secciones, items }`, `validarMenu(entrada): { ok, errores, valor }`, `resolverMenu(menu, rol): { id, etiqueta, icono, items: { id, etiqueta, icono, ruta }[] }[]`. Formas: sección `{ id, etiqueta, icono, visible }`; ítem `{ id, seccion, etiqueta, visible, roles }`; el orden es el orden del arreglo.

- [ ] **Step 1: Escribir el verificador (debe fallar)**

Create `docs/superpowers/plans/verificar-menu-config.mjs`:
```js
#!/usr/bin/env node
/**
 * Verifica la lógica pura del menú editable.
 * Uso (desde la raíz del repo): node docs/superpowers/plans/verificar-menu-config.mjs
 */
import path from 'path';
import { pathToFileURL } from 'url';
import assert from 'assert/strict';

const lib = (f) => import(pathToFileURL(path.join(process.cwd(), 'nextjs/lib', f)).href);
const { menuDeFabrica, normalizarMenu, validarMenu, resolverMenu } = await lib('menu-config.js');
const { ITEMS } = await lib('admin-menu.js');

const problemas = [];
const t = (nombre, fn) => { try { fn(); } catch (e) { problemas.push(`${nombre}: ${e.message.split('\n')[0]}`); } };
const clon = () => structuredClone(menuDeFabrica());
const ids = (menu, rol) => resolverMenu(menu, rol).flatMap((s) => s.items.map((i) => i.id));

t('el menú de fábrica es válido', () => assert.equal(validarMenu(menuDeFabrica()).ok, true));
t('normalizar(null) es el menú de fábrica', () => assert.deepEqual(normalizarMenu(null), menuDeFabrica()));
t('admin ve todas las pantallas', () => assert.equal(ids(menuDeFabrica(), 'admin').length, ITEMS.length));
t('vendedor ve solo créditos, productos y depósitos', () => assert.deepEqual(ids(menuDeFabrica(), 'vendedor').sort(), ['creditos', 'depositos', 'productos']));
t('cliente no ve nada', () => assert.deepEqual(resolverMenu(menuDeFabrica(), 'customer'), []));
t('resolver trae ruta e ícono del catálogo', () => {
  const p = resolverMenu(menuDeFabrica(), 'admin').flatMap((s) => s.items).find((i) => i.id === 'productos');
  assert.equal(p.ruta, '/admin/store/productos');
  assert.equal(p.icono, 'Package');
});
t('ocultar una opción la saca del menú', () => {
  const m = clon(); m.items.find((i) => i.id === 'promociones').visible = false;
  assert.equal(ids(m, 'admin').includes('promociones'), false);
});
t('ocultar una sección saca todas sus opciones', () => {
  const m = clon(); m.secciones.find((s) => s.id === 'marketing').visible = false;
  assert.equal(validarMenu(m).ok, true);
  assert.equal(ids(m, 'admin').includes('promociones'), false);
});
t('renombrar y mover una opción de sección', () => {
  const m = clon(); const it = m.items.find((i) => i.id === 'medios-pago'); it.etiqueta = 'Cobros'; it.seccion = 'configuracion';
  assert.equal(validarMenu(m).ok, true);
  const conf = resolverMenu(m, 'admin').find((s) => s.id === 'configuracion');
  assert.equal(conf.items.find((i) => i.id === 'medios-pago').etiqueta, 'Cobros');
});
t('reordenar secciones cambia el orden resuelto', () => {
  const m = clon(); m.secciones.reverse();
  assert.equal(validarMenu(m).ok, true);
  assert.equal(resolverMenu(m, 'admin')[0].id, 'configuracion');
});
t('crear una sección nueva con una opción adentro', () => {
  const m = clon(); m.secciones.push({ id: 'custom-abc123', etiqueta: 'Mi sección', icono: 'Folder', visible: true });
  m.items.find((i) => i.id === 'conversaciones').seccion = 'custom-abc123';
  assert.equal(validarMenu(m).ok, true);
  assert.equal(resolverMenu(m, 'admin').find((s) => s.id === 'custom-abc123').items[0].id, 'conversaciones');
});
t('un rol que no puede ver la pantalla se rechaza', () => {
  const m = clon(); m.items.find((i) => i.id === 'usuarios').roles = ['admin', 'vendedor'];
  assert.equal(validarMenu(m).ok, false);
});
t('aunque se guarde, el vendedor no ve usuarios', () => {
  const m = clon(); m.items.find((i) => i.id === 'usuarios').roles = ['admin', 'vendedor'];
  assert.equal(ids(m, 'vendedor').includes('usuarios'), false);
});
t('no se puede ocultar Editar menú', () => {
  const m = clon(); m.items.find((i) => i.id === 'editar-menu').visible = false;
  assert.equal(validarMenu(m).ok, false);
});
t('no se puede sacar al admin de Configuración del sitio', () => {
  const m = clon(); m.items.find((i) => i.id === 'config-sitio').roles = ['vendedor'];
  assert.equal(validarMenu(m).ok, false);
});
t('no se puede ocultar la sección que tiene opciones bloqueadas', () => {
  const m = clon(); m.secciones.find((s) => s.id === 'configuracion').visible = false;
  assert.equal(validarMenu(m).ok, false);
});
t('normalizar vuelve a poner el candado aunque lo guardado lo haya sacado', () => {
  const m = clon(); m.items.find((i) => i.id === 'editar-menu').visible = false; m.secciones.find((s) => s.id === 'configuracion').visible = false;
  const n = normalizarMenu(m);
  assert.equal(n.items.find((i) => i.id === 'editar-menu').visible, true);
  assert.equal(n.secciones.find((s) => s.id === 'configuracion').visible, true);
});
t('opción desconocida se rechaza', () => {
  const m = clon(); m.items.push({ id: 'hack', seccion: 'store', etiqueta: 'x', visible: true, roles: ['admin'] });
  assert.equal(validarMenu(m).ok, false);
});
t('falta una opción del catálogo', () => {
  const m = clon(); m.items = m.items.filter((i) => i.id !== 'productos');
  assert.equal(validarMenu(m).ok, false);
});
t('no se puede borrar una sección de fábrica', () => {
  const m = clon(); m.secciones = m.secciones.filter((s) => s.id !== 'marketing');
  assert.equal(validarMenu(m).ok, false);
});
t('nombre vacío o demasiado largo se rechaza', () => {
  const a = clon(); a.items[0].etiqueta = '   ';
  const b = clon(); b.secciones[0].etiqueta = 'x'.repeat(41);
  assert.equal(validarMenu(a).ok, false);
  assert.equal(validarMenu(b).ok, false);
});
t('ícono de sección inválido se rechaza', () => {
  const m = clon(); m.secciones[0].icono = '<script>';
  assert.equal(validarMenu(m).ok, false);
});
t('más de 12 secciones se rechaza', () => {
  const m = clon(); for (let i = 0; i < 9; i++) m.secciones.push({ id: `custom-${i}`, etiqueta: `S${i}`, icono: 'Folder', visible: true });
  assert.equal(validarMenu(m).ok, false);
});
t('entrada vacía o basura se rechaza', () => {
  assert.equal(validarMenu(null).ok, false);
  assert.equal(validarMenu({ secciones: 'x', items: 1 }).ok, false);
});
t('el valor devuelto no trae campos extra', () => {
  const m = clon(); m.items[0].hack = 'x'; m.secciones[0].hack = 'y';
  const r = validarMenu(m);
  assert.equal(r.ok, true);
  assert.equal('hack' in r.valor.items[0], false);
  assert.equal('hack' in r.valor.secciones[0], false);
});
t('una pantalla nueva del código aparece aunque no esté guardada', () => {
  const m = clon(); m.items = m.items.filter((i) => i.id !== 'promociones');
  assert.equal(normalizarMenu(m).items.some((i) => i.id === 'promociones'), true);
});

if (problemas.length) {
  console.error(`✗ ${problemas.length} problema(s):\n` + problemas.map((p) => '  - ' + p).join('\n'));
  process.exit(1);
}
console.log('✓ Menú editable OK: normalizar, validar, candados y resolver por rol');
```
Run → Expected: `Cannot find module ... menu-config.js`.

- [ ] **Step 2: Crear `nextjs/lib/menu-config.js`**

```js
import { ITEMS, SECCIONES } from './admin-menu.js';
import { rolesQueVen, puedeVer } from './permisos.js';

// Estas opciones no se pueden ocultar ni sacarle el rol admin: así el dueño nunca se queda sin acceso a la configuración
export const ITEMS_BLOQUEADOS = ['config-sitio', 'editar-menu'];
export const ICONOS_SECCION = ['ShoppingCart', 'Store', 'Megaphone', 'Settings', 'Folder'];

const MAX_SECCIONES = 12;
const MAX_NOMBRE = 40;
const ID_SECCION = /^[a-z0-9-]{1,40}$/;

// El catálogo (ruta, ícono, permisos) sale siempre del código: lo guardado nunca puede apuntar a rutas inventadas
const catalogo = Object.fromEntries(ITEMS.map((i) => [i.id, i]));

export function menuDeFabrica() {
  return {
    secciones: SECCIONES.map((s) => ({ id: s.id, etiqueta: s.etiqueta, icono: s.icono, visible: true })),
    items: ITEMS.map((i) => ({ id: i.id, seccion: i.seccion, etiqueta: i.etiqueta, visible: true, roles: [...i.roles] })),
  };
}

// Completa lo guardado con lo que falte del código (secciones de fábrica, pantallas nuevas), descarta lo que ya no
// existe y vuelve a poner los candados. Nunca lanza: ante basura devuelve el menú de fábrica.
export function normalizarMenu(guardado) {
  const fabrica = menuDeFabrica();
  if (!guardado || !Array.isArray(guardado.secciones) || !Array.isArray(guardado.items)) return fabrica;

  const secciones = [];
  const vistas = new Set();
  for (const s of guardado.secciones) {
    if (!s || typeof s.id !== 'string' || vistas.has(s.id)) continue;
    vistas.add(s.id);
    secciones.push({
      id: s.id,
      etiqueta: String(s.etiqueta || s.id).slice(0, MAX_NOMBRE),
      icono: ICONOS_SECCION.includes(s.icono) ? s.icono : 'Folder',
      visible: s.visible !== false,
    });
  }
  for (const f of fabrica.secciones) if (!vistas.has(f.id)) secciones.push(f);

  const idsSecciones = new Set(secciones.map((s) => s.id));
  const items = [];
  const vistos = new Set();
  for (const it of guardado.items) {
    const cat = it && catalogo[it.id];
    if (!cat || vistos.has(it.id)) continue;
    vistos.add(it.id);
    const permitidos = rolesQueVen(it.id);
    items.push({
      id: it.id,
      seccion: idsSecciones.has(it.seccion) ? it.seccion : cat.seccion,
      etiqueta: String(it.etiqueta || cat.etiqueta).slice(0, MAX_NOMBRE),
      visible: it.visible !== false,
      roles: Array.isArray(it.roles) ? it.roles.filter((r) => permitidos.includes(r)) : [...cat.roles],
    });
  }
  for (const f of fabrica.items) if (!vistos.has(f.id)) items.push(f);

  for (const it of items) {
    if (ITEMS_BLOQUEADOS.includes(it.id)) {
      it.visible = true;
      it.roles = ['admin'];
    }
  }
  for (const s of secciones) {
    if (items.some((it) => ITEMS_BLOQUEADOS.includes(it.id) && it.seccion === s.id)) s.visible = true;
  }
  return { secciones, items };
}

// Valida lo que manda el editor. Devuelve el valor limpio o la lista de errores en español.
export function validarMenu(entrada) {
  const errores = [];
  if (!entrada || !Array.isArray(entrada.secciones) || !Array.isArray(entrada.items)) {
    return { ok: false, errores: ['Menú inválido'], valor: null };
  }
  if (entrada.secciones.length < 1 || entrada.secciones.length > MAX_SECCIONES) {
    errores.push(`Tiene que haber entre 1 y ${MAX_SECCIONES} secciones`);
  }

  const idsSec = new Set();
  const secOk = [];
  for (const s of entrada.secciones) {
    const id = s?.id;
    if (typeof id !== 'string' || !ID_SECCION.test(id)) {
      errores.push('Hay una sección con un identificador inválido');
      continue;
    }
    if (idsSec.has(id)) {
      errores.push(`Sección repetida: ${id}`);
      continue;
    }
    idsSec.add(id);
    const etiqueta = typeof s.etiqueta === 'string' ? s.etiqueta.trim() : '';
    if (!etiqueta || etiqueta.length > MAX_NOMBRE) errores.push(`Sección ${id}: el nombre debe tener entre 1 y ${MAX_NOMBRE} caracteres`);
    if (!ICONOS_SECCION.includes(s.icono)) errores.push(`Sección ${id}: ícono inválido`);
    secOk.push({ id, etiqueta, icono: s.icono, visible: s.visible !== false });
  }
  for (const f of SECCIONES) {
    if (!idsSec.has(f.id)) errores.push(`Falta la sección "${f.etiqueta}": las secciones de fábrica se pueden ocultar pero no borrar`);
  }

  const idsIt = new Set();
  const itOk = [];
  for (const it of entrada.items) {
    const id = it?.id;
    const cat = catalogo[id];
    if (!cat) {
      errores.push(`Opción desconocida: ${String(id).slice(0, 40)}`);
      continue;
    }
    if (idsIt.has(id)) {
      errores.push(`Opción repetida: ${cat.etiqueta}`);
      continue;
    }
    idsIt.add(id);
    const etiqueta = typeof it.etiqueta === 'string' ? it.etiqueta.trim() : '';
    if (!etiqueta || etiqueta.length > MAX_NOMBRE) errores.push(`${cat.etiqueta}: el nombre debe tener entre 1 y ${MAX_NOMBRE} caracteres`);
    if (!idsSec.has(it.seccion)) errores.push(`${cat.etiqueta}: la sección elegida no existe`);
    const permitidos = rolesQueVen(id);
    const roles = Array.isArray(it.roles) ? [...new Set(it.roles)] : [];
    const noPermitidos = roles.filter((r) => !permitidos.includes(r));
    if (noPermitidos.length) errores.push(`${cat.etiqueta}: el rol ${noPermitidos.join(', ')} no puede ver esta pantalla`);
    const visible = it.visible !== false;
    if (visible && roles.length === 0) errores.push(`${cat.etiqueta}: elegí al menos un rol o escondela`);
    if (ITEMS_BLOQUEADOS.includes(id) && (!visible || roles.length !== 1 || roles[0] !== 'admin')) {
      errores.push(`${cat.etiqueta}: no se puede ocultar ni sacarle el rol admin`);
    }
    itOk.push({ id, seccion: it.seccion, etiqueta, visible, roles });
  }
  for (const c of ITEMS) {
    if (!idsIt.has(c.id)) errores.push(`Falta la opción ${c.etiqueta}`);
  }
  for (const s of secOk) {
    if (!s.visible && itOk.some((i) => ITEMS_BLOQUEADOS.includes(i.id) && i.seccion === s.id)) {
      errores.push(`La sección "${s.etiqueta}" contiene opciones que no se pueden ocultar`);
    }
  }

  return errores.length
    ? { ok: false, errores, valor: null }
    : { ok: true, errores: [], valor: { secciones: secOk, items: itOk } };
}

// Menú tal como lo ve un rol: solo secciones y opciones visibles, con permiso de ver, y con ruta e ícono del catálogo
export function resolverMenu(menu, rol) {
  const m = normalizarMenu(menu);
  return m.secciones
    .filter((s) => s.visible)
    .map((s) => ({
      id: s.id,
      etiqueta: s.etiqueta,
      icono: s.icono,
      items: m.items
        .filter((i) => i.seccion === s.id && i.visible && i.roles.includes(rol) && puedeVer(rol, i.id))
        .map((i) => ({ id: i.id, etiqueta: i.etiqueta, icono: catalogo[i.id].icono, ruta: catalogo[i.id].ruta })),
    }))
    .filter((s) => s.items.length > 0);
}
```

- [ ] **Step 3: Agregar el ítem `editar-menu` al catálogo.** En `nextjs/lib/admin-menu.js`, dentro de `ITEMS`, después de `config-sitio`:
```js
  { id: 'editar-menu', seccion: 'configuracion', etiqueta: 'Editar menú del panel', icono: 'Menu', ruta: '/admin/configuracion/menu', roles: ['admin'] },
```
(La página llega en Task 11; mientras tanto `verificar-menu.mjs` va a reportar esa única página faltante: es lo esperado en este paso.)

- [ ] **Step 4: Correr los verificadores**
```bash
node docs/superpowers/plans/verificar-menu-config.mjs 2>&1 | grep -E "✓|✗|  - "
node docs/superpowers/plans/verificar-permisos.mjs 2>&1 | grep -E "✓|✗|  - "
node docs/superpowers/plans/verificar-menu.mjs 2>&1 | grep -E "✓|✗|  - "
```
Expected: `✓ Menú editable OK`, `✓ Permisos OK`, y `verificar-menu.mjs` con **un** problema: `falta la página de "Editar menú del panel"`.

- [ ] **Step 5: Compilar y commit**
```bash
cd nextjs && npx next build 2>&1 | grep -E "Compiled|rror:|Failed|Type error"; cd ..
git add nextjs/lib/menu-config.js nextjs/lib/admin-menu.js docs/superpowers/plans/verificar-menu-config.mjs
git commit -m "$(cat <<'EOF'
feat: Lógica del menú editable (normalizar, validar y resolver por rol)

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 9: Modelo y API del menú del panel

**Files:**
- Create: `nextjs/lib/models/MenuConfig.js`
- Create: `nextjs/app/api/admin-menu/route.js`
- Modify: `nextjs/services/api.js` (4 funciones)

**Interfaces:**
- Consumes: `normalizarMenu`, `validarMenu`, `resolverMenu`, `ITEMS_BLOQUEADOS`, `ICONOS_SECCION` (Task 8), `ITEMS` (admin-menu), `rolesQueVen` (permisos).
- Produces: `GET /api/admin-menu` (admin o vendedor) → `{ success: true, menu: Seccion[] }` resuelto para el rol del token; `GET /api/admin-menu?action=config` (solo admin) → `{ success: true, config: { secciones, items }, catalogo: { id, etiqueta, ruta, rolesPermitidos, bloqueado }[], iconos: string[] }`; `PUT /api/admin-menu` (solo admin) → `{ success: true, config }` o 400 `{ error, errores }`; `DELETE /api/admin-menu` (solo admin) → `{ success: true }`. En `services/api.js`: `obtenerMenuPanel()`, `obtenerConfigMenu()`, `guardarMenu(config)`, `restaurarMenu()`.

- [ ] **Step 1: Crear `nextjs/lib/models/MenuConfig.js`**
```js
import mongoose from 'mongoose';

// Un solo documento (_id: 'default'). Guarda solo lo editable (nombres, orden, visibilidad, roles);
// la ruta y el ícono de cada pantalla salen siempre del catálogo en código.
const MenuConfigSchema = new mongoose.Schema({
  _id: { type: String, default: 'default' },
  secciones: { type: Array, default: [] },
  items: { type: Array, default: [] },
  updatedAt: { type: Date, default: Date.now }
}, { minimize: false });

export default mongoose.models.MenuConfig || mongoose.model('MenuConfig', MenuConfigSchema);
```

- [ ] **Step 2: Crear `nextjs/app/api/admin-menu/route.js`**
```js
import { NextResponse } from 'next/server';
import { connectDB } from '@/lib/db';
import MenuConfig from '@/lib/models/MenuConfig';
import { extractTokenFromHeaders, verifyToken, requireRole } from '@/lib/auth-helpers';
import { ITEMS } from '@/lib/admin-menu';
import { rolesQueVen } from '@/lib/permisos';
import { ICONOS_SECCION, ITEMS_BLOQUEADOS, normalizarMenu, resolverMenu, validarMenu } from '@/lib/menu-config';

function autenticar(request, roles) {
  const token = extractTokenFromHeaders(request.headers);
  if (!token) throw new Error('Token de autenticacion requerido');
  const decoded = verifyToken(token);
  requireRole(decoded, roles);
  return decoded;
}

const esErrorDeAcceso = (e) =>
  e.message.includes('Token') || e.message.includes('Acceso denegado');

async function leerGuardado() {
  await connectDB();
  return MenuConfig.findById('default').lean();
}

export async function GET(request) {
  try {
    const action = request.nextUrl.searchParams.get('action');

    // Datos para el editor: solo admin
    if (action === 'config') {
      autenticar(request, ['admin']);
      const config = normalizarMenu(await leerGuardado());
      const catalogo = ITEMS.map((i) => ({
        id: i.id,
        etiqueta: i.etiqueta,
        ruta: i.ruta,
        rolesPermitidos: rolesQueVen(i.id),
        bloqueado: ITEMS_BLOQUEADOS.includes(i.id),
      }));
      return NextResponse.json({ success: true, config, catalogo, iconos: ICONOS_SECCION });
    }

    // Menú del panel para quien entra: ya filtrado por su rol y por la tabla de permisos
    const decoded = autenticar(request, ['admin', 'vendedor']);
    const menu = resolverMenu(await leerGuardado(), decoded.role);
    return NextResponse.json({ success: true, menu });
  } catch (error) {
    if (esErrorDeAcceso(error)) return NextResponse.json({ error: error.message }, { status: 403 });
    console.error('Error en admin-menu GET:', error);
    return NextResponse.json({ error: 'Error en el servidor' }, { status: 500 });
  }
}

export async function PUT(request) {
  try {
    autenticar(request, ['admin']);
    const body = await request.json().catch(() => null);
    const { ok, errores, valor } = validarMenu(body);
    if (!ok) return NextResponse.json({ error: 'El menú tiene problemas', errores }, { status: 400 });

    await connectDB();
    await MenuConfig.findByIdAndUpdate(
      'default',
      { $set: { secciones: valor.secciones, items: valor.items, updatedAt: new Date() } },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
    return NextResponse.json({ success: true, config: valor });
  } catch (error) {
    if (esErrorDeAcceso(error)) return NextResponse.json({ error: error.message }, { status: 403 });
    console.error('Error en admin-menu PUT:', error);
    return NextResponse.json({ error: 'Error en el servidor' }, { status: 500 });
  }
}

// Restaurar de fábrica: borra lo guardado y vuelve al menú del código
export async function DELETE(request) {
  try {
    autenticar(request, ['admin']);
    await connectDB();
    await MenuConfig.deleteOne({ _id: 'default' });
    return NextResponse.json({ success: true });
  } catch (error) {
    if (esErrorDeAcceso(error)) return NextResponse.json({ error: error.message }, { status: 403 });
    console.error('Error en admin-menu DELETE:', error);
    return NextResponse.json({ error: 'Error en el servidor' }, { status: 500 });
  }
}
```

- [ ] **Step 3: Funciones de API.** Al final de `nextjs/services/api.js`:
```js

// =================== MENU DEL PANEL ===================

export const obtenerMenuPanel = async () => {
  const response = await api.get('/admin-menu');
  return response.data;
};

export const obtenerConfigMenu = async () => {
  const response = await api.get('/admin-menu?action=config');
  return response.data;
};

export const guardarMenu = async (config) => {
  const response = await api.put('/admin-menu', config);
  return response.data;
};

export const restaurarMenu = async () => {
  const response = await api.delete('/admin-menu');
  return response.data;
};
```

- [ ] **Step 4: Compilar y commit**
```bash
cd nextjs && npx next build 2>&1 | grep -E "Compiled|rror:|Failed|Type error|admin-menu"; cd ..
git add nextjs/lib/models/MenuConfig.js nextjs/app/api/admin-menu/route.js nextjs/services/api.js
git commit -m "$(cat <<'EOF'
feat: Modelo y API del menú del panel (leer por rol, guardar, restaurar)

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>
EOF
)"
```
Expected: `✓ Compiled successfully` y `/api/admin-menu` en las rutas.

---

### Task 10: El marco del admin usa el menú del servidor

**Files:**
- Replace: `nextjs/app/admin/layout.js` (archivo completo, abajo)

**Interfaces:**
- Consumes: `verificarAdmin`, `obtenerMenuPanel` (`services/api.js`), `seccionDeRuta` (`lib/admin-menu.js`), `menuDeFabrica`, `resolverMenu` (`lib/menu-config.js`), `AdminSessionProvider` (Task 7).
- Produces: el sidebar y las pestañas salen del menú resuelto por el servidor; si falla, del menú de fábrica del código; una URL de una pantalla que el rol no ve redirige a su primera pantalla visible; si no tiene ninguna, un aviso.

- [ ] **Step 1: Reemplazar todo el contenido de `nextjs/app/admin/layout.js` por:**

```jsx
'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  Menu, LogOut, ExternalLink, Loader2,
  ShoppingCart, Store, Megaphone, Settings, Folder,
  CreditCard, MessageSquare, Package, Warehouse, FileUp, Sparkles, Wallet, Users,
} from 'lucide-react';
import { useAuthStore } from '@/store/authStore';
import { verificarAdmin, obtenerMenuPanel } from '@/services/api';
import { seccionDeRuta } from '@/lib/admin-menu';
import { resolverMenu } from '@/lib/menu-config';
import { AdminSessionProvider } from '@/components/admin/AdminSession';

// El menú guarda los íconos por nombre; acá se resuelven
const ICONOS = { ShoppingCart, Store, Megaphone, Settings, Folder, Menu, CreditCard, MessageSquare, Package, Warehouse, FileUp, Sparkles, Wallet, Users };

function Icono({ nombre, className }) {
  const Componente = ICONOS[nombre];
  return Componente ? <Componente className={className} /> : null;
}

const coincide = (pathname, ruta) => pathname === ruta || pathname.startsWith(ruta + '/');

export default function AdminLayout({ children }) {
  const pathname = usePathname();
  const router = useRouter();
  const logout = useAuthStore((s) => s.logout);
  const [usuario, setUsuario] = useState(null);
  const [menu, setMenu] = useState(null);
  const [menuAbierto, setMenuAbierto] = useState(false);

  // Verifica el rol contra el servidor. No se dibuja nada del panel hasta tener respuesta.
  useEffect(() => {
    let cancelado = false;
    verificarAdmin()
      .then((data) => { if (!cancelado) setUsuario(data.usuario); })
      .catch(() => { if (!cancelado) router.replace('/'); });
    return () => { cancelado = true; };
  }, [router]);

  // Con el usuario verificado, pide el menú ya filtrado por su rol. Si falla, usa el de fábrica del código.
  useEffect(() => {
    if (!usuario) return;
    let cancelado = false;
    obtenerMenuPanel()
      .then((data) => { if (!cancelado) setMenu(data.menu); })
      .catch(() => { if (!cancelado) setMenu(resolverMenu(null, usuario.role)); });
    return () => { cancelado = true; };
  }, [usuario]);

  // En celular el menú se cierra al navegar
  useEffect(() => { setMenuAbierto(false); }, [pathname]);

  // Una pantalla del catálogo que este rol no ve: se lo lleva a la primera que sí ve
  const esPantalla = seccionDeRuta(pathname) !== null;
  const permitida = !menu || !esPantalla || menu.some((s) => s.items.some((it) => coincide(pathname, it.ruta)));
  useEffect(() => {
    if (menu && esPantalla && !permitida && menu[0]) router.replace(menu[0].items[0].ruta);
  }, [menu, esPantalla, permitida, router]);

  if (!usuario || !menu || (esPantalla && !permitida && menu.length > 0)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 text-gray-500">
        <Loader2 className="w-6 h-6 animate-spin mr-2" /> Verificando acceso...
      </div>
    );
  }

  const idActiva = menu.find((s) => s.items.some((it) => coincide(pathname, it.ruta)))?.id;
  const activa = menu.find((s) => s.id === idActiva);

  const handleLogout = () => {
    logout();
    router.push('/');
  };

  const sidebar = (
    <nav aria-label="Menú del panel" className="flex flex-col h-full">
      <div className="px-5 py-5 border-b border-white/10">
        <div className="text-lg font-bold">Aluminé Hogar</div>
        <div className="text-xs text-white/60 uppercase tracking-wide">Sistema de gestión</div>
      </div>
      <ul className="flex-1 overflow-y-auto py-3">
        {menu.map((s) => (
          <li key={s.id}>
            <Link
              href={s.items[0].ruta}
              onClick={() => setMenuAbierto(false)}
              aria-current={s.id === idActiva ? 'page' : undefined}
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
        <div className="text-xs text-white/60 mb-3">{usuario.role === 'vendedor' ? 'Vendedor' : 'Administrador'}</div>
        <Link href="/" onClick={() => setMenuAbierto(false)} className="flex items-center gap-2 text-white/80 hover:text-white mb-2">
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
          <nav aria-label="Pestañas de la sección" className="bg-white border-b px-6 flex gap-1 overflow-x-auto">
            {activa.items.map((it) => {
              const actual = coincide(pathname, it.ruta);
              return (
                <Link
                  key={it.id}
                  href={it.ruta}
                  aria-current={actual ? 'page' : undefined}
                  className={`flex items-center gap-2 px-4 py-3 text-sm font-medium whitespace-nowrap transition-colors ${
                    actual ? 'border-b-2 border-blue-600 text-blue-600' : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  <Icono nombre={it.icono} className="w-4 h-4" />
                  {it.etiqueta}
                </Link>
              );
            })}
          </nav>
        )}
        <div className="p-6">
          {menu.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              No tenés pantallas habilitadas en el panel. Pedile al administrador que te habilite alguna.
            </div>
          ) : (
            <AdminSessionProvider value={usuario}>{children}</AdminSessionProvider>
          )}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verificadores y build**
```bash
node docs/superpowers/plans/verificar-menu-config.mjs 2>&1 | grep -E "✓|✗"
cd nextjs && npx next build 2>&1 | grep -E "Compiled|rror:|Failed|Type error"; cd ..
```
Expected: `✓ Menú editable OK` y `✓ Compiled successfully`. (`verificar-menu.mjs` sigue con la única página faltante de Editar menú hasta Task 11.)

- [ ] **Step 3: Commit**
```bash
git add nextjs/app/admin/layout.js
git commit -m "$(cat <<'EOF'
feat: El marco del admin toma el menú del servidor según el rol del usuario

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 11: Pantalla "Editar menú del panel"

**Files:**
- Create: `nextjs/components/admin/MenuEditorPanel.jsx`
- Create: `nextjs/app/admin/configuracion/menu/page.js`

**Interfaces:**
- Consumes: `obtenerConfigMenu`, `guardarMenu`, `restaurarMenu` (Task 9); respuesta de `?action=config`: `{ config: { secciones, items }, catalogo: [{ id, etiqueta, ruta, rolesPermitidos, bloqueado }], iconos }`.
- Produces: la ruta `/admin/configuracion/menu` (ya declarada en el catálogo en Task 8).

- [ ] **Step 1: Crear `nextjs/components/admin/MenuEditorPanel.jsx`**

```jsx
'use client';

import { useEffect, useState } from 'react';
import { ArrowUp, ArrowDown, Eye, EyeOff, Plus, Trash2, Loader2 } from 'lucide-react';
import { obtenerConfigMenu, guardarMenu, restaurarMenu } from '@/services/api';

const ROL_ETIQUETA = { admin: 'Administrador', vendedor: 'Vendedor' };

// Mueve el elemento `id` una posición dentro del grupo que cumple `mismoGrupo`, intercambiándolo con su vecino
function mover(lista, id, direccion, mismoGrupo) {
  const copia = [...lista];
  const i = copia.findIndex((x) => x.id === id);
  let j = i + direccion;
  while (j >= 0 && j < copia.length && !mismoGrupo(copia[j], copia[i])) j += direccion;
  if (j < 0 || j >= copia.length) return lista;
  [copia[i], copia[j]] = [copia[j], copia[i]];
  return copia;
}

export default function MenuEditorPanel() {
  const [config, setConfig] = useState(null);
  const [catalogo, setCatalogo] = useState({});
  const [guardando, setGuardando] = useState(false);
  const [mensaje, setMensaje] = useState(null);
  const [errores, setErrores] = useState([]);

  const cargar = () =>
    obtenerConfigMenu()
      .then((data) => {
        setConfig(data.config);
        setCatalogo(Object.fromEntries(data.catalogo.map((c) => [c.id, c])));
      })
      .catch(() => setMensaje({ tipo: 'error', texto: 'No se pudo cargar el menú' }));

  useEffect(() => { cargar(); }, []);

  const cambiarSeccion = (id, parche) =>
    setConfig((c) => ({ ...c, secciones: c.secciones.map((s) => (s.id === id ? { ...s, ...parche } : s)) }));
  const cambiarItem = (id, parche) =>
    setConfig((c) => ({ ...c, items: c.items.map((i) => (i.id === id ? { ...i, ...parche } : i)) }));

  const alternarRol = (item, rol) => {
    const roles = item.roles.includes(rol) ? item.roles.filter((r) => r !== rol) : [...item.roles, rol];
    cambiarItem(item.id, { roles });
  };

  const agregarSeccion = () =>
    setConfig((c) => ({
      ...c,
      secciones: [...c.secciones, { id: `custom-${Math.random().toString(36).slice(2, 8)}`, etiqueta: 'Nueva sección', icono: 'Folder', visible: true }],
    }));

  const borrarSeccion = (id) =>
    setConfig((c) => ({ ...c, secciones: c.secciones.filter((s) => s.id !== id) }));

  const handleGuardar = async () => {
    setGuardando(true);
    setMensaje(null);
    setErrores([]);
    try {
      await guardarMenu(config);
      // Recarga para que el menú de la izquierda ya muestre los cambios
      window.location.reload();
    } catch (err) {
      setErrores(err.response?.data?.errores || []);
      setMensaje({ tipo: 'error', texto: err.response?.data?.error || 'No se pudo guardar el menú' });
      setGuardando(false);
    }
  };

  const handleRestaurar = async () => {
    if (!confirm('¿Volver el menú a como venía de fábrica? Se pierden tus cambios de nombres, orden y roles.')) return;
    setGuardando(true);
    try {
      await restaurarMenu();
      window.location.reload();
    } catch (err) {
      setMensaje({ tipo: 'error', texto: err.response?.data?.error || 'No se pudo restaurar' });
      setGuardando(false);
    }
  };

  if (!config) {
    return <div className="text-center py-12 text-gray-500">{mensaje ? mensaje.texto : 'Cargando...'}</div>;
  }

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-2xl font-bold">Editar menú del panel</h2>
          <p className="text-sm text-gray-500">
            Elegí qué opciones aparecen en el menú de la izquierda, en qué sección, en qué orden y qué rol las ve.
            Un rol solo puede ver una pantalla si el sistema se lo permite.
          </p>
        </div>
        <div className="flex gap-2">
          <button type="button" onClick={handleRestaurar} disabled={guardando}
            className="border border-gray-300 px-4 py-2 rounded text-sm hover:bg-gray-50 disabled:opacity-50">
            Restaurar de fábrica
          </button>
          <button type="button" onClick={handleGuardar} disabled={guardando}
            className="bg-blue-600 text-white px-4 py-2 rounded text-sm hover:bg-blue-700 disabled:bg-gray-400 flex items-center gap-2">
            {guardando && <Loader2 className="w-4 h-4 animate-spin" />}
            Guardar menú
          </button>
        </div>
      </div>

      {mensaje && (
        <div className="rounded-lg p-4 text-sm border bg-red-50 border-red-200 text-red-800">
          {mensaje.texto}
          {errores.length > 0 && (
            <ul className="list-disc ml-5 mt-2">{errores.map((er) => <li key={er}>{er}</li>)}</ul>
          )}
        </div>
      )}

      {config.secciones.map((s, idx) => {
        const items = config.items.filter((i) => i.seccion === s.id);
        const esNueva = s.id.startsWith('custom-');
        return (
          <section key={s.id} className={`bg-white shadow rounded-lg p-4 space-y-3 ${s.visible ? '' : 'opacity-60'}`}>
            <div className="flex items-center gap-2">
              <input type="text" value={s.etiqueta} aria-label="Nombre de la sección" maxLength={40}
                onChange={(e) => cambiarSeccion(s.id, { etiqueta: e.target.value })}
                className="flex-1 border rounded px-3 py-2 font-semibold" />
              <button type="button" aria-label="Subir sección" disabled={idx === 0}
                onClick={() => setConfig((c) => ({ ...c, secciones: mover(c.secciones, s.id, -1, () => true) }))}
                className="p-2 rounded border hover:bg-gray-50 disabled:opacity-30"><ArrowUp className="w-4 h-4" /></button>
              <button type="button" aria-label="Bajar sección" disabled={idx === config.secciones.length - 1}
                onClick={() => setConfig((c) => ({ ...c, secciones: mover(c.secciones, s.id, 1, () => true) }))}
                className="p-2 rounded border hover:bg-gray-50 disabled:opacity-30"><ArrowDown className="w-4 h-4" /></button>
              <button type="button" aria-label={s.visible ? 'Ocultar sección' : 'Mostrar sección'}
                onClick={() => cambiarSeccion(s.id, { visible: !s.visible })}
                className="p-2 rounded border hover:bg-gray-50">
                {s.visible ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
              </button>
              {esNueva && (
                <button type="button" aria-label="Borrar sección" disabled={items.length > 0}
                  title={items.length > 0 ? 'Mové las opciones a otra sección para poder borrarla' : 'Borrar sección'}
                  onClick={() => borrarSeccion(s.id)}
                  className="p-2 rounded border text-red-600 hover:bg-red-50 disabled:opacity-30"><Trash2 className="w-4 h-4" /></button>
              )}
            </div>

            {items.length === 0 && <p className="text-sm text-gray-400 px-1">Sin opciones. Mové alguna desde otra sección.</p>}

            {items.map((it) => {
              const cat = catalogo[it.id] || { rolesPermitidos: [], bloqueado: false };
              return (
                <div key={it.id} className={`border rounded p-3 flex flex-wrap items-center gap-3 ${it.visible ? '' : 'bg-gray-50 opacity-70'}`}>
                  <input type="text" value={it.etiqueta} aria-label="Nombre de la opción" maxLength={40}
                    onChange={(e) => cambiarItem(it.id, { etiqueta: e.target.value })}
                    className="border rounded px-2 py-1.5 text-sm w-56" />
                  <select value={it.seccion} aria-label="Sección" onChange={(e) => cambiarItem(it.id, { seccion: e.target.value })}
                    className="border rounded px-2 py-1.5 text-sm">
                    {config.secciones.map((sec) => <option key={sec.id} value={sec.id}>{sec.etiqueta}</option>)}
                  </select>
                  <div className="flex items-center gap-3 text-sm">
                    {cat.rolesPermitidos.map((rol) => (
                      <label key={rol} className="flex items-center gap-1">
                        <input type="checkbox" checked={it.roles.includes(rol)} disabled={cat.bloqueado}
                          onChange={() => alternarRol(it, rol)} />
                        {ROL_ETIQUETA[rol] || rol}
                      </label>
                    ))}
                  </div>
                  <div className="flex items-center gap-1 ml-auto">
                    <button type="button" aria-label="Subir opción"
                      onClick={() => setConfig((c) => ({ ...c, items: mover(c.items, it.id, -1, (a, b) => a.seccion === b.seccion) }))}
                      className="p-1.5 rounded border hover:bg-gray-50"><ArrowUp className="w-4 h-4" /></button>
                    <button type="button" aria-label="Bajar opción"
                      onClick={() => setConfig((c) => ({ ...c, items: mover(c.items, it.id, 1, (a, b) => a.seccion === b.seccion) }))}
                      className="p-1.5 rounded border hover:bg-gray-50"><ArrowDown className="w-4 h-4" /></button>
                    <button type="button" aria-label={it.visible ? 'Ocultar opción' : 'Mostrar opción'} disabled={cat.bloqueado}
                      title={cat.bloqueado ? 'Esta opción no se puede ocultar' : undefined}
                      onClick={() => cambiarItem(it.id, { visible: !it.visible })}
                      className="p-1.5 rounded border hover:bg-gray-50 disabled:opacity-30">
                      {it.visible ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
              );
            })}
          </section>
        );
      })}

      <button type="button" onClick={agregarSeccion}
        className="flex items-center gap-2 border border-dashed border-gray-400 px-4 py-2 rounded text-sm text-gray-600 hover:bg-gray-50">
        <Plus className="w-4 h-4" /> Agregar sección
      </button>
    </div>
  );
}
```

- [ ] **Step 2: Crear `nextjs/app/admin/configuracion/menu/page.js`**
```jsx
import MenuEditorPanel from '@/components/admin/MenuEditorPanel';

export default function Page() {
  return <MenuEditorPanel />;
}
```

- [ ] **Step 3: Verificadores y build**
```bash
node docs/superpowers/plans/verificar-menu.mjs 2>&1 | grep -E "✓|✗|  - "
node docs/superpowers/plans/verificar-menu-config.mjs 2>&1 | grep -E "✓|✗"
node docs/superpowers/plans/verificar-permisos.mjs 2>&1 | grep -E "✓|✗"
node docs/superpowers/plans/verificar-config.mjs 2>&1 | grep -E "✓|✗"
cd nextjs && npx next build 2>&1 | grep -E "Compiled|rror:|Failed|Type error|/admin/configuracion"; cd ..
```
Expected: los cuatro verificadores con `✓` (el de menú ahora `✓ Menú OK: 4 secciones, 10 pestañas, todas con su página`) y `✓ Compiled successfully` con las rutas `/admin/configuracion/sitio` y `/admin/configuracion/menu`.

- [ ] **Step 4: Commit**
```bash
git add nextjs/components/admin/MenuEditorPanel.jsx nextjs/app/admin/configuracion/menu
git commit -m "$(cat <<'EOF'
feat: Pantalla Editar menú del panel (renombrar, ordenar, ocultar, mover, secciones y roles)

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 12: Verificación final y entrega

**Files:** ninguno nuevo.

- [ ] **Step 1: Estado limpio, verificadores y build final**
```bash
git status --short
for v in verificar-menu verificar-config verificar-permisos verificar-menu-config; do node docs/superpowers/plans/$v.mjs 2>&1 | grep -E "✓|✗"; done
cd nextjs && npx next build 2>&1 | grep -E "Compiled|rror:|Failed|Type error"; cd ..
grep -rnE "5492995769999|299 576-9999|aluminehogar@gmail|info@aluminehogar" nextjs/components nextjs/app nextjs/lib --include=*.js --include=*.jsx | grep -v "site-defaults.js"
```
Expected: solo el PDF y `backups/` sin commitear; los cuatro verificadores con `✓`; `✓ Compiled successfully`; y el `grep` sin resultados (los valores de contacto solo viven en `site-defaults.js`).

- [ ] **Step 2: Lista de comprobación (la recorre el dueño después de deployar; con sesión de admin y con una cuenta de vendedor)**

Configuración del sitio:
- `Configuración → Configuración del sitio` carga con los datos de hoy. Cambiar el teléfono y guardar: el pie de página, el botón de WhatsApp y el chatbot muestran el cambio al recargar, sin deployar. Volver a poner el valor original.
- Probar datos inválidos (WhatsApp con `+`, email sin `@`, Instagram con `http://`): el formulario muestra el error y no guarda.
- Cargar el link de Instagram (con `https://`): aparece en el pie de página; vaciarlo: desaparece.

Menú:
- `Configuración → Editar menú del panel`: renombrar una opción, moverla de sección, ocultar otra, subir y bajar, agregar una sección y mover una opción adentro. Guardar: el menú de la izquierda se actualiza.
- No se puede ocultar "Editar menú del panel" ni "Configuración del sitio" ni sacarles el rol admin (los controles están bloqueados).
- "Restaurar de fábrica" devuelve el menú original.

Vendedor (cuenta con rol vendedor):
- Entra a `/admin` y ve solo **Créditos, Productos y Depósitos**. En Productos y Depósitos no hay botones de crear, editar, borrar, importar ni cambiar stock; en Créditos no hay aprobar/rechazar ni límites.
- Entrar por URL a `/admin/configuracion/usuarios` o `/admin/store/importar-pdf`: lo lleva a su primera pantalla. Los endpoints de esas pantallas le responden 403.
- Desde el editor (como admin) tildar "Vendedor" en Promociones: no aparece la casilla (el sistema no lo permite).

Regresión:
- El sitio público, el checkout y los emails siguen igual. El panel de admin sigue funcionando en todas sus pestañas (toggle Mostrar, Importar PDF, Buscar imagen, stock).

- [ ] **Step 3: Reportar.** Informar el resultado y que los commits están en `master` **sin push**; el push (que deploya a producción) lo decide el dueño.
