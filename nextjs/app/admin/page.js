import { redirect } from 'next/navigation';
import { RUTA_INICIAL } from '@/lib/admin-menu';

// El panel vivía todo acá; ahora cada pestaña tiene su URL. Los links viejos a /admin caen en Productos.
export default function AdminIndex() {
  redirect(RUTA_INICIAL);
}
