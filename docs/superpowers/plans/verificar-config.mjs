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
const { mezclarConDefaults, validarSiteConfig, configPublica } = await lib('site-validate.js');
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

t('configPublica saca el email de avisos y conserva el resto', () => {
  const p = configPublica(SITE_DEFAULTS);
  assert.equal('emailNotificaciones' in p.tienda, false);
  for (const k of Object.keys(SITE_DEFAULTS.tienda)) if (k !== 'emailNotificaciones') assert.equal(p.tienda[k], SITE_DEFAULTS.tienda[k]);
  for (const g of ['redes', 'inicio', 'chatbot']) assert.deepEqual(p[g], SITE_DEFAULTS[g]);
});
t('configPublica no muta la entrada', () => {
  const c = structuredClone(SITE_DEFAULTS);
  configPublica(c);
  assert.equal(c.tienda.emailNotificaciones, SITE_DEFAULTS.tienda.emailNotificaciones);
  assert.notEqual(configPublica(c).tienda, c.tienda);
});

if (problemas.length) {
  console.error(`✗ ${problemas.length} problema(s):\n` + problemas.map((p) => '  - ' + p).join('\n'));
  process.exit(1);
}
console.log('✓ Configuración del sitio OK: validación, mezcla con defaults y formatos');
