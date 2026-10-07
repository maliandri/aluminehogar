'use client';

import { useEffect, useRef, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { archivoADataUrl } from '@/lib/leer-archivo';

// Pide cómo se cobró un pago: comprobante (foto o PDF) o "ya lo cobré, lo tengo en mano"
export default function CobroDialog({ titulo, onConfirmar, onCancelar }) {
  const [metodo, setMetodo] = useState('comprobante');
  const [archivo, setArchivo] = useState(null);
  const [procesando, setProcesando] = useState(false);
  const [error, setError] = useState(null);
  const input = useRef(null);

  useEffect(() => {
    const alTeclear = (e) => { if (e.key === 'Escape' && !procesando) onCancelar(); };
    document.addEventListener('keydown', alTeclear);
    return () => document.removeEventListener('keydown', alTeclear);
  }, [procesando, onCancelar]);

  const confirmar = async () => {
    setError(null);
    setProcesando(true);
    try {
      let dataUrl;
      if (metodo === 'comprobante') {
        if (!archivo) throw new Error('Elegí la foto o el PDF del comprobante');
        dataUrl = await archivoADataUrl(archivo);
      }
      await onConfirmar(metodo, dataUrl);
    } catch (err) {
      setError(err.response?.data?.error || err.message || 'No se pudo registrar el cobro');
      setProcesando(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[70] bg-black/50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md p-5 space-y-4" role="dialog" aria-modal="true" aria-label={titulo}>
        <h3 className="text-lg font-semibold">{titulo}</h3>

        <label className="flex items-start gap-2 text-sm">
          <input type="radio" name="metodo-cobro" checked={metodo === 'comprobante'} onChange={() => setMetodo('comprobante')} className="mt-1" />
          <span>Subir comprobante (transferencia o depósito)</span>
        </label>
        {metodo === 'comprobante' && (
          <div className="ml-6">
            <input ref={input} type="file" aria-label="Archivo del comprobante" accept="image/jpeg,image/png,image/webp,application/pdf" onChange={(e) => setArchivo(e.target.files?.[0] || null)} className="text-sm" />
          </div>
        )}
        <label className="flex items-start gap-2 text-sm">
          <input type="radio" name="metodo-cobro" checked={metodo === 'efectivo'} onChange={() => setMetodo('efectivo')} className="mt-1" />
          <span>Ya lo cobré y lo tengo en mano</span>
        </label>

        {error && <div role="alert" className="bg-red-50 text-red-700 text-sm rounded-lg p-3">{error}</div>}

        <div className="flex justify-end gap-2">
          <button type="button" onClick={onCancelar} disabled={procesando} className="px-4 py-2 text-sm border rounded hover:bg-gray-50">Cancelar</button>
          <button type="button" onClick={confirmar} disabled={procesando} className="px-4 py-2 text-sm bg-primary text-white rounded flex items-center gap-2 disabled:opacity-50">
            {procesando && <Loader2 className="w-4 h-4 animate-spin" />}
            Registrar cobro
          </button>
        </div>
      </div>
    </div>
  );
}
