'use client';

import { useState, useEffect, useMemo } from 'react';
import { useAuthStore } from '@/store/authStore';
import { useRouter } from 'next/navigation';
import { Search, ImagePlus, Trash2, Upload, MessageSquare, Package, X, ChevronLeft, ChevronRight, Sparkles, Loader2, ChevronUp, ChevronDown, Users, Ban, UserCheck, FileDown, FileUp, Plus, Minus, CreditCard, Check } from 'lucide-react';
import * as xlsxClient from 'xlsx';
import {
  getProductosAdmin,
  crearProducto,
  actualizarProducto,
  eliminarProducto,
  subirImagen,
  getConversaciones,
  getConversacion,
  generarEspecificacionesIA,
  getUsuarios,
  actualizarUsuario,
  eliminarUsuario,
  actualizarStock,
  actualizarMostrar,
  importarStockExcel,
  crearInvitacion,
  listarInvitaciones,
  revocarInvitacion,
  listarCreditos,
  aprobarCredito,
  rechazarCredito,
  getPaymentSettings,
  actualizarPaymentSettings,
  listarDepositos,
  crearDeposito,
  actualizarDeposito,
  eliminarDeposito,
  listarMediosPago,
  crearMedioPago,
  actualizarMedioPago,
  eliminarMedioPago,
  listarPromociones,
  crearPromocion,
  actualizarPromocion,
  eliminarPromocion,
  leerPresupuestoPdf,
  importarPresupuesto,
  buscarImagenesProducto,
  importarImagenUrl,
} from '@/services/api';
import { APLICA_A_LABELS } from '@/components/admin/etiquetas';
import DepositosPanel from '@/components/admin/DepositosPanel';
import ConversationsPanel from '@/components/admin/ConversationsPanel';
import UsersPanel from '@/components/admin/UsersPanel';
import CreditosPanel from '@/components/admin/CreditosPanel';
import MediosPagoPanel from '@/components/admin/MediosPagoPanel';
import PromocionesPanel from '@/components/admin/PromocionesPanel';
import PresupuestoPanel from '@/components/admin/PresupuestoPanel';
import ProductForm from '@/components/admin/ProductForm';

