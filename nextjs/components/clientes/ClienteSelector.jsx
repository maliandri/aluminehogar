'use client';

import { useEffect, useState } from 'react';
import { Search, UserPlus, X } from 'lucide-react';
import { listarClientes } from '@/services/api';
import ClienteForm from '@/components/clientes/ClienteForm';

// Elige un cliente propio (buscador) o crea uno nuevo sin salir de la pantalla
export default function ClienteSelector({ value, onChange }) {
  const [q, setQ] = useState('');
  const [resultados, setResultados] = useState([]);
  const [creando, setCreando] = useState(false);

  useEffect(() => {
    if (value || creando) return undefined;
    const espera = setTimeout(() => {
      listarClientes(q).then((d) => setResultados((d.clientes || []).slice(0, 8))).catch(() => setResultados([]));
    }, 300);
    return () => clearTimeout(espera);
  }, [q, value, creando]);

  if (value) {
    return (
      <div className="flex items-start justify-between bg-gray-50 rounded-lg p-3">
        <div className="text-sm">
          <p className="font-semibold">{value.nombre}</p>
          <p className="text-gray-500">{value.tipoDocumento} {value.numeroDocumento} · {value.telefono}</p>
        </div>
        <button type="button" onClick={() => onChange(null)} aria-label="Cambiar cliente" className="p-1 text-gray-500 hover:text-gray-700"><X className="w-4 h-4" /></button>
      </div>
    );
  }

  if (creando) {
    return (
      <div className="bg-gray-50 rounded-lg p-4">
        <h4 className="font-semibold mb-3">Nuevo cliente</h4>
        <ClienteForm onGuardado={(c) => { onChange(c); setCreando(false); }} onCancelar={() => setCreando(false)} />
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="relative">
        <Search className="w-4 h-4 absolute left-3 top-3 text-gray-400" />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar cliente por nombre, documento o teléfono"
          className="input-field pl-9" />
      </div>
      {resultados.map((c) => (
        <button key={c._id} type="button" onClick={() => onChange(c)} className="w-full text-left bg-white border rounded-lg p-2 text-sm hover:bg-gray-50">
          <span className="font-medium">{c.nombre}</span>
          <span className="text-gray-500"> · {c.tipoDocumento} {c.numeroDocumento}</span>
        </button>
      ))}
      <button type="button" onClick={() => setCreando(true)} className="flex items-center gap-2 text-sm text-primary hover:underline">
        <UserPlus className="w-4 h-4" /> Cargar un cliente nuevo
      </button>
    </div>
  );
}
