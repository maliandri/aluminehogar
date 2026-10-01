#!/usr/bin/env node
/**
 * Crea nextjs/components/admin/ProductosPanel.jsx a partir del bloque Productos de AdminPanel (page.js),
 * quitando lo que pasa al marco nuevo: pestañas, título, guardia de acceso y los demás paneles.
 * NO modifica page.js (sigue funcionando hasta que el marco nuevo lo reemplace).
 * Falla con un mensaje claro si algún pedazo esperado no está exactamente una vez.
 *
 * Uso (desde la raíz del repo): node docs/superpowers/plans/crear-productos-panel.cjs
 * Variables opcionales: ADMIN_PAGE, ADMIN_OUT.
 */
const fs = require('fs');
const path = require('path');

const PAGE = process.env.ADMIN_PAGE || 'nextjs/app/admin/page.js';
const OUT = process.env.ADMIN_OUT || 'nextjs/components/admin';

const raw = fs.readFileSync(PAGE, 'utf8');
const eol = raw.includes('\r\n') ? '\r\n' : '\n';
const src = raw.replace(/\r\n/g, '\n');

// --- bloque AdminPanel ---
const start = src.indexOf('export default function AdminPanel() {');
if (start < 0) throw new Error('No encontré AdminPanel en page.js');
const after = src.slice(start);
const nextTop = after.slice(1).search(/\n(function|const) \w+/);
let fn = nextTop < 0 ? after : after.slice(0, nextTop + 1);
fn = fn.replace(/\n+$/, '\n');

const once = (text, label) => {
  const n = fn.split(text).length - 1;
  if (n !== 1) throw new Error(`"${label}" aparece ${n} veces (se esperaba 1): page.js cambió de forma`);
};
const swap = (from, to, label) => {
  once(from, label);
  fn = fn.replace(from, () => to);
};

swap(
  "export default function AdminPanel() {\n  const { user, isAdmin } = useAuthStore();\n  const router = useRouter();\n\n  const [activeTab, setActiveTab] = useState('productos');\n",
  'export default function ProductosPanel() {\n',
  'cabecera de AdminPanel'
);
swap("  const [hydrated, setHydrated] = useState(false);\n", '', 'estado hydrated');

const effStart = fn.indexOf('  useEffect(() => {\n    const unsub = useAuthStore.persist.onFinishHydration');
const guardEnd = '    fetchProductos();\n  }, [hydrated]);\n';
const effEnd = fn.indexOf(guardEnd);
if (effStart < 0 || effEnd < 0) throw new Error('No encontré los efectos de hidratación/guardia');
fn = fn.slice(0, effStart) + '  useEffect(() => {\n    fetchProductos();\n  }, []);\n' + fn.slice(effEnd + guardEnd.length);

swap(
  'return <div className="container mx-auto p-8">Cargando...</div>;',
  'return <div className="text-center py-12 text-gray-500">Cargando...</div>;',
  'pantalla de carga'
);

// cuerpo: entre la apertura de la pestaña Productos y su cierre
const openMark = "      {/* Tab: Productos */}\n      {activeTab === 'productos' && (\n        <>\n";
const closeMark = '        </>\n      )}\n\n      {/* Tab: Conversaciones */}';
once(openMark, 'apertura pestaña Productos');
once(closeMark, 'cierre pestaña Productos');
const retStart = fn.indexOf('  return (\n    <div className="container mx-auto p-8">');
if (retStart < 0) throw new Error('No encontré el return principal');
const bodyStart = fn.indexOf(openMark) + openMark.length;
const bodyEnd = fn.indexOf(closeMark);
const dedented = fn
  .slice(bodyStart, bodyEnd)
  .split('\n')
  .map((l) => (l.startsWith('    ') ? l.slice(4) : l))
  .join('\n');
fn = fn.slice(0, retStart) + '  return (\n    <>\n' + dedented + '    </>\n  );\n}\n';

// --- imports (se deducen de lo que el archivo nuevo usa) ---
const headText = src.slice(0, src.indexOf('export default function AdminPanel'));
const grab = (from) => {
  const m = headText.match(new RegExp(`import \\{([^}]*)\\} from '${from.replace(/[/]/g, '\\/')}'`));
  return m ? m[1].split(',').map((x) => x.trim()).filter(Boolean) : [];
};
const uses = (x) => new RegExp(`\\b${x}\\b`).test(fn);
const imports = [];
const react = grab('react').filter(uses);
if (react.length) imports.push(`import { ${react.join(', ')} } from 'react';`);
const lucide = grab('lucide-react').filter(uses);
if (lucide.length) imports.push(`import { ${lucide.join(', ')} } from 'lucide-react';`);
if (uses('xlsxClient')) imports.push("import * as xlsxClient from 'xlsx';");
const api = grab('@/services/api').filter(uses);
if (api.length) imports.push(`import {\n${api.map((a) => `  ${a},`).join('\n')}\n} from '@/services/api';`);
imports.push("import ProductForm from './ProductForm';");

for (const leftover of ['activeTab', 'useAuthStore', 'useRouter', 'isAdmin', 'hydrated', 'user?.id']) {
  if (new RegExp(`\\b${leftover.replace('?', '\\?')}`).test(fn)) throw new Error(`Quedó una referencia a "${leftover}" en el panel nuevo`);
}

const outFile = path.join(OUT, 'ProductosPanel.jsx');
if (fs.existsSync(outFile)) throw new Error(`${outFile} ya existe; no lo piso`);
fs.mkdirSync(OUT, { recursive: true });
fs.writeFileSync(outFile, `'use client';\n\n${imports.join('\n')}\n\n${fn}`.replace(/\n/g, eol));
console.log(`OK  ${outFile}  (${fn.split('\n').length} líneas)`);
