'use client';
import { X, Plus, Minus, Trash2, ShoppingBag, Copy, Check, CreditCard } from 'lucide-react';
import { useCartStore } from '@/store/cartStore';
import { trackInitiateCheckout, trackContact } from '@/utils/facebookPixel';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

const MP_ALIAS = process.env.NEXT_PUBLIC_MP_ALIAS || 'alumine.hogar.mp';

export const CartModal = ({ isOpen, onClose }) => {
  const router = useRouter();
  const cart = useCartStore((state) => state.cart);
  const updateQuantity = useCartStore((state) => state.updateQuantity);
  const removeFromCart = useCartStore((state) => state.removeFromCart);
  const clearCart = useCartStore((state) => state.clearCart);
  const getTotalPrice = useCartStore((state) => state.getTotalPrice);
  const getTotalItems = useCartStore((state) => state.getTotalItems);

  const [showAlias, setShowAlias] = useState(false);
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const cartItems = Object.values(cart);
  const totalPrice = getTotalPrice();
  const totalItems = getTotalItems();

  const handleWhatsAppCheckout = () => {
    if (cartItems.length === 0) return;

    const whatsappNumber = '5492995769999';
    let mensaje = `Hola! Quiero hacer un pedido:\n\n`;

    cartItems.forEach((item) => {
      mensaje += `- ${item.nombre}\n`;
      mensaje += `  Cantidad: ${item.cantidad}\n`;
      mensaje += `  Precio unitario: $${item.precio.toLocaleString('es-AR')}\n`;
      mensaje += `  Subtotal: $${(item.precio * item.cantidad).toLocaleString('es-AR')}\n\n`;
    });

    mensaje += `*Total: $${totalPrice.toLocaleString('es-AR')}*`;

    const encodedMensaje = encodeURIComponent(mensaje);
    const whatsappUrl = `https://wa.me/${whatsappNumber}?text=${encodedMensaje}`;

    trackContact('WhatsApp Checkout', totalPrice);
    window.open(whatsappUrl, '_blank');
  };

  const handleCopyAlias = async () => {
    try {
      await navigator.clipboard.writeText(MP_ALIAS);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback for older browsers
      const textArea = document.createElement('textarea');
      textArea.value = MP_ALIAS;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div
        className="fixed inset-0 bg-black bg-opacity-50 transition-opacity"
        onClick={onClose}
      />

      <div className="flex min-h-full items-center justify-center p-4">
        <div className="relative bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-gray-200">
            <div className="flex items-center space-x-2">
              <ShoppingBag className="w-6 h-6 text-primary" />
              <h2 className="text-2xl font-bold text-gray-900">
                Carrito de Compras
              </h2>
              {totalItems > 0 && (
                <span className="ml-2 bg-primary text-white text-sm font-bold px-2 py-1 rounded-full">
                  {totalItems}
                </span>
              )}
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 transition-colors"
            >
              <X className="w-6 h-6" />
            </button>
          </div>

          {/* Content */}
          <div className="p-6 overflow-y-auto max-h-[calc(90vh-200px)]">
            {cartItems.length === 0 ? (
              <div className="text-center py-12">
                <ShoppingBag className="w-16 h-16 mx-auto text-gray-300 mb-4" />
                <p className="text-gray-500 text-lg">Tu carrito esta vacio</p>
                <p className="text-gray-400 text-sm mt-2">
                  Agrega productos para comenzar tu compra
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {cartItems.map((item) => (
                  <div
                    key={item._id}
                    className="flex items-center space-x-4 p-4 border border-gray-200 rounded-lg hover:shadow-md transition-shadow"
                  >
                    <div className="flex-shrink-0 w-20 h-20 bg-gray-100 rounded-lg overflow-hidden">
                      {item.imagenOptimizada?.thumb ? (
                        <img
                          src={item.imagenOptimizada.thumb}
                          alt={item.nombre}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <ShoppingBag className="w-8 h-8 text-gray-300" />
                        </div>
                      )}
                    </div>

                    <div className="flex-grow">
                      <h3 className="font-semibold text-gray-900">{item.nombre}</h3>
                      <p className="text-sm text-gray-500">{item.categoria}</p>
                      <p className="text-lg font-bold text-primary mt-1">
                        ${item.precio.toLocaleString('es-AR')}
                      </p>
                    </div>

                    <div className="flex items-center space-x-2">
                      <button
                        onClick={() => updateQuantity(item._id, item.cantidad - 1)}
                        className="p-1 rounded-full hover:bg-gray-100 transition-colors"
                        disabled={item.cantidad <= 1}
                      >
                        <Minus className="w-4 h-4 text-gray-600" />
                      </button>
                      <span className="w-8 text-center font-semibold">{item.cantidad}</span>
                      <button
                        onClick={() => updateQuantity(item._id, item.cantidad + 1)}
                        className="p-1 rounded-full hover:bg-gray-100 transition-colors"
                      >
                        <Plus className="w-4 h-4 text-gray-600" />
                      </button>
                    </div>

                    <div className="text-right min-w-[100px]">
                      <p className="text-sm text-gray-500">Subtotal</p>
                      <p className="font-bold text-gray-900">
                        ${(item.precio * item.cantidad).toLocaleString('es-AR')}
                      </p>
                    </div>

                    <button
                      onClick={() => removeFromCart(item._id)}
                      className="p-2 text-red-500 hover:bg-red-50 rounded-full transition-colors"
                      title="Eliminar producto"
                    >
                      <Trash2 className="w-5 h-5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Footer */}
          {cartItems.length > 0 && (
            <div className="border-t border-gray-200 p-6 bg-gray-50">
              <div className="flex items-center justify-between mb-4">
                <span className="text-xl font-bold text-gray-900">Total:</span>
                <span className="text-2xl font-bold text-primary">
                  ${totalPrice.toLocaleString('es-AR')}
                </span>
              </div>

              <div className="space-y-3">
                <button
                  onClick={() => {
                    onClose();
                    router.push('/checkout');
                  }}
                  className="w-full bg-primary text-white px-4 py-3 rounded-lg font-semibold hover:opacity-90 transition-opacity flex items-center justify-center space-x-2"
                >
                  <CreditCard className="w-5 h-5" />
                  <span>Pagar con tarjeta (cuotas)</span>
                </button>

                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={handleWhatsAppCheckout}
                    className="bg-green-500 text-white px-4 py-3 rounded-lg font-semibold hover:bg-green-600 transition-colors flex items-center justify-center space-x-2"
                  >
                    <span>WhatsApp</span>
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/>
                    </svg>
                  </button>

                  <button
                    onClick={() => setShowAlias(!showAlias)}
                    className="bg-sky-500 text-white px-4 py-3 rounded-lg font-semibold hover:bg-sky-600 transition-colors flex items-center justify-center space-x-2"
                  >
                    <span>Transferencia</span>
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 8.25h19.5M2.25 9h19.5m-16.5 5.25h6m-6 2.25h3m-3.75 3h15a2.25 2.25 0 002.25-2.25V6.75A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25v10.5A2.25 2.25 0 004.5 19.5z" />
                    </svg>
                  </button>
                </div>

                {showAlias && (
                  <div className="bg-sky-50 border border-sky-200 rounded-lg p-4 animate-fadeIn">
                    <p className="text-sm text-sky-800 font-medium mb-2">
                      Transferi a nuestro alias de Mercado Pago:
                    </p>
                    <div className="flex items-center justify-between bg-white rounded-lg px-4 py-3 border border-sky-200">
                      <span className="font-bold text-sky-900 text-lg">{MP_ALIAS}</span>
                      <button
                        onClick={handleCopyAlias}
                        className="flex items-center gap-1 text-sm text-sky-600 hover:text-sky-800 transition-colors ml-3"
                      >
                        {copied ? (
                          <>
                            <Check className="w-4 h-4" />
                            <span>Copiado</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-4 h-4" />
                            <span>Copiar</span>
                          </>
                        )}
                      </button>
                    </div>
                    <p className="text-xs text-sky-600 mt-2">
                      Monto a transferir: <strong>${totalPrice.toLocaleString('es-AR')}</strong>.
                      Luego envianos el comprobante por WhatsApp.
                    </p>
                  </div>
                )}

                <button
                  onClick={clearCart}
                  className="w-full bg-gray-200 text-gray-700 px-6 py-2 rounded-lg font-semibold hover:bg-gray-300 transition-colors"
                >
                  Vaciar Carrito
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
