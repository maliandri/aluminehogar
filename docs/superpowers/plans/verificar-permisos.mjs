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
t('ids heredados del prototipo no son pantallas', () => {
  assert.equal(puedeVer('admin', 'constructor'), false);
  assert.equal(puedeEditar('admin', '__proto__'), false);
  assert.equal(puedeVer('admin', 'toString'), false);
  assert.deepEqual(rolesQueVen('toString'), []);
});
t('cada pantalla del menú tiene permisos', () => {
  for (const i of ITEMS) assert.ok(PANTALLAS[i.id], `falta ${i.id} en PANTALLAS`);
});
t('los roles por defecto del menú están permitidos', () => {
  for (const i of ITEMS) for (const r of i.roles) assert.ok(rolesQueVen(i.id).includes(r), `${i.id}: ${r} no puede verla`);
});

t('clientes: admin y vendedor ven y editan', () => {
  for (const rol of ['admin', 'vendedor']) {
    assert.equal(puedeVer(rol, 'clientes'), true, rol);
    assert.equal(puedeEditar(rol, 'clientes'), true, rol);
  }
  assert.equal(puedeVer('customer', 'clientes'), false);
});
for (const id of ['planes-credito', 'mercado-pago']) {
  t(`${id}: solo admin`, () => {
    assert.equal(puedeVer('admin', id), true);
    assert.equal(puedeEditar('admin', id), true);
    assert.equal(puedeVer('vendedor', id), false);
    assert.equal(puedeEditar('vendedor', id), false);
  });
}

if (problemas.length) {
  console.error(`✗ ${problemas.length} problema(s):\n` + problemas.map((p) => '  - ' + p).join('\n'));
  process.exit(1);
}
console.log('✓ Permisos OK: matriz rol × pantalla coherente con el menú');
