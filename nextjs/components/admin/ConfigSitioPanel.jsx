'use client';

import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { obtenerSiteConfigAdmin, guardarSiteConfig } from '@/services/api';

// Grupos y campos del formulario (los mismos que valida el servidor)
const GRUPOS = [
  {
    id: 'tienda',
    titulo: 'Datos de la tienda',
    campos: [
      { id: 'nombre', etiqueta: 'Nombre comercial' },
      { id: 'telefono', etiqueta: 'Teléfono', ayuda: 'Como se muestra en el sitio. Ej: +54 9 299 576-9999' },
      { id: 'whatsapp', etiqueta: 'WhatsApp', ayuda: 'Solo números, con código de país y sin +. Ej: 5492995769999' },
      { id: 'emailContacto', etiqueta: 'Email de contacto', ayuda: 'Se muestra en el pie de página y en los emails' },
      { id: 'emailNotificaciones', etiqueta: 'Email para avisos', ayuda: 'Acá llegan los avisos de ventas y consultas del chatbot' },
      { id: 'emailInfo', etiqueta: 'Email de la sección "Contacto" del inicio', ayuda: 'Opcional. Si lo dejás vacío se usa el de contacto' },
      { id: 'direccion', etiqueta: 'Dirección', ayuda: 'Opcional' },
      { id: 'ciudad', etiqueta: 'Ciudad' },
    ],
  },
  {
    id: 'redes',
    titulo: 'Redes sociales',
    campos: [
      { id: 'instagram', etiqueta: 'Instagram', ayuda: 'Link completo con https://. Si lo dejás vacío no se muestra' },
      { id: 'facebook', etiqueta: 'Facebook', ayuda: 'Link completo con https://. Si lo dejás vacío no se muestra' },
    ],
  },
  {
    id: 'inicio',
    titulo: 'Textos de la página de inicio',
    campos: [
      { id: 'titulo', etiqueta: 'Título grande' },
      { id: 'subtitulo', etiqueta: 'Subtítulo' },
    ],
  },
  {
    id: 'chatbot',
    titulo: 'Lo que sabe decir el chatbot',
    campos: [
      { id: 'envio', etiqueta: 'Envíos' },
      { id: 'formasDePago', etiqueta: 'Formas de pago' },
      { id: 'politicas', etiqueta: 'Políticas (garantías, cambios)', ayuda: 'Una por línea', multilinea: true },
    ],
  },
];

export default function ConfigSitioPanel() {
  const [config, setConfig] = useState(null);
  const [guardando, setGuardando] = useState(false);
  const [mensaje, setMensaje] = useState(null);
  const [errores, setErrores] = useState([]);

  useEffect(() => {
    obtenerSiteConfigAdmin()
      .then((data) => setConfig(data.config))
      .catch(() => setMensaje({ tipo: 'error', texto: 'No se pudo cargar la configuración' }));
  }, []);

  const cambiar = (grupo, campo, valor) =>
    setConfig((prev) => ({ ...prev, [grupo]: { ...prev[grupo], [campo]: valor } }));

  const handleGuardar = async (e) => {
    e.preventDefault();
    setGuardando(true);
    setMensaje(null);
    setErrores([]);
    try {
      const data = await guardarSiteConfig(config);
      setConfig(data.config);
      setMensaje({ tipo: 'ok', texto: 'Guardado. El sitio ya muestra los cambios.' });
    } catch (err) {
      setErrores(err.response?.data?.errores || []);
      setMensaje({ tipo: 'error', texto: err.response?.data?.error || 'No se pudo guardar' });
    } finally {
      setGuardando(false);
    }
  };

  if (!config) {
    return <div className="text-center py-12 text-gray-500">{mensaje ? mensaje.texto : 'Cargando...'}</div>;
  }

  return (
    <form onSubmit={handleGuardar} className="space-y-6 max-w-3xl">
      <div>
        <h2 className="text-2xl font-bold">Configuración del sitio</h2>
        <p className="text-sm text-gray-500">Los cambios se ven en el sitio apenas guardás.</p>
      </div>

      {GRUPOS.map((g) => (
        <section key={g.id} className="bg-white shadow rounded-lg p-6 space-y-4">
          <h3 className="text-lg font-semibold">{g.titulo}</h3>
          {g.campos.map((c) => (
            <div key={c.id}>
              <label className="block text-sm font-medium mb-1" htmlFor={`${g.id}-${c.id}`}>{c.etiqueta}</label>
              {c.multilinea ? (
                <textarea id={`${g.id}-${c.id}`} rows={5} value={config[g.id][c.id]}
                  onChange={(e) => cambiar(g.id, c.id, e.target.value)}
                  className="w-full border rounded px-3 py-2 text-sm" />
              ) : (
                <input id={`${g.id}-${c.id}`} type="text" value={config[g.id][c.id]}
                  onChange={(e) => cambiar(g.id, c.id, e.target.value)}
                  className="w-full border rounded px-3 py-2 text-sm" />
              )}
              {c.ayuda && <p className="text-xs text-gray-500 mt-1">{c.ayuda}</p>}
            </div>
          ))}
        </section>
      ))}

      {mensaje && (
        <div role={mensaje.tipo === 'ok' ? 'status' : 'alert'} className={`rounded-lg p-4 text-sm border ${mensaje.tipo === 'ok' ? 'bg-green-50 border-green-200 text-green-800' : 'bg-red-50 border-red-200 text-red-800'}`}>
          {mensaje.texto}
          {errores.length > 0 && (
            <ul className="list-disc ml-5 mt-2">
              {errores.map((er) => <li key={er}>{er}</li>)}
            </ul>
          )}
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