export default function AdminPanel() {
  const { user, isAdmin } = useAuthStore();
  const router = useRouter();

  const [activeTab, setActiveTab] = useState('productos');
  const [productos, setProductos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingProduct, setEditingProduct] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  const [searchTerm, setSearchTerm] = useState('');
  const [filterCategoria, setFilterCategoria] = useState('');
  const [sortColumn, setSortColumn] = useState('');
  const [sortDirection, setSortDirection] = useState('asc');
  const [stockEditId, setStockEditId] = useState(null);
  const [stockEditValue, setStockEditValue] = useState('');
  const [importingStock, setImportingStock] = useState(false);

  useEffect(() => {
    const unsub = useAuthStore.persist.onFinishHydration(() => {
      setHydrated(true);
    });
    if (useAuthStore.persist.hasHydrated()) {
      setHydrated(true);
    }
    return () => unsub?.();
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    if (!isAdmin()) {
      alert('Acceso denegado: Solo administradores');
      router.push('/');
      return;
    }
    fetchProductos();
  }, [hydrated]);

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

  const categorias = useMemo(() => {
    return [...new Set(productos.map(p => p.categoria).filter(Boolean))].sort();
  }, [productos]);

  const productosFiltrados = useMemo(() => {
    return productos
      .filter(p => !searchTerm || p.nombre?.toLowerCase().includes(searchTerm.toLowerCase()))
      .filter(p => !filterCategoria || p.categoria === filterCategoria)
      .sort((a, b) => {
        if (!sortColumn) return 0;
        const dir = sortDirection === 'asc' ? 1 : -1;

        switch (sortColumn) {
          case 'imagen':
            const aHasImg = !!(a.imagen || a.imagenOptimizada);
            const bHasImg = !!(b.imagen || b.imagenOptimizada);
            return (aHasImg === bHasImg ? 0 : aHasImg ? -1 : 1) * dir;
          case 'nombre':
            return (a.nombre || '').localeCompare(b.nombre || '') * dir;
          case 'precio':
            return ((a.precio || 0) - (b.precio || 0)) * dir;
          case 'categoria':
            return (a.categoria || '').localeCompare(b.categoria || '') * dir;
          case 'stock':
            return ((a.stock || 0) - (b.stock || 0)) * dir;
          case 'mostrar':
            return (a.mostrar || '').localeCompare(b.mostrar || '') * dir;
          case 'descripcion':
            const aHasDesc = !!(a.descripcion);
            const bHasDesc = !!(b.descripcion);
            return (aHasDesc === bHasDesc ? 0 : aHasDesc ? -1 : 1) * dir;
          default:
            return 0;
        }
      });
  }, [productos, searchTerm, filterCategoria, sortColumn, sortDirection]);

  const handleSort = (column) => {
    if (sortColumn === column) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortColumn(column);
      setSortDirection('asc');
    }
  };

  const SortIcon = ({ column }) => {
    if (sortColumn !== column) return <ChevronUp className="w-3 h-3 opacity-30" />;
    return sortDirection === 'asc'
      ? <ChevronUp className="w-3 h-3" />
      : <ChevronDown className="w-3 h-3" />;
  };

  const handleDelete = async (id, nombre) => {
    if (!confirm(`Eliminar el producto "${nombre}"?`)) return;
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

  const handleStockChange = async (id, nuevoStock) => {
    const stock = Math.max(0, parseInt(nuevoStock) || 0);
    setProductos(prev => prev.map(p => p._id === id ? { ...p, stock } : p));
    try {
      await actualizarStock(id, stock);
    } catch {
      alert('Error al actualizar stock');
      fetchProductos();
    }
  };

  const handleMostrarChange = async (id, mostrar) => {
    setProductos(prev => prev.map(p => p._id === id ? { ...p, mostrar } : p));
    try {
      await actualizarMostrar(id, mostrar);
    } catch {
      alert('Error al cambiar la visibilidad del producto');
      fetchProductos();
    }
  };

  const handleExportarExcel = () => {
    const data = productos.map(p => ({
      _id: p._id,
      nombre: p.nombre,
      categoria: p.categoria,
      stock: p.stock || 0,
      precio: p.precio,
    }));
    const ws = xlsxClient.utils.json_to_sheet(data);
    const wb = xlsxClient.utils.book_new();
    xlsxClient.utils.book_append_sheet(wb, ws, 'Stock');
    xlsxClient.writeFile(wb, 'stock-productos.xlsx');
  };

  const handleImportarExcel = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    e.target.value = '';
    setImportingStock(true);
    try {
      const reader = new FileReader();
      reader.onload = async (ev) => {
        try {
          const result = await importarStockExcel(ev.target.result);
          alert(`Stock actualizado: ${result.actualizados} productos.\n${result.errores?.length ? 'Errores:\n' + result.errores.join('\n') : ''}`);
          fetchProductos();
        } catch (err) {
          alert(err.response?.data?.error || 'Error al importar');
        } finally {
          setImportingStock(false);
        }
      };
      reader.readAsDataURL(file);
    } catch {
      setImportingStock(false);
    }
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
      <h1 className="text-3xl font-bold mb-6">Panel de Administracion</h1>

      {/* Tabs */}
      <div className="flex border-b mb-6">
        <button
          onClick={() => setActiveTab('productos')}
          className={`flex items-center gap-2 px-6 py-3 font-medium transition-colors ${
            activeTab === 'productos'
              ? 'border-b-2 border-blue-600 text-blue-600'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          <Package className="w-4 h-4" />
          Productos
        </button>
        <button
          onClick={() => setActiveTab('conversaciones')}
          className={`flex items-center gap-2 px-6 py-3 font-medium transition-colors ${
            activeTab === 'conversaciones'
              ? 'border-b-2 border-blue-600 text-blue-600'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          <MessageSquare className="w-4 h-4" />
          Conversaciones
        </button>
        <button
          onClick={() => setActiveTab('usuarios')}
          className={`flex items-center gap-2 px-6 py-3 font-medium transition-colors ${
            activeTab === 'usuarios'
              ? 'border-b-2 border-blue-600 text-blue-600'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          <Users className="w-4 h-4" />
          Usuarios
        </button>
        <button
          onClick={() => setActiveTab('creditos')}
          className={`flex items-center gap-2 px-6 py-3 font-medium transition-colors ${
            activeTab === 'creditos'
              ? 'border-b-2 border-blue-600 text-blue-600'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          <CreditCard className="w-4 h-4" />
          Creditos
        </button>
        <button
          onClick={() => setActiveTab('depositos')}
          className={`flex items-center gap-2 px-6 py-3 font-medium transition-colors ${
            activeTab === 'depositos'
              ? 'border-b-2 border-blue-600 text-blue-600'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          <Package className="w-4 h-4" />
          Depositos
        </button>
        <button
          onClick={() => setActiveTab('medios-pago')}
          className={`flex items-center gap-2 px-6 py-3 font-medium transition-colors ${
            activeTab === 'medios-pago'
              ? 'border-b-2 border-blue-600 text-blue-600'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          <CreditCard className="w-4 h-4" />
          Medios de pago
        </button>
        <button
          onClick={() => setActiveTab('promociones')}
          className={`flex items-center gap-2 px-6 py-3 font-medium transition-colors ${
            activeTab === 'promociones'
              ? 'border-b-2 border-blue-600 text-blue-600'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          <Sparkles className="w-4 h-4" />
          Promociones
        </button>
        <button
          onClick={() => setActiveTab('presupuesto')}
          className={`flex items-center gap-2 px-6 py-3 font-medium transition-colors ${
            activeTab === 'presupuesto'
              ? 'border-b-2 border-blue-600 text-blue-600'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          <FileUp className="w-4 h-4" />
          Importar PDF
        </button>
      </div>

      {/* Tab: Productos */}
      {activeTab === 'productos' && (
        <>
          <div className="flex justify-end gap-2 mb-4 flex-wrap">
            <button
              onClick={handleExportarExcel}
              className="flex items-center gap-2 border border-green-600 text-green-700 px-4 py-2 rounded hover:bg-green-50 text-sm"
            >
              <FileDown className="w-4 h-4" /> Exportar stock
            </button>
            <label className={`flex items-center gap-2 border border-orange-500 text-orange-600 px-4 py-2 rounded hover:bg-orange-50 text-sm cursor-pointer ${importingStock ? 'opacity-50 pointer-events-none' : ''}`}>
              {importingStock ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileUp className="w-4 h-4" />}
              {importingStock ? 'Importando...' : 'Importar stock'}
              <input type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={handleImportarExcel} />
            </label>
            <button onClick={handleCreate} className="bg-blue-600 text-white px-6 py-2 rounded hover:bg-blue-700 text-sm">
              + Crear Producto
            </button>
          </div>

          {showForm && (
            <ProductForm
              producto={editingProduct}
              categorias={categorias}
              onClose={() => setShowForm(false)}
              onSuccess={() => { setShowForm(false); fetchProductos(); }}
            />
          )}

          {/* Filtros */}
          <div className="bg-white shadow rounded-lg p-4 mb-4">
            <div className="flex flex-col md:flex-row gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <input
                  type="text"
                  placeholder="Buscar por nombre..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full border rounded px-3 py-2 pl-9 text-sm"
                />
              </div>
              <select
                value={filterCategoria}
                onChange={(e) => setFilterCategoria(e.target.value)}
                className="border rounded px-3 py-2 text-sm min-w-[180px]"
              >
                <option value="">Todas las categorias</option>
                {categorias.map(cat => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
              {sortColumn && (
                <button
                  onClick={() => { setSortColumn(''); setSortDirection('asc'); }}
                  className="text-xs text-gray-500 hover:text-gray-700 px-3 py-2 border rounded"
                >
                  Limpiar orden
                </button>
              )}
            </div>
            <p className="text-xs text-gray-500 mt-2">
              Mostrando {productosFiltrados.length} de {productos.length} productos
              {sortColumn && ` • Ordenado por ${sortColumn} (${sortDirection === 'asc' ? '↑' : '↓'})`}
            </p>
          </div>

          <div className="bg-white shadow rounded-lg overflow-hidden overflow-x-auto">
            <table className="min-w-full">
              <thead className="bg-gray-100">
                <tr>
                  <th onClick={() => handleSort('imagen')} className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase cursor-pointer hover:bg-gray-200 select-none">
                    <span className="flex items-center gap-1">Img <SortIcon column="imagen" /></span>
                  </th>
                  <th onClick={() => handleSort('nombre')} className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase cursor-pointer hover:bg-gray-200 select-none">
                    <span className="flex items-center gap-1">Nombre <SortIcon column="nombre" /></span>
                  </th>
                  <th onClick={() => handleSort('precio')} className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase cursor-pointer hover:bg-gray-200 select-none">
                    <span className="flex items-center gap-1">Precio <SortIcon column="precio" /></span>
                  </th>
                  <th onClick={() => handleSort('categoria')} className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase cursor-pointer hover:bg-gray-200 select-none">
                    <span className="flex items-center gap-1">Categoria <SortIcon column="categoria" /></span>
                  </th>
                  <th onClick={() => handleSort('stock')} className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase cursor-pointer hover:bg-gray-200 select-none">
                    <span className="flex items-center gap-1">Stock <SortIcon column="stock" /></span>
                  </th>
                  <th onClick={() => handleSort('mostrar')} className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase cursor-pointer hover:bg-gray-200 select-none">
                    <span className="flex items-center gap-1">Mostrar <SortIcon column="mostrar" /></span>
                  </th>
                  <th onClick={() => handleSort('descripcion')} className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase cursor-pointer hover:bg-gray-200 select-none">
                    <span className="flex items-center gap-1">Desc. <SortIcon column="descripcion" /></span>
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-700 uppercase">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {productosFiltrados.map((producto) => {
                  const tieneImagen = !!(producto.imagen || (typeof producto.imagenOptimizada === 'object' ? producto.imagenOptimizada?.thumb : producto.imagenOptimizada));
                  return (
                  <tr key={producto._id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      {tieneImagen ? (
                        <img
                          src={typeof producto.imagenOptimizada === 'object' ? producto.imagenOptimizada?.thumb : (producto.imagenOptimizada || producto.imagen)}
                          alt={producto.nombre}
                          className="w-12 h-12 object-cover rounded"
                        />
                      ) : (
                        <div className="w-12 h-12 bg-gray-100 rounded flex items-center justify-center">
                          <ImagePlus className="w-5 h-5 text-gray-300" />
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 font-medium text-sm max-w-[200px] truncate" title={producto.nombre}>{producto.nombre}</td>
                    <td className="px-4 py-3 text-sm">${producto.precio?.toLocaleString('es-AR')}</td>
                    <td className="px-4 py-3 text-sm">{producto.categoria}</td>
                    <td className="px-4 py-3">
                      {stockEditId === producto._id ? (
                        <input
                          type="number"
                          min="0"
                          value={stockEditValue}
                          onChange={(e) => setStockEditValue(e.target.value)}
                          onBlur={() => {
                            handleStockChange(producto._id, stockEditValue);
                            setStockEditId(null);
                          }}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') { handleStockChange(producto._id, stockEditValue); setStockEditId(null); }
                            if (e.key === 'Escape') setStockEditId(null);
                          }}
                          className="w-16 border rounded px-2 py-1 text-sm text-center"
                          autoFocus
                        />
                      ) : (
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => handleStockChange(producto._id, (producto.stock || 0) - 1)}
                            className="w-6 h-6 rounded border text-gray-500 hover:bg-gray-100 flex items-center justify-center"
                          ><Minus className="w-3 h-3" /></button>
                          <span
                            className="w-10 text-center text-sm cursor-pointer hover:text-blue-600 font-medium"
                            title="Click para editar"
                            onClick={() => { setStockEditId(producto._id); setStockEditValue(String(producto.stock || 0)); }}
                          >{producto.stock || 0}</span>
                          <button
                            onClick={() => handleStockChange(producto._id, (producto.stock || 0) + 1)}
                            className="w-6 h-6 rounded border text-gray-500 hover:bg-gray-100 flex items-center justify-center"
                          ><Plus className="w-3 h-3" /></button>
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <button
                        type="button"
                        role="switch"
                        aria-checked={producto.mostrar === 'si'}
                        aria-label={`Mostrar ${producto.nombre} en la web`}
                        onClick={() => handleMostrarChange(producto._id, producto.mostrar === 'si' ? 'no' : 'si')}
                        className="inline-flex items-center gap-2"
                      >
                        <span className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                          producto.mostrar === 'si' ? 'bg-green-500' : 'bg-gray-300'
                        }`}>
                          <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
                            producto.mostrar === 'si' ? 'translate-x-6' : 'translate-x-1'
                          }`} />
                        </span>
                        <span className={`text-xs font-medium w-5 ${producto.mostrar === 'si' ? 'text-green-700' : 'text-gray-500'}`}>
                          {producto.mostrar === 'si' ? 'Sí' : 'No'}
                        </span>
                      </button>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-1 rounded text-xs ${
                        producto.descripcion ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'
                      }`}>
                        {producto.descripcion ? 'Si' : 'No'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right space-x-2">
                      <button onClick={() => handleEdit(producto)} className="text-blue-600 hover:text-blue-800 text-sm">Editar</button>
                      <button onClick={() => handleDelete(producto._id, producto.nombre)} className="text-red-600 hover:text-red-800 text-sm">Eliminar</button>
                    </td>
                  </tr>
                  );
                })}
              </tbody>
            </table>

            {productosFiltrados.length === 0 && (
              <div className="text-center py-12 text-gray-500">
                {productos.length === 0 ? 'No hay productos creados. Crea uno para empezar.' : 'No se encontraron productos con esos filtros.'}
              </div>
            )}
          </div>
        </>
      )}

      {/* Tab: Conversaciones */}
      {activeTab === 'conversaciones' && <ConversationsPanel />}

      {/* Tab: Usuarios */}
      {activeTab === 'usuarios' && <UsersPanel currentUserId={user?.id} />}

      {activeTab === 'creditos' && <CreditosPanel />}

      {activeTab === 'depositos' && <DepositosPanel />}

      {activeTab === 'medios-pago' && <MediosPagoPanel />}

      {activeTab === 'promociones' && <PromocionesPanel />}
      {activeTab === 'presupuesto' && <PresupuestoPanel />}
    </div>
  );
}

// =================== USERS PANEL ===================
