// Autoridad de permisos del panel: qué rol puede VER y EDITAR cada pantalla.
// El menú (lib/menu-config.js) solo decide qué se muestra y nunca puede dar más permisos que esta tabla.
// Los ids son los de lib/admin-menu.js.
export const PANTALLAS = {
  productos: { ver: ['admin', 'vendedor'], editar: ['admin'] },
  depositos: { ver: ['admin', 'vendedor'], editar: ['admin'] },
  creditos: { ver: ['admin', 'vendedor'], editar: ['admin'] },
  clientes: { ver: ['admin', 'vendedor'], editar: ['admin', 'vendedor'] },
  'planes-credito': { ver: ['admin'], editar: ['admin'] },
  'mercado-pago': { ver: ['admin'], editar: ['admin'] },
  conversaciones: { ver: ['admin'], editar: ['admin'] },
  'importar-pdf': { ver: ['admin'], editar: ['admin'] },
  promociones: { ver: ['admin'], editar: ['admin'] },
  'medios-pago': { ver: ['admin'], editar: ['admin'] },
  usuarios: { ver: ['admin'], editar: ['admin'] },
  'config-sitio': { ver: ['admin'], editar: ['admin'] },
  'editar-menu': { ver: ['admin'], editar: ['admin'] },
};

export function puedeVer(rol, pantalla) {
  return Object.hasOwn(PANTALLAS, pantalla) && PANTALLAS[pantalla].ver.includes(rol);
}

export function puedeEditar(rol, pantalla) {
  return Object.hasOwn(PANTALLAS, pantalla) && PANTALLAS[pantalla].editar.includes(rol);
}

export function rolesQueVen(pantalla) {
  return Object.hasOwn(PANTALLAS, pantalla) ? [...PANTALLAS[pantalla].ver] : [];
}
