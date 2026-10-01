'use client';
import { Mail, Phone, MapPin, MessageSquare } from 'lucide-react';

export const Footer = () => {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="gradient-primary text-white mt-auto">
      <div className="container-custom py-12">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {/* Informacion de la empresa */}
          <div>
            <h3 className="text-white text-xl font-semibold mb-4">Alumine Hogar</h3>
            <p className="text-purple-100 mb-4">
              Calidad para tu hogar, precios para vos. Todo lo que necesitas para tu hogar en Neuquen.
            </p>
            <img
              src="https://res.cloudinary.com/va9k9n0n/image/upload/f_png,fl_preserve_transparency,q_auto/Alumine%CC%81_Hogar-logo"
              alt="Alumine Hogar"
              className="h-12 w-auto opacity-80"
              onError={(e) => {
                e.target.src = '/assets/logo.png';
              }}
            />
          </div>

          {/* Enlaces rapidos */}
          <div>
            <h3 className="text-white text-xl font-semibold mb-4">Enlaces Rapidos</h3>
            <ul className="space-y-2">
              <li>
                <a href="#inicio" className="hover:text-primary transition-colors">
                  Inicio
                </a>
              </li>
              <li>
                <a href="#productos" className="hover:text-primary transition-colors">
                  Productos
                </a>
              </li>
              <li>
                <a href="#contacto" className="hover:text-primary transition-colors">
                  Contacto
                </a>
              </li>
              <li>
                <a href="/bot" className="flex items-center gap-1.5 hover:text-primary transition-colors">
                  <MessageSquare className="w-4 h-4" />
                  Alumine Bot
                </a>
              </li>
            </ul>
          </div>

          {/* Contacto */}
          <div>
            <h3 className="text-white text-xl font-semibold mb-4">Contacto</h3>
            <ul className="space-y-3">
              <li className="flex items-start space-x-3">
                <MapPin className="w-5 h-5 text-primary flex-shrink-0 mt-1" />
                <span>Neuquen, Argentina</span>
              </li>
              <li className="flex items-center space-x-3">
                <Phone className="w-5 h-5 text-primary flex-shrink-0" />
                <a href="tel:+542995769999" className="hover:text-primary transition-colors">
                  +54 9 299 576-9999
                </a>
              </li>
              <li className="flex items-center space-x-3">
                <Mail className="w-5 h-5 text-primary flex-shrink-0" />
                <a
                  href="mailto:aluminehogar@gmail.com"
                  className="hover:text-primary transition-colors"
                >
                  aluminehogar@gmail.com
                </a>
              </li>
            </ul>
          </div>
        </div>

        {/* Copyright */}
        <div className="border-t border-gray-800 mt-8 pt-8 text-center text-gray-500">
          <p>&copy; {currentYear} Alumine Hogar. Todos los derechos reservados.</p>
        </div>
      </div>
    </footer>
  );
};
