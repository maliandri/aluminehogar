/**
 * Panel de Administración de Productos
 * Solo accesible para usuarios con role='admin'
 */
import { useState, useEffect } from 'react';
import { useAuthStore } from '../store/authStore';
import { useNavigate } from 'react-router-dom';
import {
  getProductosAdmin,
  crearProducto,
  actualizarProducto,
  eliminarProducto,
  subirImagen
} from '../services/api';
import { InvitationsPanel } from '../components/InvitationsPanel';

export default function AdminPanel() {
  const { user, isAdmin } = useAuthStore();
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState('productos');
  const [productos, setProductos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingProduct, setEditingProduct] = useState(null);
  const [showForm, setShowForm] = useState(false);

  useEffect(() => {
    // Verificar que sea admin
    if (!isAdmin()) {
      alert('Acceso denegado: Solo administradores');
      navigate('/');
      return;
    }

    fetchProductos();
  }, []);

  const fetchProductos = async () => {
    try {
      setLoading(true);
      const data = await getProductosAdmin();
      setProductos(data.productos);
    } catch (error) {
      console.error('Error:', error);
      alert('Error al cargar productos');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id, nombre) => {
    if (!confirm(`¿Eliminar el producto "${nombre}"?`)) return;

    try {
      await eliminarProducto(id);
      alert('Producto eliminado');
      fetchProductos();
    } catch (error) {
      alert('Error al eliminar producto');
    }
  };

  const handleEdit = (producto) => {
    setEditingProduct(producto);
    setShowForm(true);
  };

  const handleCreate = () => {
    setEditingProduct(null);
    setShowForm(true);
  };

  if (loading) {
    return <div className="container mx-auto p-8">Cargando...</div>;
  }

  return (
    <div className="container mx-auto p-8">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">Panel de Administración</h1>
        {activeTab === 'productos' && (
          <button
            onClick={handleCreate}
            className="bg-blue-600 text-white px-6 py-2 rounded hover:bg-blue-700"
          >
            + Crear Producto
          </button>
        )}
      </div>

      <div className="flex space-x-2 mb-6 border-b">
        <button
          onClick={() => setActiveTab('productos')}
          className={`px-4 py-2 font-medium border-b-2 transition-colors ${
            activeTab === 'productos'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          Productos
        </button>
        <button
          onClick={() => setActiveTab('usuarios')}
          className={`px-4 py-2 font-medium border-b-2 transition-colors ${
            activeTab === 'usuarios'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          Usuarios e invitaciones
        </button>
      </div>

      {activeTab === 'usuarios' && <InvitationsPanel />}

      {activeTab === 'productos' && (
      <>
      {showForm && (
        <ProductForm
          producto={editingProduct}
          onClose={() => setShowForm(false)}
          onSuccess={() => {
            setShowForm(false);
            fetchProductos();
          }}
        />
      )}

      <div className="bg-white shadow rounded-lg overflow-hidden">
        <table className="min-w-full">
          <thead className="bg-gray-100">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase">
                Imagen
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase">
                Nombre
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase">
                Precio
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase">
                Categoría
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase">
                Stock
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase">
                Mostrar
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-700 uppercase">
                Acciones
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {productos.map((producto) => (
              <tr key={producto._id} className="hover:bg-gray-50">
                <td className="px-6 py-4">
                  {producto.imagen && (
                    <img
                      src={producto.imagenOptimizada || producto.imagen}
                      alt={producto.nombre}
                      className="w-16 h-16 object-cover rounded"
                    />
                  )}
                </td>
                <td className="px-6 py-4 font-medium">{producto.nombre}</td>
                <td className="px-6 py-4">${producto.precio?.toLocaleString('es-AR')}</td>
                <td className="px-6 py-4">{producto.categoria}</td>
                <td className="px-6 py-4">{producto.stock || 0}</td>
                <td className="px-6 py-4">
                  <span
                    className={`px-2 py-1 rounded text-xs ${
                      producto.mostrar === 'si'
                        ? 'bg-green-100 text-green-800'
                        : 'bg-red-100 text-red-800'
                    }`}
                  >
                    {producto.mostrar === 'si' ? 'Sí' : 'No'}
                  </span>
                </td>
                <td className="px-6 py-4 text-right space-x-2">
                  <button
                    onClick={() => handleEdit(producto)}
                    className="text-blue-600 hover:text-blue-800"
                  >
                    Editar
                  </button>
                  <button
                    onClick={() => handleDelete(producto._id, producto.nombre)}
                    className="text-red-600 hover:text-red-800"
                  >
                    Eliminar
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {productos.length === 0 && (
          <div className="text-center py-12 text-gray-500">
            No hay productos creados. Crea uno para empezar.
          </div>
        )}
      </div>
      </>
      )}
    </div>
  );
}

function ProductForm({ producto, onClose, onSuccess }) {
  const [formData, setFormData] = useState({
    nombre: producto?.nombre || '',
    descripcion: producto?.descripcion || '',
    precio: producto?.precio || '',
    categoria: producto?.categoria || '',
    medidas: producto?.medidas || '',
    imagen: producto?.imagen || '',
    imagenOptimizada: producto?.imagenOptimizada || '',
    mostrar: producto?.mostrar || 'si',
    stock: producto?.stock || 0
  });

  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);

  const handleImageUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (file.size > 10 * 1024 * 1024) {
      alert('La imagen debe pesar menos de 10MB');
      return;
    }

    setUploading(true);
    try {
      const reader = new FileReader();
      reader.onloadend = async () => {
        const base64 = reader.result;

        const response = await subirImagen(base64);

        setFormData({
          ...formData,
          imagen: response.url,
          imagenOptimizada: response.optimizedUrl
        });

        alert('Imagen subida exitosamente');
      };
      reader.readAsDataURL(file);
    } catch (error) {
      alert('Error al subir imagen');
    } finally {
      setUploading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!formData.nombre || !formData.precio || !formData.categoria) {
      alert('Nombre, precio y categoría son requeridos');
      return;
    }

    setSaving(true);
    try {
      if (producto) {
        // Actualizar
        await actualizarProducto(producto._id, formData);
        alert('Producto actualizado');
      } else {
        // Crear
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
      <div className="bg-white rounded-lg max-w-2xl w-full max-h-screen overflow-y-auto">
        <div className="p-6">
          <h2 className="text-2xl font-bold mb-4">
            {producto ? 'Editar Producto' : 'Crear Producto'}
          </h2>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">Nombre *</label>
              <input
                type="text"
                value={formData.nombre}
                onChange={(e) => setFormData({ ...formData, nombre: e.target.value })}
                className="w-full border rounded px-3 py-2"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Descripción</label>
              <textarea
                value={formData.descripcion}
                onChange={(e) => setFormData({ ...formData, descripcion: e.target.value })}
                className="w-full border rounded px-3 py-2"
                rows="3"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">Precio * (ARS)</label>
                <input
                  type="number"
                  value={formData.precio}
                  onChange={(e) => setFormData({ ...formData, precio: e.target.value })}
                  className="w-full border rounded px-3 py-2"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Stock</label>
                <input
                  type="number"
                  value={formData.stock}
                  onChange={(e) => setFormData({ ...formData, stock: e.target.value })}
                  className="w-full border rounded px-3 py-2"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Categoría *</label>
              <input
                type="text"
                value={formData.categoria}
                onChange={(e) => setFormData({ ...formData, categoria: e.target.value })}
                className="w-full border rounded px-3 py-2"
                placeholder="Ej: Colchones, Almohadas, etc."
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Medidas</label>
              <input
                type="text"
                value={formData.medidas}
                onChange={(e) => setFormData({ ...formData, medidas: e.target.value })}
                className="w-full border rounded px-3 py-2"
                placeholder="Ej: 190 x 140 cm"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Mostrar en web</label>
              <select
                value={formData.mostrar}
                onChange={(e) => setFormData({ ...formData, mostrar: e.target.value })}
                className="w-full border rounded px-3 py-2"
              >
                <option value="si">Sí</option>
                <option value="no">No</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Imagen</label>
              <input
                type="file"
                accept="image/*"
                onChange={handleImageUpload}
                className="w-full border rounded px-3 py-2"
                disabled={uploading}
              />
              {uploading && <p className="text-sm text-blue-600 mt-1">Subiendo imagen...</p>}
              {formData.imagen && (
                <img
                  src={formData.imagenOptimizada || formData.imagen}
                  alt="Preview"
                  className="mt-2 w-32 h-32 object-cover rounded"
                />
              )}
            </div>

            <div className="flex justify-end space-x-3 pt-4">
              <button
                type="button"
                onClick={onClose}
                className="px-6 py-2 border rounded hover:bg-gray-100"
                disabled={saving}
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="px-6 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:bg-gray-400"
                disabled={saving}
              >
                {saving ? 'Guardando...' : 'Guardar'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
