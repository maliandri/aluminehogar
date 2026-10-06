'use client';

import { createContext, useContext } from 'react';

const AdminSessionContext = createContext(null);

// El marco entrega acá el usuario verificado por el servidor ({ id, email, role })
export const AdminSessionProvider = AdminSessionContext.Provider;

// Sin proveedor devuelve rol "customer" (sin permisos): ante la duda, no se muestra nada de edición
export function useAdminSession() {
  return useContext(AdminSessionContext) || { role: 'customer' };
}
