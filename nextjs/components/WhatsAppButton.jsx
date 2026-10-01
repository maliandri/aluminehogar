'use client';
import { MessageCircle } from 'lucide-react';
import { trackContact } from '@/utils/facebookPixel';
import { useSite } from '@/components/SiteProvider';

/**
 * Boton flotante de WhatsApp
 * Aparece en la esquina inferior derecha de la pantalla
 */
export const WhatsAppButton = () => {
  const site = useSite();
  const whatsappNumber = site.tienda.whatsapp;
  const mensaje = 'Hola! Me gustaria consultar sobre sus productos.';
  const whatsappUrl = `https://wa.me/${whatsappNumber}?text=${encodeURIComponent(mensaje)}`;

  const handleClick = () => {
    // Track Facebook Pixel Contact event
    trackContact('WhatsApp Button', 0);
  };

  return (
    <a
      href={whatsappUrl}
      target="_blank"
      rel="noopener noreferrer"
      onClick={handleClick}
      className="fixed bottom-6 right-6 z-50 bg-green-500 hover:bg-green-600 text-white rounded-full p-4 shadow-2xl transition-all duration-300 hover:scale-110 flex items-center gap-2 group"
      aria-label="Contactar por WhatsApp"
    >
      <MessageCircle className="w-6 h-6" />
      <span className="hidden group-hover:inline-block text-sm font-medium whitespace-nowrap pr-1">
        Consultar por WhatsApp
      </span>
    </a>
  );
};
