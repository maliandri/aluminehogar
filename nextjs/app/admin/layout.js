'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  Menu, LogOut, ExternalLink, Loader2,
  ShoppingCart, Store, Megaphone, Settings, Folder,
  CreditCard, MessageSquare, Package, Warehouse, FileUp, Sparkles, Wallet, Users,
} from 'lucide-react';
import { useAuthStore } from '@/store/authStore';
import { verificarAdmin, obtenerMenuPanel } from '@/services/api';
import { seccionDeRuta } from '@/lib/admin-menu';
import { resolverMenu } from '@/lib/menu-config';
import { AdminSessionProvider } from '@/components/admin/AdminSession';

// El menú guarda los íconos por nombre; acá se resuelven
const ICONOS = { ShoppingCart, Store, Megaphone, Settings, Folder, Menu, CreditCard, MessageSquare, Package, Warehouse, FileUp, Sparkles, Wallet, Users };

function Icono({ nombre, className }) {
  const Componente = ICONOS[nombre];
  return Componente ? <Componente className={className} /> : null;
}

const coincide = (pathname, ruta) => pathname === ruta || pathname.startsWith(ruta + '/');

export default function AdminLayout({ children }) {
  const pathname = usePathname();
  const router = useRouter();
  const logout = useAuthStore((s) => s.logout);
  const [usuario, setUsuario] = useState(null);
  const [menu, setMenu] = useState(null);
  const [menuAbierto, setMenuAbierto] = useState(false);

  // Verifica el rol contra el servidor. No se dibuja nada del panel hasta tener respuesta.
  useEffect(() => {
    let cancelado = false;
    verificarAdmin()
      .then((data) => { if (!cancelado) setUsuario(data.usuario); })
      .catch(() => { if (!cancelado) router.replace('/'); });
    return () => { cancelado = true; };
  }, [router]);

  // Con el usuario verificado, pide el menú ya filtrado por su rol. Si falla, usa el de fábrica del código.
  useEffect(() => {
    if (!usuario) return;
    let cancelado = false;
    obtenerMenuPanel()
      .then((data) => { if (!cancelado) setMenu(data.menu); })
      .catch(() => { if (!cancelado) setMenu(resolverMenu(null, usuario.role)); });
    return () => { cancelado = true; };
  }, [usuario]);

  // En celular el menú se cierra al navegar
  useEffect(() => { setMenuAbierto(false); }, [pathname]);

  // Una pantalla del catálogo que este rol no ve: se lo lleva a la primera que sí ve
  const esPantalla = seccionDeRuta(pathname) !== null;
  const permitida = !menu || !esPantalla || menu.some((s) => s.items.some((it) => coincide(pathname, it.ruta)));
  useEffect(() => {
    if (menu && esPantalla && !permitida && menu[0]) router.replace(menu[0].items[0].ruta);
  }, [menu, esPantalla, permitida, router]);

  if (!usuario || !menu || (esPantalla && !permitida && menu.length > 0)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 text-gray-500">
        <Loader2 className="w-6 h-6 animate-spin mr-2" /> Verificando acceso...
      </div>
    );
  }

  const idActiva = menu.find((s) => s.items.some((it) => coincide(pathname, it.ruta)))?.id;
  const activa = menu.find((s) => s.id === idActiva);

  const handleLogout = () => {
    logout();
    router.push('/');
  };

  const sidebar = (
    <nav aria-label="Menú del panel" className="flex flex-col h-full">
      <div className="px-5 py-5 border-b border-white/10">
        <div className="text-lg font-bold">Aluminé Hogar</div>
        <div className="text-xs text-white/60 uppercase tracking-wide">Sistema de gestión</div>
      </div>
      <ul className="flex-1 overflow-y-auto py-3">
        {menu.map((s) => (
          <li key={s.id}>
            <Link
              href={s.items[0].ruta}
              onClick={() => setMenuAbierto(false)}
              aria-current={s.id === idActiva ? 'page' : undefined}
              className={`flex items-center gap-3 mx-3 my-1 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                s.id === idActiva ? 'bg-blue-600 text-white' : 'text-white/80 hover:bg-white/10'
              }`}
            >
              <Icono nombre={s.icono} className="w-4 h-4" />
              {s.etiqueta}
            </Link>
          </li>
        ))}
      </ul>
      <div className="px-5 py-4 border-t border-white/10 text-sm">
        <div className="font-medium truncate">{usuario.email}</div>
        <div className="text-xs text-white/60 mb-3">{usuario.role === 'vendedor' ? 'Vendedor' : 'Administrador'}</div>
        <Link href="/" onClick={() => setMenuAbierto(false)} className="flex items-center gap-2 text-white/80 hover:text-white mb-2">
          <ExternalLink className="w-4 h-4" /> Ver tienda
        </Link>
        <button type="button" onClick={handleLogout} className="flex items-center gap-2 text-white/80 hover:text-white">
          <LogOut className="w-4 h-4" /> Cerrar sesión
        </button>
      </div>
    </nav>
  );

  return (
    <div className="min-h-screen bg-gray-50 md:flex">
      {/* Pantallas medianas y grandes: sidebar fijo a la izquierda */}
      <aside className="hidden md:block w-64 shrink-0 bg-slate-900 text-white sticky top-0 h-screen">
        {sidebar}
      </aside>

      {/* Celular: barra superior con botón que abre el menú */}
      <div className="md:hidden flex items-center justify-between bg-slate-900 text-white px-4 py-3">
        <span className="font-bold">Aluminé Hogar</span>
        <button type="button" aria-label="Abrir menú" onClick={() => setMenuAbierto(true)}>
          <Menu className="w-6 h-6" />
        </button>
      </div>
      {menuAbierto && (
        <div className="md:hidden fixed inset-0 z-50 flex">
          <div className="w-64 bg-slate-900 text-white">{sidebar}</div>
          <button type="button" aria-label="Cerrar menú" className="flex-1 bg-black/50" onClick={() => setMenuAbierto(false)} />
        </div>
      )}

      <div className="flex-1 min-w-0">
        {activa && (
          <nav aria-label="Pestañas de la sección" className="bg-white border-b px-6 flex gap-1 overflow-x-auto">
            {activa.items.map((it) => {
              const actual = coincide(pathname, it.ruta);
              return (
                <Link
                  key={it.id}
                  href={it.ruta}
                  aria-current={actual ? 'page' : undefined}
                  className={`flex items-center gap-2 px-4 py-3 text-sm font-medium whitespace-nowrap transition-colors ${
                    actual ? 'border-b-2 border-blue-600 text-blue-600' : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  <Icono nombre={it.icono} className="w-4 h-4" />
                  {it.etiqueta}
                </Link>
              );
            })}
          </nav>
        )}
        <div className="p-6">
          {menu.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              No tenés pantallas habilitadas en el panel. Pedile al administrador que te habilite alguna.
            </div>
          ) : (
            <AdminSessionProvider value={usuario}>{children}</AdminSessionProvider>
          )}
        </div>
      </div>
    </div>
  );
}
