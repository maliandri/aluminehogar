'use client';

import { usePathname } from 'next/navigation';
import { esRutaAdmin } from '@/lib/admin-menu';

// Dibuja el contenido solo en el sitio público: el panel admin tiene su propio marco
export function PublicChrome({ children }) {
  const pathname = usePathname();
  if (esRutaAdmin(pathname)) return null;
  return <>{children}</>;
}
