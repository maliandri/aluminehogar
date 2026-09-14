import { useState } from 'react'
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import { Header } from './components/Header'
import { Footer } from './components/Footer'
import { CartModal } from './components/CartModal'
import { WhatsAppButton } from './components/WhatsAppButton'
import { FacebookPixel } from './components/FacebookPixel'
import ChatBot from './components/ChatBot'
import { HomePage } from './pages/HomePage'
import { ProductDetail } from './pages/ProductDetail'
import AdminPanel from './pages/AdminPanel'
import AceptarInvitacion from './pages/AceptarInvitacion'
import { CartProvider } from './store/cartStore'
import { AuthProvider } from './store/authStore'

function App() {
  const [showVendedorModal, setShowVendedorModal] = useState(false)
  const [showAuthModal, setShowAuthModal] = useState(false)
  const [showCartModal, setShowCartModal] = useState(false)

  return (
    <AuthProvider>
      <CartProvider>
        <Router>
          {/* Facebook Pixel */}
          <FacebookPixel />

          <div className="min-h-screen flex flex-col">
            <Header
        onOpenVendedorModal={() => setShowVendedorModal(true)}
        onOpenAuthModal={() => setShowAuthModal(true)}
        onOpenCartModal={() => setShowCartModal(true)}
      />
            <CartModal
              isOpen={showCartModal}
              onClose={() => setShowCartModal(false)}
            />
            <main className="flex-grow">
              <Routes>
                <Route
                  path="/"
                  element={
                    <HomePage
                      showVendedorModal={showVendedorModal}
                      setShowVendedorModal={setShowVendedorModal}
                      showAuthModal={showAuthModal}
                      setShowAuthModal={setShowAuthModal}
                    />
                  }
                />
                <Route path="/producto/:id" element={<ProductDetail />} />
                <Route path="/admin" element={<AdminPanel />} />
                <Route path="/invitacion/:token" element={<AceptarInvitacion />} />
                <Route path="/pago-exitoso" element={<div className="container mx-auto p-8 text-center"><h1 className="text-3xl font-bold text-green-600 mb-4">¡Pago Exitoso!</h1><p>Gracias por tu compra. Recibirás un email de confirmación.</p></div>} />
                <Route path="/pago-fallido" element={<div className="container mx-auto p-8 text-center"><h1 className="text-3xl font-bold text-red-600 mb-4">Pago Fallido</h1><p>Hubo un problema con tu pago. Por favor, intenta nuevamente.</p></div>} />
                <Route path="/pago-pendiente" element={<div className="container mx-auto p-8 text-center"><h1 className="text-3xl font-bold text-yellow-600 mb-4">Pago Pendiente</h1><p>Tu pago está siendo procesado. Te notificaremos cuando se confirme.</p></div>} />
              </Routes>
            </main>
            <Footer />

            {/* Botón flotante de WhatsApp */}
            <WhatsAppButton />

            {/* Chatbot con IA */}
            <ChatBot />
          </div>
        </Router>
      </CartProvider>
    </AuthProvider>
  )
}

export default App
