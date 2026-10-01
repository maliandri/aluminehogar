import './globals.css';
import Script from 'next/script';
import { ClientProviders } from '@/components/ClientProviders';
import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';
import { WhatsAppButton } from '@/components/WhatsAppButton';
import { FacebookPixel } from '@/components/FacebookPixel';
import ChatBot from '@/components/ChatBot';

export const metadata = {
  metadataBase: new URL('https://aluminehogar.com.ar'),
  title: {
    default: 'Alumine Hogar | Calidad para tu hogar, precios para vos',
    template: '%s | Alumine Hogar',
  },
  description: 'Alumine Hogar - La mejor seleccion de colchones y almohadas para tu descanso en Neuquen. Envios a todo el pais. Calidad premium, confort y los mejores precios.',
  keywords: ['colchones neuquen', 'almohadas neuquen', 'colchones premium', 'sommier', 'ropa de cama', 'descanso', 'confort', 'neuquen', 'patagonia', 'argentina'],
  authors: [{ name: 'Alumine Hogar' }],
  openGraph: {
    type: 'website',
    locale: 'es_AR',
    url: 'https://aluminehogar.com.ar/',
    siteName: 'Alumine Hogar',
    title: 'Alumine Hogar | Tu Mejor Descanso en Neuquen',
    description: 'Descubri la mejor seleccion de colchones y almohadas en Neuquen. Envios a todo el pais. Calidad, confort y los mejores precios.',
    images: ['https://res.cloudinary.com/va9k9n0n/image/upload/f_auto,q_auto/Alumine%CC%81_Hogar-logo'],
  },
  twitter: {
    card: 'summary_large_image',
  },
  verification: {
    google: 'unJdeK0-sAXUFcQZrnPglr_7_hZ1S9QWQnFNRF1ApLA',
  },
  robots: { index: true, follow: true },
  icons: {
    icon: 'https://res.cloudinary.com/va9k9n0n/image/upload/f_auto,q_auto/Alumine%CC%81_Hogar-logo',
    apple: 'https://res.cloudinary.com/va9k9n0n/image/upload/f_auto,q_auto/Alumine%CC%81_Hogar-logo',
  },
};

export default function RootLayout({ children }) {
  return (
    <html lang="es">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;500;600;700&display=swap" rel="stylesheet" />

        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "Store",
              "name": "Alumine Hogar",
              "description": "Tienda especializada en colchones y almohadas premium en Neuquen",
              "url": "https://aluminehogar.com.ar/",
              "logo": "https://res.cloudinary.com/va9k9n0n/image/upload/f_auto,q_auto/Alumine%CC%81_Hogar-logo",
              "address": {
                "@type": "PostalAddress",
                "addressLocality": "Neuquen",
                "addressRegion": "Neuquen",
                "addressCountry": "AR"
              },
              "telephone": "+54-299-576-9999",
              "priceRange": "$$"
            })
          }}
        />
      </head>
      <body className="font-sans">
        <ClientProviders>
          <FacebookPixel />
          <div className="min-h-screen flex flex-col">
            <Header />
            <main className="flex-grow">{children}</main>
            <Footer />
            <WhatsAppButton />
            <ChatBot />
          </div>
        </ClientProviders>

        <Script
          src="https://analytics.ahrefs.com/analytics.js"
          data-key="/ju8UwKqniLyKyw8Zb9wzQ"
          strategy="afterInteractive"
        />
        <Script
          src="https://www.googletagmanager.com/gtag/js?id=G-XY3ZCSWBQQ"
          strategy="afterInteractive"
        />
        <Script id="ga4-init" strategy="afterInteractive">
          {`
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            gtag('js', new Date());
            gtag('config', 'G-XY3ZCSWBQQ');
          `}
        </Script>
      </body>
    </html>
  );
}
