'use client';

import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { getPaymentSettings, actualizarPaymentSettings } from '@/services/api';

export default function MercadoPagoPanel() {
  const [cuotas, setCuotas] = useState(null);
  const [guardando, setGuardando] = useState(false);
  const [mensaje, setMensaje] = useState(null);

  useEffect(() => {
    getPaymentSettings()
      .then((data) => setCuotas(String(data.settings.maxCuotasMercadoPago)))
      .catch(() => setMensaje({ tipo: 'error', texto: 'No se pudo cargar la configuración' }));
  }, []);

  const handleGuardar = async (e) => {
    e.preventDefault();
    const n = Number(cuotas);
    if (!Number.isInteger(n) || n < 1 || n > 24) {
      setMensaje({ tipo: 'error', texto: 'Las cuotas máximas tienen que ser un número entero entre 1 y 24' });
      return;
    }
    setGuardando(true);
    setMensaje(null);
    try {
      await actualizarPaymentSettings({ maxCuotasMercadoPago: n });
      setMensaje({ tipo: 'ok', texto: 'Guardado. El checkout ya usa el nuevo máximo.' });
    } catch (err) {
      setMensaje({ tipo: 'error', texto: err.response?.data?.error || 'No se pudo guardar' });
    } finally {
      setGuardando(false);
    }
  };

  if (cuotas === null) {
    return <div className="text-center py-12 text-gray-500">{mensaje ? mensaje.texto : 'Cargando...'}</div>;
  }

  return (
    <form onSubmit={handleGuardar} className="space-y-6 max-w-xl">
      <div>
        <h2 className="text-2xl font-bold">Mercado Pago</h2>
        <p className="text-sm text-gray-500">Vale para las compras online del sitio. El crédito propio de los vendedores se configura en "Planes de crédito propio".</p>
      </div>
      <section className="bg-white shadow rounded-lg p-6 space-y-2">
        <label className="block text-sm font-medium" htmlFor="cuotas-mp">Máximo de cuotas en el checkout</label>
        <input id="cuotas-mp" type="number" min="1" max="24" value={cuotas} onChange={(e) => setCuotas(e.target.value)}
          className="border rounded px-3 py-2 w-32" />
      </section>
      {mensaje && (
        <div role={mensaje.tipo === 'ok' ? 'status' : 'alert'}
          className={`rounded-lg p-4 text-sm border ${mensaje.tipo === 'ok' ? 'bg-green-50 border-green-200 text-green-800' : 'bg-red-50 border-red-200 text-red-800'}`}>
          {mensaje.texto}
        </div>
      )}
      <button type="submit" disabled={guardando}
        className="bg-blue-600 text-white px-5 py-2 rounded text-sm hover:bg-blue-700 disabled:bg-gray-400 flex items-center gap-2">
        {guardando && <Loader2 className="w-4 h-4 animate-spin" />}
        {guardando ? 'Guardando...' : 'Guardar'}
      </button>
    </form>
  );
}
