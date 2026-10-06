// Única fuente del menú del panel admin.
// El proyecto B (menú editable) reemplaza el origen de SECCIONES e ITEMS por la base de datos sin tocar el marco.

export const RUTA_INICIAL = '/admin/store/productos';

export const SECCIONES = [
  { id: 'ventas', etiqueta: 'Gestión de Ventas', icono: 'ShoppingCart' },
  { id: 'store', etiqueta: 'Store', icono: 'Store' },
  { id: 'marketing', etiqueta: 'Marketing', icono: 'Megaphone' },
  { id: 'configuracion', etiqueta: 'Configuración', icono: 'Settings' },
];

export const ITEMS = [
  { id: 'creditos', seccion: 'ventas', etiqueta: 'Créditos', icono: 'CreditCard', ruta: '/admin/ventas/creditos', roles: ['admin', 'vendedor'] },
  { id: 'conversaciones', seccion: 'ventas', etiqueta: 'Conversaciones', icono: 'MessageSquare', ruta: '/admin/ventas/conversaciones', roles: ['admin'] },
  { id: 'productos', seccion: 'store', etiqueta: 'Productos', icono: 'Package', ruta: '/admin/store/productos', roles: ['admin', 'vendedor'] },
  { id: 'depositos', seccion: 'store', etiqueta: 'Depósitos', icono: 'Warehouse', ruta: '/admin/store/depositos', roles: ['admin', 'vendedor'] },
  { id: 'importar-pdf', seccion: 'store', etiqueta: 'Importar PDF', icono: 'FileUp', ruta: '/admin/store/importar-pdf', roles: ['admin'] },
  { id: 'promociones', seccion: 'marketing', etiqueta: 'Promociones', icono: 'Sparkles', ruta: '/admin/marketing/promociones', roles: ['admin'] },
  { id: 'medios-pago', seccion: 'marketing', etiqueta: 'Medios de pago', icono: 'Wallet', ruta: '/admin/marketing/medios-pago', roles: ['admin'] },
  { id: 'usuarios', seccion: 'configuracion', etiqueta: 'Usuarios', icono: 'Users', ruta: '/admin/configuracion/usuarios', roles: ['admin'] },
  { id: 'config-sitio', seccion: 'configuracion', etiqueta: 'Configuración del sitio', icono: 'Settings', ruta: '/admin/configuracion/sitio', roles: ['admin'] },
  { id: 'editar-menu', seccion: 'configuracion', etiqueta: 'Editar menú del panel', icono: 'Menu', ruta: '/admin/configuracion/menu', roles: ['admin'] },
];

// true solo para /admin y /admin/...; no para rutas que apenas empiezan igual (/administrador)
export function esRutaAdmin(pathname) {
  return typeof pathname === 'string' && (pathname === '/admin' || pathname.startsWith('/admin/'));
}

// Secciones con sus pestañas, solo las que el rol puede ver (las vacías se omiten)
export function seccionesVisibles(rol) {
  return SECCIONES
    .map((s) => ({ ...s, items: ITEMS.filter((i) => i.seccion === s.id && i.roles.includes(rol)) }))
    .filter((s) => s.items.length > 0);
}

// Id de la sección a la que pertenece la ruta, o null si la ruta no está en el menú
export function seccionDeRuta(pathname) {
  if (typeof pathname !== 'string') return null;
  const item = ITEMS.find((i) => pathname === i.ruta || pathname.startsWith(i.ruta + '/'));
  return item ? item.seccion : null;
}
