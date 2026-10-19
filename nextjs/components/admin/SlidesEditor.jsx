'use client';

import { useState } from 'react';
import { ArrowUp, ArrowDown, Trash2, Upload, Loader2, Plus } from 'lucide-react';
import { subirBanner } from '@/services/api';

const MAX_SLIDES = 10;
const SLIDE_VACIO = { imagen: '', titulo: '', subtitulo: '', botonTexto: '', botonEnlace: '', activo: true };

// Lista de slides del carrusel de inicio: subir imagen, textos, botón, orden y visibilidad
export default function SlidesEditor({ slides, onChange }) {
  const [subiendo, setSubiendo] = useState(null);

  const cambiar = (i, campo, valor) =>
    onChange(slides.map((s, idx) => (idx === i ? { ...s, [campo]: valor } : s)));

  const mover = (i, delta) => {
    const j = i + delta;
    if (j < 0 || j >= slides.length) return;
    const copia = [...slides];
    [copia[i], copia[j]] = [copia[j], copia[i]];
    onChange(copia);
  };

  const subir = (i, file) => {
    if (!file) return;
    if (file.size > 4 * 1024 * 1024) { alert('La imagen debe pesar menos de 4MB'); return; }
    setSubiendo(i);
    const reader = new FileReader();
    reader.onloadend = async () => {
      try {
        const r = await subirBanner(reader.result);
        cambiar(i, 'imagen', r.url);
      } catch (err) {
        alert(err.response?.data?.error || 'Error al subir la imagen');
      } finally {
        setSubiendo(null);
      }
    };
    reader.readAsDataURL(file);
  };

  return (
    <div className="space-y-4">
      {slides.length === 0 && (
        <p className="text-sm text-gray-500">Todavía no hay promociones. Mientras no cargues ninguna, el inicio muestra el título y subtítulo de arriba.</p>
      )}

      {slides.map((s, i) => (
        <div key={i} className={`border rounded-lg p-4 space-y-3 ${s.activo ? '' : 'bg-gray-50 opacity-75'}`}>
          <div className="flex items-center justify-between">
            <span className="font-medium text-sm">Promoción {i + 1}</span>
            <div className="flex items-center gap-1">
              <label className="flex items-center gap-1 text-xs mr-2 cursor-pointer">
                <input type="checkbox" checked={s.activo} onChange={(e) => cambiar(i, 'activo', e.target.checked)} />
                Visible
              </label>
              <button type="button" onClick={() => mover(i, -1)} disabled={i === 0} aria-label="Subir"
                className="p-1 rounded hover:bg-gray-100 disabled:opacity-30"><ArrowUp className="w-4 h-4" /></button>
              <button type="button" onClick={() => mover(i, 1)} disabled={i === slides.length - 1} aria-label="Bajar"
                className="p-1 rounded hover:bg-gray-100 disabled:opacity-30"><ArrowDown className="w-4 h-4" /></button>
              <button type="button" onClick={() => onChange(slides.filter((_, idx) => idx !== i))} aria-label="Borrar"
                className="p-1 rounded hover:bg-red-50 text-red-600"><Trash2 className="w-4 h-4" /></button>
            </div>
          </div>

          <div className="flex gap-4 items-start">
            <div className="w-40 h-24 bg-gray-100 rounded border flex items-center justify-center overflow-hidden shrink-0">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {s.imagen ? <img src={s.imagen} alt="" className="w-full h-full object-cover" /> : <span className="text-xs text-gray-400">Sin imagen</span>}
            </div>
            <label className="flex items-center gap-2 px-3 py-2 rounded cursor-pointer text-sm bg-blue-50 text-blue-600 hover:bg-blue-100">
              {subiendo === i ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
              {subiendo === i ? 'Subiendo...' : (s.imagen ? 'Cambiar imagen' : 'Subir imagen')}
              <input type="file" accept="image/*" className="hidden" disabled={subiendo !== null}
                onChange={(e) => subir(i, e.target.files[0])} />
            </label>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <input type="text" value={s.titulo} onChange={(e) => cambiar(i, 'titulo', e.target.value)}
              placeholder="Título (opcional)" className="border rounded px-3 py-2 text-sm" />
            <input type="text" value={s.subtitulo} onChange={(e) => cambiar(i, 'subtitulo', e.target.value)}
              placeholder="Subtítulo (opcional)" className="border rounded px-3 py-2 text-sm" />
            <input type="text" value={s.botonTexto} onChange={(e) => cambiar(i, 'botonTexto', e.target.value)}
              placeholder="Texto del botón (ej: Ver ofertas)" className="border rounded px-3 py-2 text-sm" />
            <input type="text" value={s.botonEnlace} onChange={(e) => cambiar(i, 'botonEnlace', e.target.value)}
              placeholder="Enlace del botón (ej: /#productos o https://...)" className="border rounded px-3 py-2 text-sm" />
          </div>
        </div>
      ))}

      <button type="button" disabled={slides.length >= MAX_SLIDES}
        onClick={() => onChange([...slides, { ...SLIDE_VACIO }])}
        className="flex items-center gap-2 px-4 py-2 rounded text-sm font-medium bg-purple-50 text-purple-700 hover:bg-purple-100 disabled:opacity-50">
        <Plus className="w-4 h-4" /> Agregar promoción
      </button>
      <p className="text-xs text-gray-500">Imagen horizontal de unos 1920×700 px, hasta 4MB. Máximo {MAX_SLIDES} promociones. Recordá apretar Guardar al final.</p>
    </div>
  );
}
