'use client';

import { useState } from 'react';
import { Search, ImagePlus, Trash2, Upload, X, Sparkles, Loader2 } from 'lucide-react';
import {
  crearProducto,
  actualizarProducto,
  subirImagen,
  generarEspecificacionesIA,
  buscarImagenesProducto,
  importarImagenUrl,
} from '@/services/api';

export default function ProductForm({ producto, categorias, onClose, onSuccess }) {
  const [formData, setFormData] = useState({
    nombre: producto?.nombre || '',
    descripcion: producto?.descripcion || '',
    especificaciones: producto?.especificaciones || '',
    precio: producto?.precio || '',
    categoria: producto?.categoria || '',
    marca: producto?.marca || '',
    medidas: producto?.medidas || '',
    imagen: producto?.imagen || '',
    imagenOptimizada: producto?.imagenOptimizada || '',
    mostrar: producto?.mostrar || 'si',
    stock: producto?.stock || 0
  });

  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [generatingIA, setGeneratingIA] = useState(false);
  const [buscandoImagen, setBuscandoImagen] = useState(false);

  const handleGenerarIA = async () => {
    if (!formData.nombre) {
      alert('Ingresa el nombre del producto primero');
      return;
    }
    setGeneratingIA(true);
    try {
      const result = await generarEspecificacionesIA(producto?._id, formData.nombre, formData.categoria);
      setFormData(prev => ({
        ...prev,
        descripcion: result.descripcion || prev.descripcion,
        especificaciones: result.especificaciones || prev.especificaciones
      }));
      if (producto?._id) {
        alert('Especificaciones generadas y guardadas en la base de datos');
      } else {
        alert('Especificaciones generadas. Se guardarán al crear el producto.');
      }
    } catch (error) {
      console.error('Error generando especificaciones:', error);
      alert('Error al generar especificaciones con IA');
    } finally {
      setGeneratingIA(false);
    }
  };

  // Determinar la imagen de preview - puede venir de imagenOptimizada (Cloudinary) o imagen directa
  const imagenPreview = (() => {
    if (typeof formData.imagenOptimizada === 'object' && formData.imagenOptimizada?.card) {
      return formData.imagenOptimizada.card;
    }
    if (formData.imagenOptimizada && typeof formData.imagenOptimizada === 'string') {
      return formData.imagenOptimizada;
    }
    if (formData.imagen) {
      return formData.imagen;
    }
    return null;
  })();

  const handleImageUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) { alert('La imagen debe pesar menos de 10MB'); return; }

    setUploading(true);
    try {
      const reader = new FileReader();
      reader.onloadend = async () => {
        try {
          const base64 = reader.result;
          const response = await subirImagen(base64);
          setFormData(prev => ({ ...prev, imagen: response.url, imagenOptimizada: response.optimizedUrl }));
        } catch (error) {
          alert('Error al subir imagen');
        } finally {
          setUploading(false);
        }
      };
      reader.readAsDataURL(file);
    } catch (error) {
      alert('Error al subir imagen');
      setUploading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.nombre || !formData.precio || !formData.categoria) {
      alert('Nombre, precio y categoria son requeridos'); return;
    }
    setSaving(true);
    try {
      if (producto) {
        await actualizarProducto(producto._id, formData);
        alert('Producto actualizado');
      } else {
        await crearProducto(formData);
        alert('Producto creado');
      }
      onSuccess();
    } catch (error) {
      alert(error.response?.data?.error || 'Error al guardar producto');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      {buscandoImagen && (
        <BuscarImagenModal
          consultaInicial={[formData.marca, formData.nombre].filter(Boolean).join(' ')}
          onClose={() => setBuscandoImagen(false)}
          onElegida={(r) => { setFormData(prev => ({ ...prev, imagen: r.url, imagenOptimizada: r.optimizedUrl })); setBuscandoImagen(false); }}
        />
      )}
      <div className="bg-white rounded-lg max-w-2xl w-full max-h-screen overflow-y-auto">
        <div className="p-6">
          <h2 className="text-2xl font-bold mb-4">{producto ? 'Editar Producto' : 'Crear Producto'}</h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Imagen */}
            <div>
              <label className="block text-sm font-medium mb-2">Imagen del producto</label>
              <div className="flex items-start gap-4">
                {imagenPreview ? (
                  <div className="relative group">
                    <img src={imagenPreview} alt="Imagen actual"
                      className="w-48 h-48 object-cover rounded-lg border-2 border-gray-200" />
                    <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-30 rounded-lg transition-all flex items-center justify-center">
                      <span className="text-white opacity-0 group-hover:opacity-100 text-sm font-medium">Cambiar imagen</span>
                    </div>
                  </div>
                ) : (
                  <div className="w-48 h-48 border-2 border-dashed border-gray-300 rounded-lg flex flex-col items-center justify-center text-gray-400">
                    <ImagePlus className="w-10 h-10 mb-2" />
                    <span className="text-xs">Sin imagen</span>
                  </div>
                )}
                <div className="flex-1 space-y-2">
                  <label className={`flex items-center gap-2 px-4 py-2 rounded cursor-pointer text-sm font-medium transition-colors ${
                    uploading ? 'bg-gray-100 text-gray-400' : 'bg-blue-50 text-blue-600 hover:bg-blue-100'
                  }`}>
                    <Upload className="w-4 h-4" />
                    {uploading ? 'Subiendo...' : (imagenPreview ? 'Cambiar imagen' : 'Subir imagen')}
                    <input type="file" accept="image/*" onChange={handleImageUpload}
                      className="hidden" disabled={uploading} />
                  </label>
                  {uploading && (
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div className="bg-blue-600 h-2 rounded-full animate-pulse" style={{ width: '60%' }}></div>
                    </div>
                  )}
                  <button type="button" onClick={() => setBuscandoImagen(true)} disabled={uploading}
                    className="w-full flex items-center gap-2 px-4 py-2 rounded text-sm font-medium bg-purple-50 text-purple-700 hover:bg-purple-100 disabled:opacity-50">
                    <Search className="w-4 h-4" /> Buscar imagen
                  </button>
                  <p className="text-xs text-gray-500">JPG, PNG o WebP. Max 10MB.</p>
                  {imagenPreview && (
                    <button type="button" onClick={() => setFormData(prev => ({ ...prev, imagen: '', imagenOptimizada: '' }))}
                      className="flex items-center gap-1 text-xs text-red-500 hover:text-red-700">
                      <Trash2 className="w-3 h-3" /> Quitar imagen
                    </button>
                  )}
                </div>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Nombre *</label>
              <input type="text" value={formData.nombre} onChange={(e) => setFormData({ ...formData, nombre: e.target.value })}
                className="w-full border rounded px-3 py-2" required />
            </div>
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-sm font-medium">Descripcion</label>
                <button
                  type="button"
                  onClick={handleGenerarIA}
                  disabled={generatingIA || !formData.nombre}
                  className="flex items-center gap-1 px-3 py-1 text-xs font-medium rounded-full bg-purple-100 text-purple-700 hover:bg-purple-200 disabled:bg-gray-100 disabled:text-gray-400 transition-colors"
                >
                  {generatingIA ? (
                    <>
                      <Loader2 className="w-3 h-3 animate-spin" />
                      Generando...
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-3 h-3" />
                      Generar con IA
                    </>
                  )}
                </button>
              </div>
              <textarea value={formData.descripcion} onChange={(e) => setFormData({ ...formData, descripcion: e.target.value })}
                className="w-full border rounded px-3 py-2" rows="3" placeholder="Descripción comercial del producto" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Especificaciones (HTML)</label>
              <textarea
                value={formData.especificaciones}
                onChange={(e) => setFormData({ ...formData, especificaciones: e.target.value })}
                className="w-full border rounded px-3 py-2 font-mono text-xs"
                rows="5"
                placeholder="<ul><li><strong>Característica:</strong> valor</li></ul>"
              />
              {formData.especificaciones && (
                <div className="mt-2 p-3 bg-gray-50 rounded border">
                  <p className="text-xs text-gray-500 mb-2">Vista previa:</p>
                  <div className="text-sm prose prose-sm" dangerouslySetInnerHTML={{ __html: formData.especificaciones }} />
                </div>
              )}
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">Precio * (ARS)</label>
                <input type="number" value={formData.precio} onChange={(e) => setFormData({ ...formData, precio: e.target.value })}
                  className="w-full border rounded px-3 py-2" required />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Stock</label>
                <input type="number" value={formData.stock} onChange={(e) => setFormData({ ...formData, stock: e.target.value })}
                  className="w-full border rounded px-3 py-2" />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Categoria *</label>
              <input type="text" value={formData.categoria} onChange={(e) => setFormData({ ...formData, categoria: e.target.value })}
                className="w-full border rounded px-3 py-2" placeholder="Ej: Colchones, Almohadas, etc." required
                list="categorias-list" />
              <datalist id="categorias-list">
                {categorias.map(cat => (
                  <option key={cat} value={cat} />
                ))}
              </datalist>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Marca</label>
              <input type="text" value={formData.marca} onChange={(e) => setFormData({ ...formData, marca: e.target.value })}
                className="w-full border rounded px-3 py-2" placeholder="Ej: Sealy, Whirlpool" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Medidas</label>
              <input type="text" value={formData.medidas} onChange={(e) => setFormData({ ...formData, medidas: e.target.value })}
                className="w-full border rounded px-3 py-2" placeholder="Ej: 190 x 140 cm" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Mostrar en web</label>
              <select value={formData.mostrar} onChange={(e) => setFormData({ ...formData, mostrar: e.target.value })}
                className="w-full border rounded px-3 py-2">
                <option value="si">Si</option>
                <option value="no">No</option>
              </select>
            </div>
            <div className="flex justify-end space-x-3 pt-4">
              <button type="button" onClick={onClose} className="px-6 py-2 border rounded hover:bg-gray-100" disabled={saving}>
                Cancelar
              </button>
              <button type="submit" className="px-6 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:bg-gray-400" disabled={saving || uploading}>
                {saving ? 'Guardando...' : 'Guardar'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

// =================== IMPORTAR PRESUPUESTO PDF ===================

function BuscarImagenModal({ consultaInicial, onClose, onElegida }) {
  const [consulta, setConsulta] = useState(consultaInicial);
  const [buscando, setBuscando] = useState(false);
  const [importando, setImportando] = useState(null);
  const [resultados, setResultados] = useState(null);

  const buscar = async (e) => {
    e?.preventDefault();
    if (consulta.trim().length < 3) return;
    setBuscando(true);
    try {
      const data = await buscarImagenesProducto(consulta.trim());
      setResultados(data.resultados);
    } catch (err) {
      alert(err.response?.data?.error || 'Error al buscar imagenes');
    } finally {
      setBuscando(false);
    }
  };

  const elegir = async (r) => {
    setImportando(r.url);
    try {
      const data = await importarImagenUrl(r.url);
      onElegida(data);
    } catch (err) {
      alert(err.response?.data?.error || 'No se pudo usar esa imagen');
      setImportando(null);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] bg-black/50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between p-4 border-b">
          <h3 className="text-lg font-semibold">Buscar imagen del producto</h3>
          <button type="button" onClick={onClose} className="text-gray-500 hover:text-gray-700"><X className="w-5 h-5" /></button>
        </div>
        <form onSubmit={buscar} className="flex gap-2 p-4 border-b">
          <input type="text" value={consulta} onChange={(e) => setConsulta(e.target.value)}
            className="flex-1 border rounded px-3 py-2 text-sm" placeholder="Marca y modelo del producto" />
          <button type="submit" disabled={buscando} className="bg-blue-600 text-white px-4 py-2 rounded text-sm hover:bg-blue-700 disabled:bg-gray-400 flex items-center gap-2">
            {buscando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
            Buscar
          </button>
        </form>
        <div className="p-4 overflow-y-auto">
          <p className="text-xs text-gray-500 mb-3">
            Las imágenes pertenecen a sus sitios de origen. Preferí las del fabricante o proveedor y revisá que tengas derecho a usarlas.
          </p>
          {resultados && resultados.length === 0 && <div className="text-center py-8 text-gray-500">Sin resultados. Probá con otra búsqueda.</div>}
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {(resultados || []).map((r) => (
              <button key={r.url} type="button" disabled={!!importando} onClick={() => elegir(r)}
                className="border rounded-lg overflow-hidden text-left hover:ring-2 hover:ring-blue-500 disabled:opacity-60 relative bg-white">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={r.miniatura} alt={r.titulo} className="w-full h-32 object-contain bg-gray-50" />
                <div className="p-2">
                  <div className="text-xs font-medium truncate">{r.fuente || 'Sitio desconocido'}</div>
                  <div className="text-[11px] text-gray-500">{r.ancho && r.alto ? `${r.ancho}×${r.alto}` : ''}</div>
                </div>
                {importando === r.url && (
                  <div className="absolute inset-0 bg-white/70 flex items-center justify-center"><Loader2 className="w-6 h-6 animate-spin" /></div>
                )}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
