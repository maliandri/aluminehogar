#!/usr/bin/env node
/**
 * Verifica el menú del panel admin (nextjs/lib/admin-menu.js) y que cada pestaña tenga su página.
 * Uso (desde la raíz del repo): node docs/superpowers/plans/verificar-menu.mjs [raiz]
 * Sale con código 1 y lista los problemas si algo no cuadra.
 */
import fs from 'fs';
import path from 'path';
import { pathToFileURL } from 'url';

const raiz = path.resolve(process.argv[2] || process.cwd());
const menu = await import(pathToFileURL(path.join(raiz, 'nextjs/lib/admin-menu.js')).href);
const { SECCIONES, ITEMS, esRutaAdmin, seccionDeRuta, seccionesVisibles, RUTA_INICIAL } = menu;

const problemas = [];
const chequear = (cond, msg) => { if (!cond) problemas.push(msg); };

// --- estructura del menú ---
const idsSec = SECCIONES.map((s) => s.id);
chequear(new Set(idsSec).size === idsSec.length, 'ids de sección repetidos');
chequear(new Set(ITEMS.map((i) => i.id)).size === ITEMS.length, 'ids de ítem repetidos');
chequear(new Set(ITEMS.map((i) => i.ruta)).size === ITEMS.length, 'rutas de ítem repetidas');
for (const i of ITEMS) {
  chequear(idsSec.includes(i.seccion), `${i.id}: sección inexistente "${i.seccion}"`);
  chequear(i.ruta?.startsWith('/admin/'), `${i.id}: la ruta debe empezar con /admin/`);
  chequear(Array.isArray(i.roles) && i.roles.length > 0, `${i.id}: roles vacío`);
  chequear(typeof i.icono === 'string' && i.icono && typeof i.etiqueta === 'string' && i.etiqueta, `${i.id}: falta icono o etiqueta`);
}
chequear(ITEMS.some((i) => i.ruta === RUTA_INICIAL), 'RUTA_INICIAL no está en el menú');

// --- cada pestaña tiene su página ---
for (const i of ITEMS) {
  const archivo = path.join(raiz, 'nextjs/app', i.ruta, 'page.js');
  chequear(fs.existsSync(archivo), `falta la página de "${i.etiqueta}": nextjs/app${i.ruta}/page.js`);
}

// --- funciones puras ---
chequear(esRutaAdmin('/admin') === true, "esRutaAdmin('/admin') debe ser true");
chequear(esRutaAdmin('/admin/store/productos') === true, "esRutaAdmin('/admin/store/productos') debe ser true");
chequear(esRutaAdmin('/administrador') === false, "esRutaAdmin('/administrador') debe ser false");
chequear(esRutaAdmin('/producto/admin') === false, "esRutaAdmin('/producto/admin') debe ser false");
chequear(esRutaAdmin(undefined) === false, 'esRutaAdmin(undefined) debe ser false');
chequear(seccionDeRuta('/admin/store/productos') === 'store', "seccionDeRuta('/admin/store/productos') debe ser 'store'");
chequear(seccionDeRuta('/admin/store/productos/') === 'store', 'seccionDeRuta con barra final debe ser store');
chequear(seccionDeRuta('/admin/inexistente') === null, "seccionDeRuta('/admin/inexistente') debe ser null");
chequear(seccionDeRuta(undefined) === null, 'seccionDeRuta(undefined) debe ser null');
chequear(seccionesVisibles('customer').length === 0, 'un rol sin permisos no debe ver ninguna sección');
chequear(seccionesVisibles('admin').length === SECCIONES.length, 'admin debe ver todas las secciones');

if (problemas.length) {
  console.error(`✗ ${problemas.length} problema(s):\n` + problemas.map((p) => '  - ' + p).join('\n'));
  process.exit(1);
}
console.log(`✓ Menú OK: ${SECCIONES.length} secciones, ${ITEMS.length} pestañas, todas con su página`);
