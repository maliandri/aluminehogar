#!/usr/bin/env node
/**
 * Mueve uno o más bloques de nivel superior de nextjs/app/admin/page.js a un archivo nuevo
 * en nextjs/components/admin/, sin cambiar su código. Deduce solo los imports que cada archivo necesita
 * y agrega el import correspondiente en page.js. Respeta el fin de línea (CRLF/LF) de page.js.
 *
 * Uso (desde la raíz del repo):
 *   node docs/superpowers/plans/extraer-panel.cjs <Archivo> <Principal> <Simbolo1,Simbolo2,...>
 *
 *   <Archivo>    nombre del archivo nuevo sin extensión (ej. DepositosPanel -> components/admin/DepositosPanel.jsx)
 *   <Principal>  símbolo que se exporta por defecto (ej. DepositosPanel)
 *   <Simbolos>   funciones/constantes de nivel superior que se mueven juntas (incluye la Principal)
 *
 * Variables opcionales: ADMIN_PAGE (ruta de page.js), ADMIN_OUT (carpeta de salida).
 */
const fs = require('fs');
const path = require('path');

const PAGE = process.env.ADMIN_PAGE || 'nextjs/app/admin/page.js';
const OUT = process.env.ADMIN_OUT || 'nextjs/components/admin';
const [fileName, main, symbolList] = process.argv.slice(2);
if (!fileName || !main || !symbolList) {
  console.error('Uso: node extraer-panel.cjs <Archivo> <Principal> <Simbolo1,Simbolo2,...>');
  process.exit(1);
}
const symbols = symbolList.split(',').map((s) => s.trim()).filter(Boolean);
if (!symbols.includes(main)) throw new Error(`La principal (${main}) debe estar en la lista de símbolos`);

const raw = fs.readFileSync(PAGE, 'utf8');
const eol = raw.includes('\r\n') ? '\r\n' : '\n';
const lines = raw.replace(/\r\n/g, '\n').split('\n');

// --- 1. Bloques de nivel superior (cada uno incluye los comentarios "//" que lo preceden) ---
const topRe = /^(export default function|function|const) (\w+)/;
const tops = [];
lines.forEach((l, i) => {
  const m = l.match(topRe);
  if (m) tops.push({ name: m[2], line: i });
});
tops.forEach((t, k) => {
  let start = t.line;
  while (start > 0 && /^\s*\/\//.test(lines[start - 1])) start--;
  t.start = start;
});
tops.forEach((t, k) => {
  const next = tops[k + 1];
  let end = next ? next.start : lines.length;
  while (end > t.start && lines[end - 1].trim() === '') end--;
  t.end = end; // exclusivo
});

const blocks = symbols.map((name) => {
  const t = tops.find((x) => x.name === name);
  if (!t) throw new Error(`No encontré el símbolo de nivel superior "${name}" en ${PAGE}`);
  return t;
});
blocks.sort((a, b) => a.start - b.start);

let body = blocks.map((b) => lines.slice(b.start, b.end).join('\n')).join('\n\n');
body = body.replace(new RegExp(`^function ${main}\\b`, 'm'), `export default function ${main}`);

// --- 2. Imports que el archivo nuevo necesita (leídos de los imports de page.js) ---
const headEnd = lines.findIndex((l) => /^export default function AdminPanel/.test(l));
const headText = lines.slice(0, headEnd === -1 ? lines.length : headEnd).join('\n');
const grab = (from) => {
  const m = headText.match(new RegExp(`import \\{([^}]*)\\} from '${from.replace(/[/]/g, '\\/')}'`));
  return m ? m[1].split(',').map((x) => x.trim()).filter(Boolean) : [];
};
const uses = (x) => new RegExp(`\\b${x}\\b`).test(body);

const imports = [];
const react = grab('react').filter(uses);
if (react.length) imports.push(`import { ${react.join(', ')} } from 'react';`);
if (uses('useAuthStore')) imports.push("import { useAuthStore } from '@/store/authStore';");
if (uses('useRouter')) imports.push("import { useRouter } from 'next/navigation';");
const lucide = grab('lucide-react').filter(uses);
if (lucide.length) imports.push(`import { ${lucide.join(', ')} } from 'lucide-react';`);
if (uses('xlsxClient')) imports.push("import * as xlsxClient from 'xlsx';");
const api = grab('@/services/api').filter(uses);
if (api.length) imports.push(`import {\n${api.map((a) => `  ${a},`).join('\n')}\n} from '@/services/api';`);

// Componentes/constantes compartidas que quedaron en otros archivos ya extraídos
const extra = (process.env.ADMIN_EXTRA_IMPORTS || '').split(';;').map((s) => s.trim()).filter(Boolean);
imports.push(...extra);

const outFile = path.join(OUT, `${fileName}.jsx`);
if (fs.existsSync(outFile)) throw new Error(`${outFile} ya existe; no lo piso`);
fs.mkdirSync(OUT, { recursive: true });
fs.writeFileSync(outFile, `'use client';\n\n${imports.join('\n')}\n\n${body}\n`.replace(/\n/g, eol));

// --- 3. Sacar los bloques de page.js y agregar el import ---
const remove = new Set();
blocks.forEach((b) => { for (let i = b.start; i < b.end; i++) remove.add(i); });
let kept = lines.filter((_, i) => !remove.has(i));
// compactar líneas en blanco consecutivas que dejó el recorte
kept = kept.filter((l, i) => !(l.trim() === '' && i > 0 && kept[i - 1].trim() === ''));

const importLine = `import ${main} from '@/components/admin/${fileName}';`;
let lastImport = -1;
kept.forEach((l, i) => { if (i < kept.findIndex((x) => /^export default function AdminPanel/.test(x)) && /^(import |\} from )/.test(l)) lastImport = i; });
kept.splice(lastImport + 1, 0, importLine);
fs.writeFileSync(PAGE, kept.join('\n').replace(/\n/g, eol));

console.log(`OK  ${outFile}  (${blocks.map((b) => b.name).join(', ')}; ${body.split('\n').length} líneas)`);
console.log(`    imports: react[${react}] lucide[${lucide.length}] api[${api.length}]`);
