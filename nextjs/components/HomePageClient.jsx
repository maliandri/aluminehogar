'use client';

import { useState, useEffect, useMemo } from 'react';
import { Search, Grid, List, Layers } from 'lucide-react';
import { ProductGridView } from '@/components/ProductGridView';
import { ProductListView } from '@/components/ProductListView';
import { ProductCarouselView } from '@/components/ProductCarouselView';
import { VendedorModal } from '@/components/VendedorModal';
import { CategorySidebar } from '@/components/CategorySidebar';
import { useUI } from '@/components/ClientProviders';
import { useSite } from '@/components/SiteProvider';
import { telHref } from '@/lib/site-format';

export default function HomePageClient({ initialProductos, initialCategorias }) {
  const site = useSite();
  const [productos] = useState(initialProductos || []);
  const [categorias] = useState(initialCategorias || []);
  const { showVendedorModal, setShowVendedorModal, showAuthModal, setShowAuthModal } = useUI();

  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [sortOrder, setSortOrder] = useState('nombre-asc');

  const [viewMode, setViewMode] = useState('grid');

  useEffect(() => {
    const saved = localStorage.getItem('productViewMode');
    if (saved) setViewMode(saved);
  }, []);

  useEffect(() => {
    localStorage.setItem('productViewMode', viewMode);
  }, [viewMode]);

  const productCount = useMemo(() => {
    const count = {};
    productos.forEach((producto) => {
      count[producto.categoria] = (count[producto.categoria] || 0) + 1;
    });
    return count;
  }, [productos]);

  const filteredProducts = productos
    .filter((producto) => {
      const matchesSearch =
        searchTerm === '' ||
        producto.nombre.toLowerCase().includes(searchTerm.toLowerCase()) ||
        producto.descripcion?.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesCategory =
        selectedCategory === '' || producto.categoria === selectedCategory;
      return matchesSearch && matchesCategory;
    })
    .sort((a, b) => {
      switch (sortOrder) {
        case 'nombre-asc': return (a.nombre || '').localeCompare(b.nombre || '');
        case 'nombre-desc': return (b.nombre || '').localeCompare(a.nombre || '');
        case 'precio-asc': return (a.precio || 0) - (b.precio || 0);
        case 'precio-desc': return (b.precio || 0) - (a.precio || 0);
        default: return 0;
      }
    });

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Hero Section */}
      <section
        id="inicio"
        className="relative h-[500px] flex items-center justify-center text-center gradient-primary text-white"
      >
        <div className="gradient-overlay absolute inset-0" />
        <div className="relative z-10 container-custom px-4">
          <h1 className="text-4xl md:text-6xl font-bold mb-4 text-shadow animate-fadeIn">
            {site.inicio.titulo}
          </h1>
          <p className="text-xl md:text-2xl mb-8 text-shadow animate-fadeIn">
            {site.inicio.subtitulo}
          </p>
          <a href="#productos" className="btn-primary inline-block text-lg animate-fadeIn">
            Ver Productos
          </a>
        </div>
      </section>

      {/* Productos Section */}
      <section id="productos" className="py-16">
        <div className="container-custom">
          <h2 className="text-3xl md:text-4xl font-bold text-center mb-12">
            Nuestros Productos
          </h2>

          <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
            <div className="hidden lg:block">
              <CategorySidebar
                categorias={categorias}
                selectedCategory={selectedCategory}
                onSelectCategory={setSelectedCategory}
                productCount={productCount}
              />
            </div>

            <div className="lg:col-span-3">
              <div className="bg-white rounded-xl shadow-md p-6 mb-8">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                    <input
                      type="text"
                      placeholder="Buscar productos..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="input-field pl-10"
                    />
                  </div>
                  <select
                    value={sortOrder}
                    onChange={(e) => setSortOrder(e.target.value)}
                    className="input-field"
                  >
                    <option value="nombre-asc">Nombre (A-Z)</option>
                    <option value="nombre-desc">Nombre (Z-A)</option>
                    <option value="precio-asc">Precio (Menor a Mayor)</option>
                    <option value="precio-desc">Precio (Mayor a Menor)</option>
                  </select>
                </div>

                <div className="mt-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                  <div className="flex items-center gap-4 flex-wrap">
                    <div className="text-gray-600 text-sm">
                      {filteredProducts.length} producto{filteredProducts.length !== 1 && 's'} encontrado{filteredProducts.length !== 1 && 's'}
                    </div>
                    {selectedCategory && (
                      <div className="flex items-center space-x-2">
                        <span className="text-sm text-gray-600">Mostrando:</span>
                        <span className="bg-primary text-white px-3 py-1 rounded-full text-sm font-medium">
                          {selectedCategory}
                        </span>
                        <button
                          onClick={() => setSelectedCategory('')}
                          className="text-sm text-gray-500 hover:text-primary"
                        >
                          Limpiar
                        </button>
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-2 bg-gray-100 rounded-lg p-1">
                    <button
                      onClick={() => setViewMode('grid')}
                      className={`flex items-center gap-2 px-4 py-2 rounded-md transition-colors ${
                        viewMode === 'grid'
                          ? 'bg-white text-primary shadow-sm font-medium'
                          : 'text-gray-600 hover:text-gray-900'
                      }`}
                      title="Vista en cuadricula"
                    >
                      <Grid className="w-4 h-4" />
                      <span className="hidden sm:inline">Cuadricula</span>
                    </button>
                    <button
                      onClick={() => setViewMode('list')}
                      className={`flex items-center gap-2 px-4 py-2 rounded-md transition-colors ${
                        viewMode === 'list'
                          ? 'bg-white text-primary shadow-sm font-medium'
                          : 'text-gray-600 hover:text-gray-900'
                      }`}
                      title="Vista en lista"
                    >
                      <List className="w-4 h-4" />
                      <span className="hidden sm:inline">Lista</span>
                    </button>
                    <button
                      onClick={() => setViewMode('carousel')}
                      className={`flex items-center gap-2 px-4 py-2 rounded-md transition-colors ${
                        viewMode === 'carousel'
                          ? 'bg-white text-primary shadow-sm font-medium'
                          : 'text-gray-600 hover:text-gray-900'
                      }`}
                      title="Vista en carrusel por categoria"
                    >
                      <Layers className="w-4 h-4" />
                      <span className="hidden sm:inline">Carrusel</span>
                    </button>
                  </div>
                </div>
              </div>

              {filteredProducts.length > 0 ? (
                <>
                  {viewMode === 'grid' && <ProductGridView products={filteredProducts} />}
                  {viewMode === 'list' && <ProductListView products={filteredProducts} />}
                  {viewMode === 'carousel' && (
                    <ProductCarouselView products={filteredProducts} categorias={categorias} />
                  )}
                </>
              ) : (
                <div className="text-center py-20">
                  <p className="text-gray-500 text-lg">
                    No se encontraron productos con los filtros seleccionados.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Contact Section */}
      <section id="contacto" className="py-16 bg-gray-100">
        <div className="container-custom text-center">
          <h2 className="text-3xl md:text-4xl font-bold mb-6">Necesitas ayuda?</h2>
          <p className="text-gray-600 text-lg mb-8 max-w-2xl mx-auto">
            Nuestro equipo esta listo para ayudarte a encontrar el colchon perfecto para tu descanso.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <a href={telHref(site.tienda.telefono)} className="btn-primary">Llamar Ahora</a>
            <a href={`mailto:${site.tienda.emailInfo || site.tienda.emailContacto}`} className="btn-outline">Enviar Email</a>
          </div>
        </div>
      </section>

      <VendedorModal
        isOpen={showVendedorModal}
        onClose={() => setShowVendedorModal(false)}
        productos={productos}
        categorias={categorias}
      />
    </div>
  );
}
