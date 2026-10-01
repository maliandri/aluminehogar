'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, ShoppingCart, MessageCircle, Plus, Minus } from 'lucide-react';
import { useCartStore } from '@/store/cartStore';
import { CloudinaryImage } from '@/components/CloudinaryImage';
import { trackViewContent, trackContact } from '@/utils/facebookPixel';
import { useEffect } from 'react';
import { useSite } from '@/components/SiteProvider';

export default function ProductDetailClient({ producto }) {
  const site = useSite();
  const [openSpecs, setOpenSpecs] = useState({});
  const addToCart = useCartStore((state) => state.addToCart);

  useEffect(() => {
    if (producto) {
      trackViewContent(producto);
    }
  }, [producto]);

  const parseEspecificaciones = (htmlString) => {
    if (!htmlString) return [];
    const parser = new DOMParser();
    const doc = parser.parseFromString(htmlString, 'text/html');
    const items = doc.querySelectorAll('li');
    return Array.from(items).map((item, index) => {
      const strongTag = item.querySelector('strong');
      const titulo = strongTag ? strongTag.textContent : `Especificacion ${index + 1}`;
      const contenido = strongTag
        ? item.innerHTML.replace(strongTag.outerHTML, '').trim()
        : item.textContent;
      return { titulo, contenido };
    });
  };

  const toggleSpec = (index) => {
    setOpenSpecs(prev => ({ ...prev, [index]: !prev[index] }));
  };

  const handleAddToCart = () => {
    if (producto) addToCart(producto);
  };

  const handleWhatsApp = () => {
    const mensaje = `Hola! Me interesa el producto: ${producto.nombre} - Precio: $${producto.precio.toLocaleString('es-AR')}`;
    const whatsappUrl = `https://wa.me/${site.tienda.whatsapp}?text=${encodeURIComponent(mensaje)}`;
    trackContact('WhatsApp Product', producto.precio);
    window.open(whatsappUrl, '_blank');
  };

  if (!producto) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center">
        <h2 className="text-2xl font-bold text-gray-800 mb-4">Producto no encontrado</h2>
        <Link href="/" className="text-primary hover:underline flex items-center gap-2">
          <ArrowLeft className="w-5 h-5" />
          Volver al inicio
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="container-custom">
        <div className="mb-6">
          <Link href="/" className="text-primary hover:underline flex items-center gap-2 mb-4">
            <ArrowLeft className="w-5 h-5" />
            Volver al catalogo
          </Link>
          <div className="text-sm text-gray-600">
            <Link href="/" className="hover:text-primary">Inicio</Link>
            <span className="mx-2">/</span>
            <span className="text-gray-400">{producto.categoria}</span>
            <span className="mx-2">/</span>
            <span className="text-gray-800">{producto.nombre}</span>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-lg overflow-hidden">
          <div className="grid md:grid-cols-2 gap-8 p-6 md:p-8">
            <div className="relative flex items-center justify-center bg-gray-50 rounded-lg p-4">
              <CloudinaryImage
                product={producto}
                alt={producto.nombre}
                className="w-full h-96 object-contain rounded-lg"
                loading="eager"
              />
              {producto.categoria && (
                <span className="absolute top-4 left-4 bg-primary text-white px-3 py-1 rounded-full text-sm font-medium">
                  {producto.categoria}
                </span>
              )}
            </div>

            <div className="flex flex-col">
              <h1 className="text-3xl font-bold text-gray-900 mb-4">{producto.nombre}</h1>
              <div className="text-4xl font-bold text-primary mb-6">
                ${producto.precio.toLocaleString('es-AR')}
              </div>

              {producto.descripcion && (
                <div className="mb-6">
                  <h2 className="text-xl font-semibold text-gray-800 mb-2">Descripcion</h2>
                  <p className="text-gray-600 leading-relaxed">{producto.descripcion}</p>
                </div>
              )}

              {producto.especificaciones && (
                <div className="mb-6">
                  <h2 className="text-xl font-semibold text-gray-800 mb-3">Especificaciones Tecnicas</h2>
                  <div className="space-y-2">
                    {parseEspecificaciones(producto.especificaciones).map((spec, index) => {
                      const isOpen = openSpecs[index];
                      return (
                        <div key={index} className="rounded-lg overflow-hidden border border-gray-200">
                          <button
                            onClick={() => toggleSpec(index)}
                            className={`w-full flex items-center justify-between p-4 transition-colors ${
                              isOpen ? 'bg-primary text-white' : 'bg-green-500 hover:bg-green-600 text-white'
                            }`}
                          >
                            <span className="font-semibold text-left">{spec.titulo.replace(':', '')}</span>
                            {isOpen ? (
                              <Minus className="w-5 h-5 flex-shrink-0 text-green-400" />
                            ) : (
                              <Plus className="w-5 h-5 flex-shrink-0 text-green-400" />
                            )}
                          </button>
                          {isOpen && (
                            <div className="p-4 bg-white animate-fadeIn">
                              <div className="text-gray-700 leading-relaxed" dangerouslySetInnerHTML={{ __html: spec.contenido }} />
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              <div className="mt-auto space-y-3">
                <button
                  onClick={handleAddToCart}
                  className="w-full bg-primary hover:bg-purple-700 text-white font-semibold py-3 px-6 rounded-lg transition-colors flex items-center justify-center gap-2"
                >
                  <ShoppingCart className="w-5 h-5" />
                  Agregar al Carrito
                </button>
                <button
                  onClick={handleWhatsApp}
                  className="w-full bg-green-500 hover:bg-green-600 text-white font-semibold py-3 px-6 rounded-lg transition-colors flex items-center justify-center gap-2"
                >
                  <MessageCircle className="w-5 h-5" />
                  Consultar por WhatsApp
                </button>
                <p className="text-sm text-gray-500 text-center">Envio a todo el pais</p>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-8 grid md:grid-cols-3 gap-6">
          <div className="bg-white p-6 rounded-lg shadow text-center">
            <h3 className="font-semibold text-gray-800 mb-2">Envio Seguro</h3>
            <p className="text-sm text-gray-600">Envios a todo el pais con seguimiento</p>
          </div>
          <div className="bg-white p-6 rounded-lg shadow text-center">
            <h3 className="font-semibold text-gray-800 mb-2">Garantia</h3>
            <p className="text-sm text-gray-600">Productos con garantia oficial</p>
          </div>
          <div className="bg-white p-6 rounded-lg shadow text-center">
            <h3 className="font-semibold text-gray-800 mb-2">Atencion Personalizada</h3>
            <p className="text-sm text-gray-600">Asesoramiento por WhatsApp</p>
          </div>
        </div>
      </div>
    </div>
  );
}
