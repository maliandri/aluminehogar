'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useCartStore } from '@/store/cartStore';
import { useAuthStore } from '@/store/authStore';
import { crearPreferenciaPago } from '@/services/api';

export default function CheckoutPage() {
  const router = useRouter();
  const cart = useCartStore((state) => state.cart);
  const getTotalPrice = useCartStore((state) => state.getTotalPrice);
  const { isAuthenticated, user } = useAuthStore();

  const [payer, setPayer] = useState({
    nombre: user?.nombre || '',
    email: user?.email || '',
    telefono: user?.telefono || ''
  });
  const [shippingAddress, setShippingAddress] = useState({
    calle: '', numero: '', piso: '', depto: '', codigoPostal: '', ciudad: '', provincia: ''
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const cartItems = Object.values(cart);
  const totalPrice = getTotalPrice();

  const handlePagar = async () => {
    setError('');

    if (cartItems.length === 0) {
      setError('Tu carrito esta vacio');
      return;
    }
    if (!payer.nombre || !payer.email) {
      setError('Completa nombre y email para continuar');
      return;
    }

    setLoading(true);
    try {
      const items = cartItems.map((item) => ({
        nombre: item.nombre,
        descripcion: item.descripcion || '',
        quantity: item.cantidad,
        precio: item.precio,
        imagen: item.imagenOptimizada?.card || item.imagen || ''
      }));

      const data = await crearPreferenciaPago(items, payer, shippingAddress);
      window.location.href = data.initPoint;
    } catch (err) {
      setError(err.response?.data?.error || 'No se pudo iniciar el pago. Intenta nuevamente.');
      setLoading(false);
    }
  };

  if (!isAuthenticated) {
    return (
      <div className="container mx-auto p-8 max-w-md text-center">
        <p className="text-gray-700 mb-4">Necesitas iniciar sesion para continuar con el pago.</p>
        <button onClick={() => router.push('/')} className="bg-primary text-white px-6 py-2 rounded font-medium">
          Volver al inicio
        </button>
      </div>
    );
  }

  if (cartItems.length === 0) {
    return (
      <div className="container mx-auto p-8 max-w-md text-center">
        <p className="text-gray-700 mb-4">Tu carrito esta vacio.</p>
        <button onClick={() => router.push('/')} className="bg-primary text-white px-6 py-2 rounded font-medium">
          Ver productos
        </button>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-8 max-w-2xl">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Finalizar compra</h1>

      <div className="bg-white shadow rounded-lg p-6 mb-6">
        <h2 className="text-sm font-semibold text-gray-700 mb-3">Resumen</h2>
        {cartItems.map((item) => (
          <div key={item._id} className="flex justify-between text-sm py-1 border-b last:border-0">
            <span>{item.nombre} x{item.cantidad}</span>
            <span>${(item.precio * item.cantidad).toLocaleString('es-AR')}</span>
          </div>
        ))}
        <div className="flex justify-between font-bold text-lg mt-3 pt-3 border-t">
          <span>Total</span>
          <span>${totalPrice.toLocaleString('es-AR')}</span>
        </div>
      </div>

      {error && <div className="bg-red-50 text-red-700 text-sm rounded-lg p-3 mb-4">{error}</div>}

      <div className="bg-white shadow rounded-lg p-6 mb-6 space-y-3">
        <h2 className="text-sm font-semibold text-gray-700 mb-1">Tus datos</h2>
        <input
          type="text" placeholder="Nombre y apellido" value={payer.nombre}
          onChange={(e) => setPayer({ ...payer, nombre: e.target.value })}
          className="w-full border rounded px-3 py-2"
        />
        <input
          type="email" placeholder="Email" value={payer.email}
          onChange={(e) => setPayer({ ...payer, email: e.target.value })}
          className="w-full border rounded px-3 py-2"
        />
        <input
          type="tel" placeholder="Telefono" value={payer.telefono}
          onChange={(e) => setPayer({ ...payer, telefono: e.target.value })}
          className="w-full border rounded px-3 py-2"
        />
      </div>

      <div className="bg-white shadow rounded-lg p-6 mb-6 space-y-3">
        <h2 className="text-sm font-semibold text-gray-700 mb-1">Direccion de envio (opcional)</h2>
        <div className="grid grid-cols-2 gap-3">
          <input type="text" placeholder="Calle" value={shippingAddress.calle}
            onChange={(e) => setShippingAddress({ ...shippingAddress, calle: e.target.value })}
            className="border rounded px-3 py-2" />
          <input type="text" placeholder="Numero" value={shippingAddress.numero}
            onChange={(e) => setShippingAddress({ ...shippingAddress, numero: e.target.value })}
            className="border rounded px-3 py-2" />
          <input type="text" placeholder="Ciudad" value={shippingAddress.ciudad}
            onChange={(e) => setShippingAddress({ ...shippingAddress, ciudad: e.target.value })}
            className="border rounded px-3 py-2" />
          <input type="text" placeholder="Provincia" value={shippingAddress.provincia}
            onChange={(e) => setShippingAddress({ ...shippingAddress, provincia: e.target.value })}
            className="border rounded px-3 py-2" />
          <input type="text" placeholder="Codigo postal" value={shippingAddress.codigoPostal}
            onChange={(e) => setShippingAddress({ ...shippingAddress, codigoPostal: e.target.value })}
            className="border rounded px-3 py-2 col-span-2" />
        </div>
      </div>

      <button
        onClick={handlePagar}
        disabled={loading}
        className="w-full bg-primary text-white rounded px-4 py-3 font-bold hover:opacity-90 disabled:opacity-50"
      >
        {loading ? 'Redirigiendo a Mercado Pago...' : 'Pagar con Mercado Pago'}
      </button>
    </div>
  );
}
