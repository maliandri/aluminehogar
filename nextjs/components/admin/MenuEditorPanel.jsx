'use client';

import { useEffect, useState } from 'react';
import { ArrowUp, ArrowDown, Eye, EyeOff, Plus, Trash2, Loader2 } from 'lucide-react';
import { obtenerConfigMenu, guardarMenu, restaurarMenu } from '@/services/api';

const ROL_ETIQUETA = { admin: 'Administrador', vendedor: 'Vendedor' };

// Mueve el elemento `id` una posición dentro del grupo que cumple `mismoGrupo`, intercambiándolo con su vecino
function mover(lista, id, direccion, mismoGrupo) {
  const copia = [...lista];
  const i = copia.findIndex((x) => x.id === id);
  let j = i + direccion;
  while (j >= 0 && j < copia.length && !mismoGrupo(copia[j], copia[i])) j += direccion;
  if (j < 0 || j >= copia.length) return lista;
  [copia[i], copia[j]] = [copia[j], copia[i]];
  return copia;
}

export default function MenuEditorPanel() {
  const [config, setConfig] = useState(null);
  const [catalogo, setCatalogo] = useState({});
  const [guardando, setGuardando] = useState(false);
  const [mensaje, setMensaje] = useState(null);
  const [errores, setErrores] = useState([]);

  const cargar = () =>
    obtenerConfigMenu()
      .then((data) => {
        setConfig(data.config);
        setCatalogo(Object.fromEntries(data.catalogo.map((c) => [c.id, c])));
      })
      .catch(() => setMensaje({ tipo: 'error', texto: 'No se pudo cargar el menú' }));

  useEffect(() => { cargar(); }, []);

  const cambiarSeccion = (id, parche) =>
    setConfig((c) => ({ ...c, secciones: c.secciones.map((s) => (s.id === id ? { ...s, ...parche } : s)) }));
  const cambiarItem = (id, parche) =>
    setConfig((c) => ({ ...c, items: c.items.map((i) => (i.id === id ? { ...i, ...parche } : i)) }));

  const alternarRol = (item, rol) => {
    const roles = item.roles.includes(rol) ? item.roles.filter((r) => r !== rol) : [...item.roles, rol];
    cambiarItem(item.id, { roles });
  };

  const agregarSeccion = () =>
    setConfig((c) => ({
      ...c,
      secciones: [...c.secciones, { id: `custom-${Math.random().toString(36).slice(2, 8)}`, etiqueta: 'Nueva sección', icono: 'Folder', visible: true }],
    }));

  const borrarSeccion = (id) =>
    setConfig((c) => ({ ...c, secciones: c.secciones.filter((s) => s.id !== id) }));

  const handleGuardar = async () => {
    setGuardando(true);
    setMensaje(null);
    setErrores([]);
    try {
      await guardarMenu(config);
      // Recarga para que el menú de la izquierda ya muestre los cambios
      window.location.reload();
    } catch (err) {
      setErrores(err.response?.data?.errores || []);
      setMensaje({ tipo: 'error', texto: err.response?.data?.error || 'No se pudo guardar el menú' });
      setGuardando(false);
    }
  };

  const handleRestaurar = async () => {
    if (!confirm('¿Volver el menú a como venía de fábrica? Se pierden tus cambios de nombres, orden y roles.')) return;
    setGuardando(true);
    try {
      await restaurarMenu();
      window.location.reload();
    } catch (err) {
      setMensaje({ tipo: 'error', texto: err.response?.data?.error || 'No se pudo restaurar' });
      setGuardando(false);
    }
  };

  if (!config) {
    return <div className="text-center py-12 text-gray-500">{mensaje ? mensaje.texto : 'Cargando...'}</div>;
  }

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-2xl font-bold">Editar menú del panel</h2>
          <p className="text-sm text-gray-500">
            Elegí qué opciones aparecen en el menú de la izquierda, en qué sección, en qué orden y qué rol las ve.
            Un rol solo puede ver una pantalla si el sistema se lo permite.
          </p>
        </div>
        <div className="flex gap-2">
          <button type="button" onClick={handleRestaurar} disabled={guardando}
            className="border border-gray-300 px-4 py-2 rounded text-sm hover:bg-gray-50 disabled:opacity-50">
            Restaurar de fábrica
          </button>
          <button type="button" onClick={handleGuardar} disabled={guardando}
            className="bg-blue-600 text-white px-4 py-2 rounded text-sm hover:bg-blue-700 disabled:bg-gray-400 flex items-center gap-2">
            {guardando && <Loader2 className="w-4 h-4 animate-spin" />}
            Guardar menú
          </button>
        </div>
      </div>

      {mensaje && (
        <div className="rounded-lg p-4 text-sm border bg-red-50 border-red-200 text-red-800">
          {mensaje.texto}
          {errores.length > 0 && (
            <ul className="list-disc ml-5 mt-2">{errores.map((er) => <li key={er}>{er}</li>)}</ul>
          )}
        </div>
      )}

      {config.secciones.map((s, idx) => {
        const items = config.items.filter((i) => i.seccion === s.id);
        const esNueva = s.id.startsWith('custom-');
        return (
          <section key={s.id} className={`bg-white shadow rounded-lg p-4 space-y-3 ${s.visible ? '' : 'opacity-60'}`}>
            <div className="flex items-center gap-2">
              <input type="text" value={s.etiqueta} aria-label="Nombre de la sección" maxLength={40}
                onChange={(e) => cambiarSeccion(s.id, { etiqueta: e.target.value })}
                className="flex-1 border rounded px-3 py-2 font-semibold" />
              <button type="button" aria-label="Subir sección" disabled={idx === 0}
                onClick={() => setConfig((c) => ({ ...c, secciones: mover(c.secciones, s.id, -1, () => true) }))}
                className="p-2 rounded border hover:bg-gray-50 disabled:opacity-30"><ArrowUp className="w-4 h-4" /></button>
              <button type="button" aria-label="Bajar sección" disabled={idx === config.secciones.length - 1}
                onClick={() => setConfig((c) => ({ ...c, secciones: mover(c.secciones, s.id, 1, () => true) }))}
                className="p-2 rounded border hover:bg-gray-50 disabled:opacity-30"><ArrowDown className="w-4 h-4" /></button>
              <button type="button" aria-label={s.visible ? 'Ocultar sección' : 'Mostrar sección'}
                onClick={() => cambiarSeccion(s.id, { visible: !s.visible })}
                className="p-2 rounded border hover:bg-gray-50">
                {s.visible ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
              </button>
              {esNueva && (
                <button type="button" aria-label="Borrar sección" disabled={items.length > 0}
                  title={items.length > 0 ? 'Mové las opciones a otra sección para poder borrarla' : 'Borrar sección'}
                  onClick={() => borrarSeccion(s.id)}
                  className="p-2 rounded border text-red-600 hover:bg-red-50 disabled:opacity-30"><Trash2 className="w-4 h-4" /></button>
              )}
            </div>

            {items.length === 0 && <p className="text-sm text-gray-400 px-1">Sin opciones. Mové alguna desde otra sección.</p>}

            {items.map((it) => {
              const cat = catalogo[it.id] || { rolesPermitidos: [], bloqueado: false };
              return (
                <div key={it.id} className={`border rounded p-3 flex flex-wrap items-center gap-3 ${it.visible ? '' : 'bg-gray-50 opacity-70'}`}>
                  <input type="text" value={it.etiqueta} aria-label="Nombre de la opción" maxLength={40}
                    onChange={(e) => cambiarItem(it.id, { etiqueta: e.target.value })}
                    className="border rounded px-2 py-1.5 text-sm w-56" />
                  <select value={it.seccion} aria-label="Sección" onChange={(e) => cambiarItem(it.id, { seccion: e.target.value })}
                    className="border rounded px-2 py-1.5 text-sm">
                    {config.secciones.map((sec) => <option key={sec.id} value={sec.id}>{sec.etiqueta}</option>)}
                  </select>
                  <div className="flex items-center gap-3 text-sm">
                    {cat.rolesPermitidos.map((rol) => (
                      <label key={rol} className="flex items-center gap-1">
                        <input type="checkbox" checked={it.roles.includes(rol)} disabled={cat.bloqueado}
                          onChange={() => alternarRol(it, rol)} />
                        {ROL_ETIQUETA[rol] || rol}
                      </label>
                    ))}
                  </div>
                  <div className="flex items-center gap-1 ml-auto">
                    <button type="button" aria-label="Subir opción"
                      onClick={() => setConfig((c) => ({ ...c, items: mover(c.items, it.id, -1, (a, b) => a.seccion === b.seccion) }))}
                      className="p-1.5 rounded border hover:bg-gray-50"><ArrowUp className="w-4 h-4" /></button>
                    <button type="button" aria-label="Bajar opción"
                      onClick={() => setConfig((c) => ({ ...c, items: mover(c.items, it.id, 1, (a, b) => a.seccion === b.seccion) }))}
                      className="p-1.5 rounded border hover:bg-gray-50"><ArrowDown className="w-4 h-4" /></button>
                    <button type="button" aria-label={it.visible ? 'Ocultar opción' : 'Mostrar opción'} disabled={cat.bloqueado}
                      title={cat.bloqueado ? 'Esta opción no se puede ocultar' : undefined}
                      onClick={() => cambiarItem(it.id, { visible: !it.visible })}
                      className="p-1.5 rounded border hover:bg-gray-50 disabled:opacity-30">
                      {it.visible ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
              );
            })}
          </section>
        );
      })}

      <button type="button" onClick={agregarSeccion}
        className="flex items-center gap-2 border border-dashed border-gray-400 px-4 py-2 rounded text-sm text-gray-600 hover:bg-gray-50">
        <Plus className="w-4 h-4" /> Agregar sección
      </button>
    </div>
  );
}
