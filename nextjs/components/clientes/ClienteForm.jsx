'use client';

import { useRef, useState } from 'react';
import { Loader2, Upload, Eye } from 'lucide-react';
import { crearCliente, actualizarCliente, subirArchivoCliente, obtenerArchivoCliente } from '@/services/api';
import { FRASE_SIN_EMAIL, PROVINCIAS, TIPOS_DOCUMENTO, TIPOS_ARCHIVO } from '@/lib/cliente-validate';
import { archivoADataUrl } from '@/lib/leer-archivo';
import { abrirBlobEnPestana } from '@/lib/abrir-archivo';

const VACIO = {
  nombre: '', tipoDocumento: 'DNI', numeroDocumento: '', telefono: '', email: '',
  domicilio: { calle: '', numero: '', localidad: '', provincia: PROVINCIAS[0] },
};

function Campo({ etiqueta, children, ayuda }) {
  return (
    <label className="block text-sm">
      <span className="block font-medium mb-1">{etiqueta}</span>
      {children}
      {ayuda && <span className="block text-xs text-gray-500 mt-1">{ayuda}</span>}
    </label>
  );
}

export default function ClienteForm({ cliente, onGuardado, onCancelar }) {
  const [datos, setDatos] = useState(() => (cliente ? {
    nombre: cliente.nombre, tipoDocumento: cliente.tipoDocumento, numeroDocumento: cliente.numeroDocumento,
    telefono: cliente.telefono, email: cliente.email, domicilio: { ...cliente.domicilio },
  } : VACIO));
  const [actual, setActual] = useState(cliente || null);
  const [guardando, setGuardando] = useState(false);
  const [subiendo, setSubiendo] = useState(null);
  const [error, setError] = useState(null);
  const [errores, setErrores] = useState([]);
  const inputArchivo = useRef(null);
  const tipoPendiente = useRef(null);

  const cambiar = (campo, valor) => setDatos((d) => ({ ...d, [campo]: valor }));
  const cambiarDom = (campo, valor) => setDatos((d) => ({ ...d, domicilio: { ...d.domicilio, [campo]: valor } }));

  const handleGuardar = async (e) => {
    e.preventDefault();
    setGuardando(true);
    setError(null);
    setErrores([]);
    try {
      const data = actual ? await actualizarCliente(actual._id, datos) : await crearCliente(datos);
      setActual(data.cliente);
      onGuardado?.(data.cliente);
    } catch (err) {
      setErrores(err.response?.data?.errores || []);
      setError(err.response?.data?.error || 'No se pudo guardar el cliente');
    } finally {
      setGuardando(false);
    }
  };

  const elegirArchivo = (tipo) => {
    tipoPendiente.current = tipo;
    inputArchivo.current?.click();
  };

  const handleArchivo = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    const tipo = tipoPendiente.current;
    if (!file || !tipo || !actual) return;
    setSubiendo(tipo);
    setError(null);
    try {
      const dataUrl = await archivoADataUrl(file);
      const data = await subirArchivoCliente(actual._id, tipo, dataUrl);
      setActual(data.cliente);
      onGuardado?.(data.cliente);
    } catch (err) {
      setError(err.response?.data?.error || err.message || 'No se pudo subir el archivo');
    } finally {
      setSubiendo(null);
    }
  };

  const tiene = (tipo) => actual?.archivos?.some((a) => a.tipo === tipo);

  return (
    <form onSubmit={handleGuardar} className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Campo etiqueta="Nombre y apellido *">
          <input className="w-full border rounded px-3 py-2" value={datos.nombre} onChange={(e) => cambiar('nombre', e.target.value)} />
        </Campo>
        <div className="grid grid-cols-3 gap-2">
          <Campo etiqueta="Documento *">
            <select className="w-full border rounded px-2 py-2" value={datos.tipoDocumento} disabled={Boolean(actual)}
              onChange={(e) => cambiar('tipoDocumento', e.target.value)}>
              {TIPOS_DOCUMENTO.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </Campo>
          <div className="col-span-2">
            <Campo etiqueta="Número *">
              <input className="w-full border rounded px-3 py-2" value={datos.numeroDocumento} disabled={Boolean(actual)}
                onChange={(e) => cambiar('numeroDocumento', e.target.value)} />
            </Campo>
          </div>
        </div>
        <Campo etiqueta="Teléfono *">
          <input type="tel" className="w-full border rounded px-3 py-2" value={datos.telefono} onChange={(e) => cambiar('telefono', e.target.value)} />
        </Campo>
        <Campo etiqueta="Email *" ayuda={`Si el cliente no tiene, escribí exactamente: ${FRASE_SIN_EMAIL}`}>
          <input className="w-full border rounded px-3 py-2" value={datos.email} onChange={(e) => cambiar('email', e.target.value)} autoComplete="off" />
        </Campo>
        <Campo etiqueta="Calle *">
          <input className="w-full border rounded px-3 py-2" value={datos.domicilio.calle} onChange={(e) => cambiarDom('calle', e.target.value)} />
        </Campo>
        <Campo etiqueta="Número *">
          <input className="w-full border rounded px-3 py-2" value={datos.domicilio.numero} onChange={(e) => cambiarDom('numero', e.target.value)} />
        </Campo>
        <Campo etiqueta="Localidad *">
          <input className="w-full border rounded px-3 py-2" value={datos.domicilio.localidad} onChange={(e) => cambiarDom('localidad', e.target.value)} />
        </Campo>
        <Campo etiqueta="Provincia *">
          <select className="w-full border rounded px-3 py-2" value={datos.domicilio.provincia} onChange={(e) => cambiarDom('provincia', e.target.value)}>
            {PROVINCIAS.map((p) => <option key={p} value={p}>{p}</option>)}
          </select>
        </Campo>
      </div>

      {error && (
        <div role="alert" className="rounded-lg p-3 text-sm border bg-red-50 border-red-200 text-red-800">
          {error}
          {errores.length > 0 && <ul className="list-disc ml-5 mt-1">{errores.map((er) => <li key={er}>{er}</li>)}</ul>}
        </div>
      )}

      <div className="flex gap-2">
        <button type="submit" disabled={guardando} className="bg-blue-600 text-white px-4 py-2 rounded text-sm hover:bg-blue-700 disabled:bg-gray-400 flex items-center gap-2">
          {guardando && <Loader2 className="w-4 h-4 animate-spin" />}
          {actual ? 'Guardar cambios' : 'Guardar cliente'}
        </button>
        {onCancelar && <button type="button" onClick={onCancelar} className="border px-4 py-2 rounded text-sm hover:bg-gray-50">Cerrar</button>}
      </div>

      <div className="border-t pt-4">
        <h4 className="font-semibold text-sm mb-2">Documentación</h4>
        {!actual ? (
          <p className="text-sm text-gray-500">Primero guardá el cliente; después vas a poder subir el DNI, el recibo y un servicio.</p>
        ) : (
          <>
            <p className="text-xs text-gray-500 mb-2">Los archivos son privados: solo los ven el administrador y quien cargó al cliente. JPG, PNG, WebP o PDF.</p>
            <input ref={inputArchivo} type="file" accept="image/jpeg,image/png,image/webp,application/pdf" className="hidden" onChange={handleArchivo} />
            <ul className="space-y-2">
              {Object.entries(TIPOS_ARCHIVO).map(([tipo, etiqueta]) => (
                <li key={tipo} className="flex items-center gap-3 text-sm">
                  <span className="w-56">{etiqueta}</span>
                  <span className={tiene(tipo) ? 'text-green-700' : 'text-gray-400'}>{tiene(tipo) ? 'Cargado' : 'Falta'}</span>
                  {tiene(tipo) && (
                    <button type="button" aria-label={`Ver ${etiqueta}`} onClick={() => abrirBlobEnPestana(obtenerArchivoCliente(actual._id, tipo)).catch(() => setError('No se pudo abrir el archivo'))}
                      className="flex items-center gap-1 text-blue-600 hover:underline"><Eye className="w-4 h-4" /> Ver</button>
                  )}
                  <button type="button" aria-label={`${tiene(tipo) ? 'Reemplazar' : 'Subir'} ${etiqueta}`} disabled={subiendo === tipo} onClick={() => elegirArchivo(tipo)}
                    className="flex items-center gap-1 text-blue-600 hover:underline disabled:text-gray-400">
                    {subiendo === tipo ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                    {tiene(tipo) ? 'Reemplazar' : 'Subir'}
                  </button>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
    </form>
  );
}
