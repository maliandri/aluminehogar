import { ITEMS, SECCIONES } from './admin-menu.js';
import { rolesQueVen, puedeVer } from './permisos.js';

// Estas opciones no se pueden ocultar ni sacarle el rol admin: así el dueño nunca se queda sin acceso a la configuración
export const ITEMS_BLOQUEADOS = ['config-sitio', 'editar-menu'];
export const ICONOS_SECCION = ['ShoppingCart', 'Store', 'Megaphone', 'Settings', 'Folder'];

const MAX_SECCIONES = 12;
const MAX_NOMBRE = 40;
const ID_SECCION = /^[a-z0-9-]{1,40}$/;

// El catálogo (ruta, ícono, permisos) sale siempre del código: lo guardado nunca puede apuntar a rutas inventadas
// Sin prototipo: ids como 'constructor' o '__proto__' no deben resolverse como pantallas
const catalogo = Object.assign(Object.create(null), Object.fromEntries(ITEMS.map((i) => [i.id, i])));

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
