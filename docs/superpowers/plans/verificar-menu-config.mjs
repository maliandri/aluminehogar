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
t('vendedor ve solo clientes, créditos, productos y depósitos', () => assert.deepEqual(ids(menuDeFabrica(), 'vendedor').sort(), ['clientes', 'creditos', 'depositos', 'productos']));
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

for (const id of ['constructor', '__proto__', 'toString']) {
  t(`validar rechaza el id heredado ${id}`, () => {
    const m = clon(); m.items.push({ id, seccion: 'store', etiqueta: 'x', visible: false, roles: [] });
    assert.equal(validarMenu(m).ok, false);
  });
  t(`normalizar descarta el id heredado ${id}`, () => {
    const m = clon(); m.items.push({ id, seccion: 'store', etiqueta: 'x', visible: false, roles: [] });
    assert.equal(normalizarMenu(m).items.some((i) => i.id === id), false);
  });
}

if (problemas.length) {
  console.error(`✗ ${problemas.length} problema(s):\n` + problemas.map((p) => '  - ' + p).join('\n'));
  process.exit(1);
}
console.log('✓ Menú editable OK: normalizar, validar, candados y resolver por rol');
