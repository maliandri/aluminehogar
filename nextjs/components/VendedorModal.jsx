'use client';

import { useState, useEffect } from 'react';
import { X, FileDown, Send, Trash2, Percent, CreditCard, List } from 'lucide-react';
import { CloudinaryImage } from './CloudinaryImage';
import jsPDF from 'jspdf';
import { enviarPresupuesto, crearCredito, listarCreditos, marcarCuotaCredito } from '@/services/api';

export const VendedorModal = ({ isOpen, onClose, productos, categorias }) => {
  const [activeTab, setActiveTab] = useState('presupuesto');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [carritoVendedor, setCarritoVendedor] = useState({});
  const [vendedor, setVendedor] = useState({ nombre: '' });
  const [cliente, setCliente] = useState({
    nombre: '',
    telefono: '',
    provincia: 'Neuquen',
    localidad: '',
    direccion: '',
    email: ''
  });

  const provincias = [
    'Buenos Aires', 'CABA', 'Catamarca', 'Chaco', 'Chubut', 'Cordoba',
    'Corrientes', 'Entre Rios', 'Formosa', 'Jujuy', 'La Pampa', 'La Rioja',
    'Mendoza', 'Misiones', 'Neuquen', 'Rio Negro', 'Salta', 'San Juan',
    'San Luis', 'Santa Cruz', 'Santa Fe', 'Santiago del Estero',
    'Tierra del Fuego', 'Tucuman'
  ];

  const productosFiltrados = selectedCategory
    ? productos.filter(p => p.categoria === selectedCategory)
    : productos;

  const calcularTotal = () => {
    return Object.values(carritoVendedor).reduce(
      (total, item) => {
        const descuento = item.descuento || 0;
        const precioConDescuento = item.precio * (1 - descuento / 100);
        return total + (precioConDescuento * item.cantidad);
      },
      0
    );
  };

  const calcularTotalSinDescuento = () => {
    return Object.values(carritoVendedor).reduce(
      (total, item) => total + (item.precio * item.cantidad),
      0
    );
  };

  const handleCantidadChange = (producto, cantidad) => {
    const cant = parseInt(cantidad) || 0;
    if (cant <= 0) {
      const nuevoCarrito = { ...carritoVendedor };
      delete nuevoCarrito[producto._id];
      setCarritoVendedor(nuevoCarrito);
    } else {
      setCarritoVendedor({
        ...carritoVendedor,
        [producto._id]: {
          ...producto,
          cantidad: cant,
          descuento: carritoVendedor[producto._id]?.descuento || 0
        }
      });
    }
  };

  const handleDescuentoChange = (productoId, descuento) => {
    const desc = parseFloat(descuento) || 0;
    const descuentoFinal = Math.min(Math.max(desc, 0), 15);
    if (carritoVendedor[productoId]) {
      setCarritoVendedor({
        ...carritoVendedor,
        [productoId]: {
          ...carritoVendedor[productoId],
          descuento: descuentoFinal
        }
      });
    }
  };

  const handleResetear = () => {
    if (confirm('Estas seguro de que deseas resetear el presupuesto?')) {
      setCarritoVendedor({});
      setVendedor({ nombre: '' });
      setCliente({ nombre: '', telefono: '', provincia: 'Neuquen', localidad: '', direccion: '', email: '' });
    }
  };

  const handleDescargarPDF = () => {
    const doc = new jsPDF();
    const items = Object.values(carritoVendedor);
    if (items.length === 0) { alert('No hay productos en el presupuesto'); return; }

    doc.setFontSize(20);
    doc.text('Presupuesto - Alumine Hogar', 20, 20);
    doc.setFontSize(12);
    doc.text(`Vendedor: ${vendedor.nombre || 'N/A'}`, 20, 35);
    doc.text(`Fecha: ${new Date().toLocaleDateString()}`, 20, 42);
    doc.setFontSize(14);
    doc.text('Datos del Cliente:', 20, 55);
    doc.setFontSize(11);
    doc.text(`Nombre: ${cliente.nombre || 'N/A'}`, 20, 63);
    doc.text(`Telefono: ${cliente.telefono || 'N/A'}`, 20, 70);
    doc.text(`Email: ${cliente.email || 'N/A'}`, 20, 77);
    doc.text(`Direccion: ${cliente.direccion || 'N/A'}`, 20, 84);
    doc.text(`${cliente.localidad || 'N/A'}, ${cliente.provincia}`, 20, 91);
    doc.setFontSize(14);
    doc.text('Productos:', 20, 105);

    let y = 115;
    doc.setFontSize(10);
    items.forEach((item, index) => {
      const descuento = item.descuento || 0;
      const precioConDescuento = item.precio * (1 - descuento / 100);
      const subtotal = precioConDescuento * item.cantidad;
      doc.text(`${index + 1}. ${item.nombre}`, 20, y);
      if (descuento > 0) {
        doc.text(`${item.cantidad} x $${item.precio.toLocaleString('es-AR', { maximumFractionDigits: 0 })} (${descuento}% OFF) = $${subtotal.toLocaleString('es-AR', { maximumFractionDigits: 0 })}`, 20, y + 7);
      } else {
        doc.text(`${item.cantidad} x $${item.precio.toLocaleString('es-AR', { maximumFractionDigits: 0 })} = $${subtotal.toLocaleString('es-AR', { maximumFractionDigits: 0 })}`, 20, y + 7);
      }
      y += 15;
      if (y > 270) { doc.addPage(); y = 20; }
    });

    const totalSinDescuento = calcularTotalSinDescuento();
    const totalConDescuento = calcularTotal();
    const ahorroTotal = totalSinDescuento - totalConDescuento;
    y += 10;
    doc.setFontSize(12);
    if (ahorroTotal > 0) {
      doc.text(`Subtotal: $${totalSinDescuento.toLocaleString('es-AR', { maximumFractionDigits: 0 })}`, 20, y);
      doc.setTextColor(220, 38, 38);
      doc.text(`Descuento: -$${ahorroTotal.toLocaleString('es-AR', { maximumFractionDigits: 0 })}`, 20, y + 7);
      doc.setTextColor(0, 0, 0);
      y += 14;
    }
    doc.setFontSize(14);
    doc.text(`TOTAL: $${totalConDescuento.toLocaleString('es-AR', { maximumFractionDigits: 0 })}`, 20, y);
    doc.save(`presupuesto-${Date.now()}.pdf`);
  };

  const handleEnviarEmail = async () => {
    const items = Object.values(carritoVendedor);
    if (items.length === 0) { alert('No hay productos en el presupuesto'); return; }
    if (!cliente.email) { alert('Por favor ingresa el email del cliente'); return; }

    try {
      const productosFormateados = items.map(item => {
        const descuento = item.descuento || 0;
        const precioConDescuento = item.precio * (1 - descuento / 100);
        return {
          nombre: item.nombre,
          cantidad: item.cantidad,
          precioUnitario: item.precio,
          descuento,
          precioConDescuento,
          subtotal: precioConDescuento * item.cantidad
        };
      });

      await enviarPresupuesto({
        cliente: {
          nombre: cliente.nombre, email: cliente.email, telefono: cliente.telefono,
          direccion: cliente.direccion, localidad: cliente.localidad, provincia: cliente.provincia
        },
        vendedor: { nombre: vendedor.nombre },
        productos: productosFormateados,
        total: calcularTotal()
      });
      alert('Presupuesto enviado exitosamente por email');
    } catch (error) {
      console.error('Error al enviar email:', error);
      alert('Error al enviar el presupuesto por email');
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black bg-opacity-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-6xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        <div className="bg-primary text-white px-6 py-4 flex items-center justify-between">
          <h2 className="text-2xl font-bold">Panel de Vendedores</h2>
          <button onClick={onClose} className="text-white hover:bg-red-700 rounded-full p-2 transition-colors">
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="flex space-x-1 px-6 pt-3 border-b bg-gray-50">
          <button
            onClick={() => setActiveTab('presupuesto')}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${activeTab === 'presupuesto' ? 'border-primary text-primary' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
          >
            Presupuesto
          </button>
          <button
            onClick={() => setActiveTab('credito')}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors flex items-center gap-1 ${activeTab === 'credito' ? 'border-primary text-primary' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
          >
            <CreditCard className="w-4 h-4" /> Otorgar credito
          </button>
          <button
            onClick={() => setActiveTab('mis-creditos')}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors flex items-center gap-1 ${activeTab === 'mis-creditos' ? 'border-primary text-primary' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
          >
            <List className="w-4 h-4" /> Mis creditos
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {activeTab === 'presupuesto' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div>
              <h3 className="text-xl font-semibold mb-4">Productos</h3>
              <div className="mb-4">
                <select value={selectedCategory} onChange={(e) => setSelectedCategory(e.target.value)} className="input-field">
                  <option value="">Todas las categorias</option>
                  {categorias.map(cat => (<option key={cat} value={cat}>{cat}</option>))}
                </select>
              </div>
              <div className="space-y-3 max-h-96 overflow-y-auto">
                {productosFiltrados.map(producto => (
                  <div key={producto._id} className="flex items-center gap-3 bg-gray-50 p-3 rounded-lg">
                    <div className="w-16 h-16 flex-shrink-0">
                      <CloudinaryImage product={producto} size="thumb" className="w-full h-full rounded object-cover" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="font-medium text-sm truncate">{producto.nombre}</h4>
                      <p className="text-primary font-bold">${producto.precio.toLocaleString('es-AR')}</p>
                      <p className="text-xs text-gray-600">{producto.categoria}</p>
                    </div>
                    <div className="flex flex-col gap-1">
                      <input type="number" min="0" value={carritoVendedor[producto._id]?.cantidad || 0}
                        onChange={(e) => handleCantidadChange(producto, e.target.value)}
                        className="w-20 px-2 py-1 border rounded text-center" placeholder="Cant." />
                      {carritoVendedor[producto._id] && (
                        <div className="flex items-center">
                          <Percent className="w-3 h-3 text-gray-400 mr-1" />
                          <input type="number" min="0" max="15" step="0.5"
                            value={carritoVendedor[producto._id]?.descuento || 0}
                            onChange={(e) => handleDescuentoChange(producto._id, e.target.value)}
                            className="w-16 px-1 py-1 border rounded text-center text-xs" placeholder="0" />
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <h3 className="text-xl font-semibold mb-4">Resumen del Pedido</h3>
              <div className="mb-4">
                <label className="block text-sm font-medium mb-2">Nombre del Vendedor</label>
                <input type="text" value={vendedor.nombre} onChange={(e) => setVendedor({ nombre: e.target.value })}
                  className="input-field" placeholder="Tu nombre" />
              </div>
              <div className="bg-gray-50 p-4 rounded-lg mb-4">
                <h4 className="font-semibold mb-3">Datos del Cliente</h4>
                <div className="space-y-3">
                  <input type="text" value={cliente.nombre} onChange={(e) => setCliente({ ...cliente, nombre: e.target.value })}
                    className="input-field" placeholder="Nombre completo" />
                  <input type="tel" value={cliente.telefono} onChange={(e) => setCliente({ ...cliente, telefono: e.target.value })}
                    className="input-field" placeholder="Telefono" />
                  <input type="email" value={cliente.email} onChange={(e) => setCliente({ ...cliente, email: e.target.value })}
                    className="input-field" placeholder="Email" />
                  <select value={cliente.provincia} onChange={(e) => setCliente({ ...cliente, provincia: e.target.value })} className="input-field">
                    {provincias.map(prov => (<option key={prov} value={prov}>{prov}</option>))}
                  </select>
                  <input type="text" value={cliente.localidad} onChange={(e) => setCliente({ ...cliente, localidad: e.target.value })}
                    className="input-field" placeholder="Localidad" />
                  <input type="text" value={cliente.direccion} onChange={(e) => setCliente({ ...cliente, direccion: e.target.value })}
                    className="input-field" placeholder="Direccion" />
                </div>
              </div>

              <div className="bg-gray-50 p-4 rounded-lg mb-4">
                <h4 className="font-semibold mb-3">Productos Seleccionados</h4>
                {Object.keys(carritoVendedor).length === 0 ? (
                  <p className="text-gray-500 text-sm">No hay productos seleccionados</p>
                ) : (
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {Object.values(carritoVendedor).map(item => {
                      const descuento = item.descuento || 0;
                      const precioConDescuento = item.precio * (1 - descuento / 100);
                      const subtotal = precioConDescuento * item.cantidad;
                      return (
                        <div key={item._id} className="text-sm">
                          <div className="flex justify-between">
                            <span className="truncate flex-1">{item.nombre}</span>
                            <span className="font-medium ml-2">{item.cantidad} x ${item.precio.toLocaleString('es-AR')}</span>
                          </div>
                          {descuento > 0 && (
                            <div className="flex justify-between text-red-600 text-xs">
                              <span>Descuento {descuento}%</span>
                              <span>-${(item.precio * item.cantidad * descuento / 100).toLocaleString('es-AR')}</span>
                            </div>
                          )}
                          <div className="flex justify-between font-semibold">
                            <span>Subtotal:</span>
                            <span>${subtotal.toLocaleString('es-AR')}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              <div className="bg-primary text-white p-4 rounded-lg mb-4">
                {calcularTotalSinDescuento() !== calcularTotal() && (
                  <>
                    <div className="flex justify-between items-center text-sm mb-2 opacity-75">
                      <span>Subtotal:</span>
                      <span>${calcularTotalSinDescuento().toLocaleString('es-AR')}</span>
                    </div>
                    <div className="flex justify-between items-center text-sm mb-2 text-yellow-300">
                      <span>Ahorro:</span>
                      <span>-${(calcularTotalSinDescuento() - calcularTotal()).toLocaleString('es-AR')}</span>
                    </div>
                  </>
                )}
                <div className="flex justify-between items-center text-xl font-bold border-t border-white/20 pt-2">
                  <span>TOTAL:</span>
                  <span>${calcularTotal().toLocaleString('es-AR')}</span>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <button onClick={handleDescargarPDF} className="btn-primary flex items-center justify-center gap-2">
                  <FileDown className="w-4 h-4" /><span>PDF</span>
                </button>
                <button onClick={handleEnviarEmail} className="btn-secondary flex items-center justify-center gap-2">
                  <Send className="w-4 h-4" /><span>Email</span>
                </button>
                <button onClick={handleResetear} className="bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 transition-colors flex items-center justify-center gap-2">
                  <Trash2 className="w-4 h-4" /><span>Reset</span>
                </button>
              </div>
            </div>
          </div>
          )}

          {activeTab === 'credito' && (
            <OtorgarCreditoTab
              carritoVendedor={carritoVendedor}
              cliente={cliente}
              setCliente={setCliente}
              calcularTotal={calcularTotal}
              onCreado={() => setActiveTab('mis-creditos')}
            />
          )}

          {activeTab === 'mis-creditos' && <MisCreditosTab isOpen={isOpen} />}
        </div>
      </div>
    </div>
  );
};

function OtorgarCreditoTab({ carritoVendedor, cliente, setCliente, calcularTotal, onCreado }) {
  const [anticipoPorcentaje, setAnticipoPorcentaje] = useState(20);
  const [cantidadCuotas, setCantidadCuotas] = useState(3);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const montoTotal = calcularTotal();
  const anticipo = Math.round(montoTotal * (anticipoPorcentaje / 100));

  const handleOtorgar = async () => {
    setError('');
    const items = Object.values(carritoVendedor);

    if (items.length === 0) {
      setError('Agrega productos en la pestana Presupuesto antes de otorgar el credito');
      return;
    }
    if (!cliente.nombre) {
      setError('Ingresa el nombre del cliente');
      return;
    }

    setLoading(true);
    try {
      await crearCredito({
        clienteNombre: cliente.nombre,
        clienteTelefono: cliente.telefono,
        clienteEmail: cliente.email,
        productos: items.map(i => ({ nombre: i.nombre, precio: i.precio, cantidad: i.cantidad })),
        montoTotal,
        anticipo,
        cantidadCuotas
      });
      alert('Credito otorgado correctamente');
      onCreado();
    } catch (err) {
      setError(err.response?.data?.error || 'No se pudo otorgar el credito');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-lg mx-auto space-y-4">
      <h3 className="text-xl font-semibold">Otorgar credito al cliente</h3>
      <p className="text-sm text-gray-500">
        Usa los productos cargados en la pestana "Presupuesto" como base del monto total.
      </p>

      {error && <div className="bg-red-50 text-red-700 text-sm rounded-lg p-3">{error}</div>}

      <div className="bg-gray-50 p-4 rounded-lg space-y-3">
        <input type="text" value={cliente.nombre} onChange={(e) => setCliente({ ...cliente, nombre: e.target.value })}
          className="input-field" placeholder="Nombre del cliente" />
        <input type="tel" value={cliente.telefono} onChange={(e) => setCliente({ ...cliente, telefono: e.target.value })}
          className="input-field" placeholder="Telefono" />
        <input type="email" value={cliente.email} onChange={(e) => setCliente({ ...cliente, email: e.target.value })}
          className="input-field" placeholder="Email (opcional)" />
      </div>

      <div className="bg-gray-50 p-4 rounded-lg space-y-3">
        <div className="flex justify-between text-sm">
          <span>Monto total (segun presupuesto)</span>
          <span className="font-bold">${montoTotal.toLocaleString('es-AR')}</span>
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Anticipo (%)</label>
          <input type="number" min="0" max="90" value={anticipoPorcentaje}
            onChange={(e) => setAnticipoPorcentaje(Number(e.target.value))} className="input-field" />
          <p className="text-xs text-gray-500 mt-1">Anticipo: ${anticipo.toLocaleString('es-AR')}</p>
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Cantidad de cuotas</label>
          <input type="number" min="1" max="24" value={cantidadCuotas}
            onChange={(e) => setCantidadCuotas(Number(e.target.value))} className="input-field" />
          {cantidadCuotas > 0 && montoTotal > 0 && (
            <p className="text-xs text-gray-500 mt-1">
              {cantidadCuotas} cuotas de ${Math.round((montoTotal - anticipo) / cantidadCuotas).toLocaleString('es-AR')}
            </p>
          )}
        </div>
      </div>

      <button onClick={handleOtorgar} disabled={loading} className="w-full btn-primary disabled:opacity-50">
        {loading ? 'Otorgando...' : 'Otorgar credito'}
      </button>
    </div>
  );
}

function MisCreditosTab({ isOpen }) {
  const [creditos, setCreditos] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (isOpen) fetchCreditos();
  }, [isOpen]);

  const fetchCreditos = async () => {
    try {
      setLoading(true);
      const data = await listarCreditos();
      setCreditos(data.creditos || []);
    } catch {
      // silencioso
    } finally {
      setLoading(false);
    }
  };

  const handleMarcarPagada = async (id, numero) => {
    try {
      await marcarCuotaCredito(id, numero);
      fetchCreditos();
    } catch (err) {
      alert(err.response?.data?.error || 'No se pudo marcar la cuota como pagada');
    }
  };

  const estadoBadge = (estado) => {
    const styles = {
      activo: 'bg-green-100 text-green-700',
      pendiente_aprobacion: 'bg-yellow-100 text-yellow-700',
      rechazado: 'bg-red-100 text-red-700',
      completado: 'bg-blue-100 text-blue-700'
    };
    const labels = { activo: 'Activo', pendiente_aprobacion: 'Pendiente de aprobacion', rechazado: 'Rechazado', completado: 'Completado' };
    return <span className={`px-2 py-1 rounded text-xs font-medium ${styles[estado] || 'bg-gray-100'}`}>{labels[estado] || estado}</span>;
  };

  if (loading) return <div className="text-center py-12 text-gray-500">Cargando creditos...</div>;

  if (creditos.length === 0) {
    return <div className="text-center py-12 text-gray-500">No otorgaste ningun credito todavia.</div>;
  }

  return (
    <div className="space-y-4">
      {creditos.map((credito) => (
        <div key={credito._id} className="bg-gray-50 rounded-lg p-4">
          <div className="flex justify-between items-start mb-2">
            <div>
              <p className="font-semibold">{credito.clienteNombre}</p>
              <p className="text-xs text-gray-500">{credito.clienteTelefono}</p>
            </div>
            {estadoBadge(credito.estado)}
          </div>
          <div className="text-sm text-gray-600 mb-3">
            Total ${credito.montoTotal.toLocaleString('es-AR')} — Anticipo ${credito.anticipo.toLocaleString('es-AR')} — {credito.cantidadCuotas} cuotas
          </div>
          {credito.estado !== 'rechazado' && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {credito.cuotas.map((cuota) => (
                <button
                  key={cuota.numero}
                  onClick={() => cuota.estado === 'pendiente' && handleMarcarPagada(credito._id, cuota.numero)}
                  disabled={cuota.estado === 'pagada'}
                  className={`text-xs rounded px-2 py-2 border ${cuota.estado === 'pagada' ? 'bg-green-100 border-green-300 text-green-700' : 'bg-white border-gray-300 hover:bg-gray-100'}`}
                >
                  <div className="font-medium">Cuota {cuota.numero}</div>
                  <div>${cuota.monto.toLocaleString('es-AR')}</div>
                  <div>{cuota.estado === 'pagada' ? 'Pagada' : 'Marcar pagada'}</div>
                </button>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
