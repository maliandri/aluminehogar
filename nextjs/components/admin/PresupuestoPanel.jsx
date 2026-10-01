'use client';

import { useState, useEffect } from 'react';
import { Loader2, FileUp } from 'lucide-react';
import {
  listarDepositos,
  leerPresupuestoPdf,
  importarPresupuesto,
} from '@/services/api';

const fmtPrecio = (n) => (typeof n === 'number' ? n.toLocaleString('es-AR', { minimumFractionDigits: 2 }) : n);

export default function PresupuestoPanel() {
  const [leyendo, setLeyendo] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [lectura, setLectura] = useState(null);
  const [filas, setFilas] = useState([]);
  const [resultado, setResultado] = useState(null);
  const [depositos, setDepositos] = useState([]);
  const [depositoId, setDepositoId] = useState('');

  useEffect(() => {
    listarDepositos()
      .then((d) => {
        const activos = (d.depositos || []).filter((x) => x.activo !== false && !x.esVirtualVendedor);
        setDepositos(activos);
        if (activos.length) setDepositoId(String(activos[0]._id));
      })
      .catch(() => {});
  }, []);

  const handleArchivo = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (file.type !== 'application/pdf') {
      alert('El archivo tiene que ser un PDF');
      return;
    }
    setLeyendo(true);
    setLectura(null);
    setFilas([]);
    setResultado(null);
    try {
      const base64 = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
      const data = await leerPresupuestoPdf(base64);
      setLectura(data);
      setFilas(data.filas.map((f) => ({ ...f, unidades: f.cantidad, incluir: !f.existente })));
    } catch (err) {
      alert(err.response?.data?.error || 'Error al leer el PDF');
    } finally {
      setLeyendo(false);
    }
  };

  const editar = (codigo, campo, valor) =>
    setFilas((prev) => prev.map((f) => (f.codigo === codigo ? { ...f, [campo]: valor } : f)));

  const elegidas = filas.filter((f) => f.incluir && !f.existente);
  const incompletas = elegidas.filter((f) => !f.categoria.trim() || !(Number(f.precio) > 0) || !f.nombre.trim() || !(Number(f.unidades) >= 0));
  const categoriasConocidas = new Set(lectura?.categorias || []);

  const handleAprobar = async () => {
    if (!elegidas.length || incompletas.length) return;
    const totalUnidades = elegidas.reduce((a, f) => a + (parseInt(f.unidades) || 0), 0);
    const donde = depositos.find((d) => String(d._id) === depositoId)?.nombre;
    if (!confirm(`Se van a crear ${elegidas.length} productos SIN publicar, con ${totalUnidades} unidades de stock${donde ? ` en ${donde}` : ''}. ¿Continuar?`)) return;
    setGuardando(true);
    try {
      const data = await importarPresupuesto(
        elegidas.map((f) => ({ codigo: f.codigo, nombre: f.nombre, precio: Number(f.precio), categoria: f.categoria, marca: f.marca, unidades: parseInt(f.unidades) || 0 })),
        depositoId
      );
      setResultado(data);
      setLectura(null);
      setFilas([]);
    } catch (err) {
      alert(err.response?.data?.error || 'Error al cargar los productos');
    } finally {
      setGuardando(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-white shadow rounded-lg p-6">
        <h3 className="text-lg font-semibold mb-1">Importar presupuesto de proveedor (PDF)</h3>
        <p className="text-sm text-gray-500 mb-4">
          Subí el PDF, revisá los datos y aprobá. Los productos se crean <strong>sin publicar</strong>, con el código del proveedor como ID.
        </p>
        <label className={`inline-flex items-center gap-2 px-4 py-2 rounded text-sm text-white cursor-pointer ${leyendo ? 'bg-gray-400' : 'bg-blue-600 hover:bg-blue-700'}`}>
          {leyendo ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileUp className="w-4 h-4" />}
          {leyendo ? 'Leyendo PDF...' : 'Elegir PDF'}
          <input type="file" accept="application/pdf" className="hidden" disabled={leyendo} onChange={handleArchivo} />
        </label>
        {depositos.length > 0 && (
          <label className="ml-4 inline-flex items-center gap-2 text-sm">
            Cargar stock en:
            <select value={depositoId} onChange={(e) => setDepositoId(e.target.value)} className="border rounded px-2 py-1.5 text-sm">
              {depositos.map((d) => <option key={d._id} value={String(d._id)}>{d.nombre}</option>)}
            </select>
          </label>
        )}
      </div>

      {resultado && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-sm text-green-800">
          Se crearon <strong>{resultado.creados}</strong> productos sin publicar
          {resultado.yaExistian > 0 && <> · {resultado.yaExistian} ya existían y no se tocaron</>}
          {resultado.errores?.length > 0 && <> · {resultado.errores.length} con errores: {resultado.errores.join('; ')}</>}
          . Los encontrás en la pestaña Productos para publicarlos cuando quieras.
        </div>
      )}

      {lectura && (
        <>
          <div className={`rounded-lg p-4 text-sm border ${lectura.coincide ? 'bg-green-50 border-green-200 text-green-800' : 'bg-yellow-50 border-yellow-300 text-yellow-800'}`}>
            {lectura.coincide
              ? <>La suma de los {filas.length} productos (${fmtPrecio(lectura.suma)}) coincide con el total del PDF.</>
              : <>Atención: la suma leída (${fmtPrecio(lectura.suma)}) no coincide con el total del PDF (${fmtPrecio(lectura.totalPdf)}){lectura.incompletas > 0 && <>; hay {lectura.incompletas} filas que no se pudieron leer</>}. Revisá con cuidado antes de aprobar.</>}
          </div>

          <div className="bg-white shadow rounded-lg overflow-x-auto">
            <datalist id="presupuesto-categorias">
              {(lectura.categorias || []).map((c) => <option key={c} value={c} />)}
            </datalist>
            <table className="min-w-full">
              <thead className="bg-gray-100">
                <tr>
                  <th className="px-3 py-3"></th>
                  <th className="px-3 py-3 text-left text-xs font-medium text-gray-700 uppercase">Código</th>
                  <th className="px-3 py-3 text-left text-xs font-medium text-gray-700 uppercase">Nombre</th>
                  <th className="px-3 py-3 text-left text-xs font-medium text-gray-700 uppercase">Unidades a stock</th>
                  <th className="px-3 py-3 text-left text-xs font-medium text-gray-700 uppercase">Precio</th>
                  <th className="px-3 py-3 text-left text-xs font-medium text-gray-700 uppercase">Categoría</th>
                  <th className="px-3 py-3 text-left text-xs font-medium text-gray-700 uppercase">Marca</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {filas.map((f) => (
                  <tr key={f.codigo} className={f.existente ? 'bg-gray-50 text-gray-400' : ''}>
                    <td className="px-3 py-2">
                      <input type="checkbox" checked={f.incluir && !f.existente} disabled={!!f.existente}
                        onChange={(e) => editar(f.codigo, 'incluir', e.target.checked)} />
                    </td>
                    <td className="px-3 py-2 text-sm font-mono">{f.codigo}</td>
                    <td className="px-3 py-2">
                      <input type="text" value={f.nombre} disabled={!!f.existente} onChange={(e) => editar(f.codigo, 'nombre', e.target.value)}
                        className="w-72 border rounded px-2 py-1 text-sm disabled:bg-transparent" />
                      {f.existente && <div className="text-xs">Ya existe: {f.existente.nombre} (no se modifica)</div>}
                    </td>
                    <td className="px-3 py-2">
                      <input type="number" min="0" step="1" value={f.unidades} disabled={!!f.existente} onChange={(e) => editar(f.codigo, 'unidades', e.target.value)}
                        className="w-24 border rounded px-2 py-1 text-sm disabled:bg-transparent" />
                      {!f.existente && Number(f.unidades) !== f.cantidad && <div className="text-xs text-gray-400">PDF: {f.cantidad}</div>}
                    </td>
                    <td className="px-3 py-2">
                      <input type="number" min="0" step="0.01" value={f.precio} disabled={!!f.existente} onChange={(e) => editar(f.codigo, 'precio', e.target.value)}
                        className="w-32 border rounded px-2 py-1 text-sm disabled:bg-transparent" />
                    </td>
                    <td className="px-3 py-2">
                      <input type="text" list="presupuesto-categorias" value={f.categoria} disabled={!!f.existente}
                        onChange={(e) => editar(f.codigo, 'categoria', e.target.value)}
                        className={`w-40 border rounded px-2 py-1 text-sm disabled:bg-transparent ${!f.existente && !f.categoria.trim() ? 'border-red-400' : ''}`} />
                      {!f.existente && f.categoria.trim() && !categoriasConocidas.has(f.categoria.trim()) && (
                        <span className="ml-2 text-xs text-orange-600">nueva</span>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      <input type="text" value={f.marca} disabled={!!f.existente} onChange={(e) => editar(f.codigo, 'marca', e.target.value)}
                        className="w-32 border rounded px-2 py-1 text-sm disabled:bg-transparent" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex items-center justify-between flex-wrap gap-3">
            <span className="text-sm text-gray-600">
              {elegidas.length} seleccionados
              {incompletas.length > 0 && <span className="text-red-600"> · {incompletas.length} sin categoría, precio o unidades válidas</span>}
            </span>
            <button onClick={handleAprobar} disabled={guardando || !elegidas.length || incompletas.length > 0}
              className="bg-green-600 text-white px-5 py-2 rounded text-sm hover:bg-green-700 disabled:bg-gray-400">
              {guardando ? 'Creando...' : `Aprobar y crear ${elegidas.length} productos (sin publicar)`}
            </button>
          </div>
        </>
      )}
    </div>
  );
}

// =================== BUSCADOR DE IMAGENES ===================
