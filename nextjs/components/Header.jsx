'use client';
import { useState } from 'react';
import { ShoppingCart, User, Menu, X, UserCog, MessageSquare, ShieldCheck } from 'lucide-react';
import { useCartStore } from '@/store/cartStore';
import { useAuthStore } from '@/store/authStore';
import { useUI } from '@/components/ClientProviders';

export const Header = () => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isAccountMenuOpen, setIsAccountMenuOpen] = useState(false);
  const getTotalItems = useCartStore((state) => state.getTotalItems);
  const { isAuthenticated, user, logout, isVendedor, isAdmin } = useAuthStore();
  const { setShowVendedorModal, setShowAuthModal, setShowCartModal } = useUI();

  const cartCount = getTotalItems();

  const handleAccountClick = () => {
    if (isAuthenticated) {
      setIsAccountMenuOpen((open) => !open);
    } else {
      setShowAuthModal(true);
    }
  };

  return (
    <header className="bg-primary shadow-lg sticky top-0 z-50">
      <div className="container-custom py-4">
        <div className="flex items-center justify-between">
          {/* Logo */}
          <a href="/" className="flex items-center">
            <img
              src="https://res.cloudinary.com/dlshym1te/image/upload/f_png,fl_preserve_transparency,q_auto/Alumine%CC%81_Hogar-logo"
              alt="Alumine Hogar"
              className="h-12 md:h-16 w-auto object-contain" style={{ backgroundColor: "transparent" }}
              onError={(e) => {
                e.target.src = '/assets/logo.png';
              }}
            />
          </a>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center space-x-6">
            <a
              href="#inicio"
              className="text-white hover:text-purple-200 transition-colors font-medium"
            >
              Inicio
            </a>
            <a
              href="#productos"
              className="text-white hover:text-purple-200 transition-colors font-medium"
            >
              Productos
            </a>
            <a
              href="#contacto"
              className="text-white hover:text-purple-200 transition-colors font-medium"
            >
              Contacto
            </a>
            <a
              href="/bot"
              className="flex items-center gap-1.5 text-white hover:text-purple-200 transition-colors font-medium"
            >
              <MessageSquare className="w-4 h-4" />
              Alumine Bot
            </a>
          </nav>

          {/* Icons */}
          <div className="flex items-center space-x-4">
            {/* User Account */}
            <div className="relative">
              <button
                className="flex items-center space-x-2 text-white hover:text-purple-200 transition-colors"
                onClick={handleAccountClick}
                title={isAuthenticated ? 'Mi cuenta' : 'Iniciar sesion'}
              >
                <User className="w-6 h-6" />
                {isAuthenticated && (
                  <span className="hidden md:inline text-sm">{user?.email}</span>
                )}
              </button>

              {isAuthenticated && isAccountMenuOpen && (
                <div className="absolute right-0 mt-2 w-56 bg-white rounded-lg shadow-xl py-2 text-gray-700 z-50">
                  {isAdmin() && (
                    <a
                      href="/admin"
                      className="flex items-center space-x-2 px-4 py-2 hover:bg-gray-100 transition-colors"
                      onClick={() => setIsAccountMenuOpen(false)}
                    >
                      <ShieldCheck className="w-4 h-4" />
                      <span>Panel Admin</span>
                    </a>
                  )}
                  {isVendedor() && (
                    <button
                      className="w-full flex items-center space-x-2 px-4 py-2 hover:bg-gray-100 transition-colors text-left"
                      onClick={() => {
                        setIsAccountMenuOpen(false);
                        setShowVendedorModal(true);
                      }}
                    >
                      <UserCog className="w-4 h-4" />
                      <span>Panel Vendedor</span>
                    </button>
                  )}
                  <button
                    className="w-full text-left px-4 py-2 hover:bg-gray-100 transition-colors text-red-600"
                    onClick={() => {
                      setIsAccountMenuOpen(false);
                      logout();
                    }}
                  >
                    Cerrar sesion
                  </button>
                </div>
              )}
            </div>

            {/* Cart */}
            <button
              className="relative flex items-center space-x-2 text-white hover:text-purple-200 transition-colors"
              onClick={() => setShowCartModal(true)}
              title="Ver carrito"
            >
              <ShoppingCart className="w-6 h-6" />
              {cartCount > 0 && (
                <span className="absolute -top-2 -right-2 bg-secondary text-white text-xs font-bold rounded-full h-5 w-5 flex items-center justify-center">
                  {cartCount}
                </span>
              )}
            </button>

            {/* Mobile Menu Toggle */}
            <button
              className="md:hidden text-white"
              onClick={() => setIsMenuOpen(!isMenuOpen)}
            >
              {isMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>

        {/* Mobile Navigation */}
        {isMenuOpen && (
          <nav className="md:hidden mt-4 pb-4 space-y-3 border-t border-purple-600 pt-4">
            <a
              href="#inicio"
              className="block text-white hover:text-purple-200 transition-colors font-medium"
              onClick={() => setIsMenuOpen(false)}
            >
              Inicio
            </a>
            <a
              href="#productos"
              className="block text-white hover:text-purple-200 transition-colors font-medium"
              onClick={() => setIsMenuOpen(false)}
            >
              Productos
            </a>
            <a
              href="#contacto"
              className="block text-white hover:text-purple-200 transition-colors font-medium"
              onClick={() => setIsMenuOpen(false)}
            >
              Contacto
            </a>
            <a
              href="/bot"
              className="flex items-center gap-1.5 text-white hover:text-purple-200 transition-colors font-medium"
              onClick={() => setIsMenuOpen(false)}
            >
              <MessageSquare className="w-4 h-4" />
              Alumine Bot
            </a>
            {isAuthenticated && isAdmin() && (
              <a
                href="/admin"
                className="block text-white hover:text-purple-200 transition-colors font-medium"
                onClick={() => setIsMenuOpen(false)}
              >
                Panel Admin
              </a>
            )}
            {isAuthenticated && isVendedor() && (
              <button
                onClick={() => {
                  setShowVendedorModal(true);
                  setIsMenuOpen(false);
                }}
                className="block w-full text-left text-white hover:text-purple-200 transition-colors font-medium"
              >
                Panel Vendedor
              </button>
            )}
            {isAuthenticated && (
              <button
                onClick={() => {
                  logout();
                  setIsMenuOpen(false);
                }}
                className="block w-full text-left text-pink-300 hover:text-pink-200 transition-colors font-medium"
              >
                Cerrar Sesion
              </button>
            )}
          </nav>
        )}
      </div>
    </header>
  );
};
