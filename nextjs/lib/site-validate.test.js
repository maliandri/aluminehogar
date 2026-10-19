// Correr con: node --test lib/site-validate.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validarSiteConfig, mezclarConDefaults } from './site-validate.js';
import { SITE_DEFAULTS } from './site-defaults.js';

const base = () => structuredClone(SITE_DEFAULTS);
const slide = (extra = {}) => ({
  imagen: 'https://res.cloudinary.com/demo/image/upload/promo.jpg',
  titulo: 'Hot Sale',
  subtitulo: 'Hasta 30% off',
  botonTexto: 'Ver ofertas',
  botonEnlace: '/#productos',
  activo: true,
  ...extra,
});

test('sin slides guardados el inicio queda con lista vacía', () => {
  assert.deepEqual(mezclarConDefaults({}).inicio.slides, []);
  assert.deepEqual(validarSiteConfig(base()).valor.inicio.slides, []);
});

test('acepta un slide válido y conserva el orden', () => {
  const cfg = base();
  cfg.inicio.slides = [slide({ titulo: 'Primero' }), slide({ titulo: 'Segundo', activo: false })];
  const r = validarSiteConfig(cfg);
  assert.equal(r.ok, true, r.errores.join(', '));
  assert.deepEqual(r.valor.inicio.slides.map((s) => s.titulo), ['Primero', 'Segundo']);
  assert.equal(r.valor.inicio.slides[1].activo, false);
});

test('el slide necesita imagen https', () => {
  const cfg = base();
  cfg.inicio.slides = [slide({ imagen: 'http://sitio.com/a.jpg' })];
  assert.equal(validarSiteConfig(cfg).ok, false);
  cfg.inicio.slides = [slide({ imagen: '' })];
  assert.equal(validarSiteConfig(cfg).ok, false);
});

test('el enlace del botón puede ser interno (/) o https, pero no javascript:', () => {
  const cfg = base();
  cfg.inicio.slides = [slide({ botonEnlace: 'https://aluminehogar.com.ar/promo' })];
  assert.equal(validarSiteConfig(cfg).ok, true);
  cfg.inicio.slides = [slide({ botonEnlace: 'javascript:alert(1)' })];
  assert.equal(validarSiteConfig(cfg).ok, false);
});

test('máximo 10 slides y descarta campos desconocidos', () => {
  const cfg = base();
  cfg.inicio.slides = Array.from({ length: 11 }, () => slide());
  assert.equal(validarSiteConfig(cfg).ok, false);
  cfg.inicio.slides = [slide({ intruso: 'x' })];
  assert.equal('intruso' in validarSiteConfig(cfg).valor.inicio.slides[0], false);
});

test('mezclarConDefaults devuelve los slides guardados limpios', () => {
  const guardado = { inicio: { titulo: 'T', subtitulo: 'S', slides: [slide({ intruso: 'x' }), { basura: 1 }] } };
  const slides = mezclarConDefaults(guardado).inicio.slides;
  assert.equal(slides.length, 1);
  assert.equal('intruso' in slides[0], false);
});
