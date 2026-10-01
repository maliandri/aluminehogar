'use client';

import { createContext, useContext } from 'react';
import { SITE_DEFAULTS } from '@/lib/site-defaults';

const SiteContext = createContext(SITE_DEFAULTS);

// El layout (servidor) lee la configuración y la reparte a los componentes cliente
export function SiteProvider({ value, children }) {
  return <SiteContext.Provider value={value}>{children}</SiteContext.Provider>;
}

export function useSite() {
  return useContext(SiteContext);
}
