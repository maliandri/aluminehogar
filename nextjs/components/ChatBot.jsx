'use client';
import { useState, useRef, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { X, Send, MessageSquare, Minimize2, Loader2, User, MessageCircle } from 'lucide-react';
import axios from 'axios';
import { useSite } from '@/components/SiteProvider';

const API_URL = '/api';

export default function ChatBot() {
  const site = useSite();
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [sessionId, setSessionId] = useState(null);
  const [leadCaptured, setLeadCaptured] = useState(false);
  const messagesEndRef = useRef(null);

  // Inicializar sesion
  useEffect(() => {
    if (!sessionId) {
      const newSessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      setSessionId(newSessionId);
    }
  }, []);

  // Auto-scroll al final de los mensajes
  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  // Abrir chatbot con mensaje de bienvenida
  const handleOpen = () => {
    setIsOpen(true);
    if (messages.length === 0) {
      setMessages([
        {
          role: 'assistant',
          content: 'Hola! Soy el asistente virtual de Alumine Hogar. En que puedo ayudarte hoy? Puedo ayudarte a encontrar productos para tu hogar, darte precios, informacion sobre envios y mas.',
          timestamp: new Date()
        }
      ]);
    }
  };

  const handleClose = () => {
    setIsOpen(false);
  };

  const handleSendMessage = async (e) => {
    e.preventDefault();

    if (!inputMessage.trim() || isLoading) return;

    const userMessage = {
      role: 'user',
      content: inputMessage,
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    const currentInput = inputMessage;
    setInputMessage('');
    setIsLoading(true);

    try {
      // Verificar si el usuario esta respondiendo a solicitud de asistencia humana
      const lastBotMessage = messages[messages.length - 1];
      if (lastBotMessage?.needsHumanAssistance) {
        // Guardar la consulta del usuario
        const consultaCliente = currentInput;

        // Pedir datos de contacto
        setMessages(prev => [...prev, {
          role: 'assistant',
          content: 'Perfecto, ya tengo tu consulta.\n\nAhora necesito tus datos para que un asesor te contacte:\n\nCual es tu nombre?\nY tu email o telefono?',
          timestamp: new Date(),
          waitingForContactData: true,
          consultaCliente: consultaCliente
        }]);
        setIsLoading(false);
        return;
      }

      // Verificar si esta proporcionando datos de contacto
      if (lastBotMessage?.waitingForContactData) {
        const consultaOriginal = lastBotMessage.consultaCliente;

        // Extraer datos del mensaje del usuario y del historial
        const allText = messages.map(m => m.content).join(' ') + ' ' + currentInput;
        const leadData = extractLeadDataFromText(allText);

        // Enviar solicitud de asistencia humana por email
        await enviarSolicitudAsistenciaHumana({
          ...leadData,
          consulta: consultaOriginal,
          conversationHistory: messages
        });

        setMessages(prev => [...prev, {
          role: 'assistant',
          content: 'Listo! Tu solicitud ha sido enviada.\n\nUn asesor se comunicara contigo a la brevedad para ayudarte con tu consulta.\n\nHay algo mas en lo que pueda ayudarte?',
          timestamp: new Date()
        }]);

        setIsLoading(false);
        return;
      }

      // Flujo normal del chatbot
      const response = await axios.post(`${API_URL}/chatbot?action=conversation`, {
        message: currentInput,
        conversationHistory: messages,
        sessionId
      });

      const { message: aiResponse, products, leadDetected, leadData, isPurchaseIntent } = response.data;

      // Agregar respuesta del bot
      const botMessage = {
        role: 'assistant',
        content: aiResponse,
        products: products || [],
        timestamp: new Date()
      };

      // Crear la conversacion completa ANTES de actualizar el estado
      const updatedMessages = [...messages, userMessage, botMessage];

      setMessages(prev => [...prev, botMessage]);

      // Si se detecto un lead y no se ha capturado antes
      if (leadDetected && !leadCaptured && leadData) {
        setLeadCaptured(true);
        // Enviar con la conversacion completa (incluye mensaje del usuario y respuesta del bot)
        await enviarLead(leadData, updatedMessages);
      }

      // Si hay intencion de compra y tenemos productos, mostrar boton de accion
      if (isPurchaseIntent && products && products.length > 0) {
        setTimeout(() => {
          setMessages(prev => [...prev, {
            role: 'assistant',
            content: 'Te gustaria que un asesor se comunique contigo para finalizar tu compra?',
            timestamp: new Date(),
            showContactForm: true
          }]);
        }, 1000);
      }

    } catch (error) {
      console.error('Error al enviar mensaje:', error);

      setMessages(prev => [...prev, {
        role: 'assistant',
        content: 'Disculpa, tuve un problema tecnico. Podrias intentar nuevamente?',
        timestamp: new Date(),
        isError: true
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  // Extraer datos de contacto del texto
  const extractLeadDataFromText = (text) => {
    const leadData = {
      nombre: null,
      email: null,
      telefono: null
    };

    // Extraer email
    const emailMatch = text.match(/[\w.-]+@[\w.-]+\.\w+/);
    if (emailMatch) {
      leadData.email = emailMatch[0];
    }

    // Extraer telefono argentino
    const phoneMatch = text.match(/(?:\+54\s?)?(?:9\s?)?(?:11|\d{3,4})\s?\d{3,4}[-\s]?\d{4}/);
    if (phoneMatch) {
      leadData.telefono = phoneMatch[0].replace(/\s+/g, ' ').trim();
    }

    // Extraer nombre (despues de "me llamo", "mi nombre es", "soy")
    const nombreMatch = text.match(/(?:me llamo|mi nombre es|soy|nombre:?)\s+([A-ZÁÉÍÓÚÑ][a-záéíóúñ]+(?:\s+[A-ZÁÉÍÓÚÑ][a-záéíóúñ]+)?)/i);
    if (nombreMatch) {
      leadData.nombre = nombreMatch[1].trim();
    }

    return leadData;
  };

  // Enviar solicitud de asistencia humana
  const enviarSolicitudAsistenciaHumana = async (data) => {
    try {
      await axios.post(`${API_URL}/chatbot?action=lead`, {
        leadData: {
          ...data,
          interes: data.consulta,
          tipoSolicitud: 'asistencia_humana'
        },
        conversationSummary: data.conversationHistory, // Toda la conversacion
        sessionId
      });
      console.log('Solicitud de asistencia humana enviada');
    } catch (error) {
      console.error('Error al enviar solicitud:', error);
    }
  };

  const enviarLead = async (leadData, conversationToSend = null) => {
    try {
      await axios.post(`${API_URL}/chatbot?action=lead`, {
        leadData,
        conversationSummary: conversationToSend || messages, // Usar conversacion pasada o estado actual
        sessionId
      });
      console.log('Lead enviado exitosamente');
    } catch (error) {
      console.error('Error al enviar lead:', error);
    }
  };

  const handleProductClick = (producto) => {
    window.location.href = `/producto/${producto._id}`;
  };

  const handleContactClick = () => {
    const whatsappNumber = site.tienda.whatsapp;
    const message = encodeURIComponent('Hola, estaba chateando con el bot y me gustaria mas informacion.');
    window.open(`https://wa.me/${whatsappNumber}?text=${message}`, '_blank');
  };

  const handleWhatsAppClick = () => {
    const whatsappNumber = site.tienda.whatsapp;
    const conversationSummary = messages.slice(-3).map(m => `${m.role === 'user' ? 'Cliente' : 'Bot'}: ${m.content}`).join('\n');
    const message = encodeURIComponent(`Hola, necesito asistencia.\n\nResumen de conversacion:\n${conversationSummary}`);
    window.open(`https://wa.me/${whatsappNumber}?text=${message}`, '_blank');
  };

  const handleHumanAssistance = () => {
    setMessages(prev => [...prev, {
      role: 'assistant',
      content: 'Perfecto! Voy a conectarte con un asesor humano.\n\nPrimero, cuentame:\nHay algun producto en particular que te interese o tenes alguna consulta especifica?',
      timestamp: new Date(),
      needsHumanAssistance: true
    }]);
  };

  // No mostrar el widget flotante en la pagina dedicada del bot
  if (pathname === '/bot') return null;

  return (
    <>
      {/* Boton flotante */}
      {!isOpen && (
        <button
          onClick={handleOpen}
          className="fixed bottom-6 right-6 bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-full p-4 shadow-2xl hover:shadow-purple-500/50 transition-all duration-300 hover:scale-110 z-50 group"
          aria-label="Abrir chat"
        >
          <MessageSquare className="w-6 h-6" />
          <span className="absolute -top-2 -right-2 bg-red-500 text-white text-xs rounded-full w-6 h-6 flex items-center justify-center animate-pulse">
            IA
          </span>
        </button>
      )}

      {/* Ventana del chat */}
      {isOpen && (
        <div className="fixed bottom-6 right-6 w-96 h-[600px] bg-white rounded-2xl shadow-2xl flex flex-col z-50 border border-gray-200">
          {/* Header */}
          <div className="bg-gradient-to-r from-purple-600 to-indigo-600 text-white p-4 rounded-t-2xl">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center">
                  <MessageSquare className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-semibold">Asistente Virtual</h3>
                  <p className="text-xs text-white/80">Con tecnologia Gemini AI</p>
                </div>
              </div>
              <div className="flex items-center space-x-2">
                <button
                  onClick={handleClose}
                  className="hover:bg-white/10 p-2 rounded-lg transition-colors"
                  aria-label="Minimizar chat"
                >
                  <Minimize2 className="w-5 h-5" />
                </button>
                <button
                  onClick={handleClose}
                  className="hover:bg-white/10 p-2 rounded-lg transition-colors"
                  aria-label="Cerrar chat"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Botones de accion */}
            <div className="flex items-center gap-2">
              <button
                onClick={handleWhatsAppClick}
                className="flex-1 bg-green-500 hover:bg-green-600 text-white px-3 py-2 rounded-lg transition-colors flex items-center justify-center gap-2 text-sm font-medium"
                aria-label="Contactar por WhatsApp"
              >
                <MessageCircle className="w-4 h-4" />
                WhatsApp
              </button>
              <button
                onClick={handleHumanAssistance}
                className="flex-1 bg-white/20 hover:bg-white/30 text-white px-3 py-2 rounded-lg transition-colors flex items-center justify-center gap-2 text-sm font-medium"
                aria-label="Hablar con asesor humano"
              >
                <User className="w-4 h-4" />
                Asesor
              </button>
            </div>
          </div>

          {/* Mensajes */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50">
            {messages.map((msg, index) => (
              <div key={index}>
                <div
                  className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-[80%] rounded-2xl px-4 py-2 ${
                      msg.role === 'user'
                        ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white'
                        : msg.isError
                        ? 'bg-red-50 text-red-700 border border-red-200'
                        : 'bg-white text-gray-800 shadow-sm border border-gray-200'
                    }`}
                  >
                    <p className="text-sm whitespace-pre-wrap break-words">{msg.content}</p>
                    <span className="text-xs opacity-60 mt-1 block">
                      {msg.timestamp.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                </div>

                {/* Mostrar productos si los hay */}
                {msg.products && msg.products.length > 0 && (
                  <div className="mt-2 space-y-2">
                    {msg.products.map((producto, idx) => (
                      <div
                        key={idx}
                        className="bg-white border border-gray-200 rounded-lg p-3 hover:shadow-md transition-shadow cursor-pointer"
                        onClick={() => handleProductClick(producto)}
                      >
                        <h4 className="font-semibold text-sm text-gray-800">{producto.nombre}</h4>
                        <p className="text-xs text-gray-600 mt-1">{producto.categoria}</p>
                        <p className="text-purple-600 font-bold mt-1">
                          ${producto.precio?.toLocaleString('es-AR')} ARS
                        </p>
                      </div>
                    ))}
                  </div>
                )}

                {/* Mostrar boton de contacto */}
                {msg.showContactForm && (
                  <div className="mt-2">
                    <button
                      onClick={handleContactClick}
                      className="w-full bg-green-500 hover:bg-green-600 text-white py-2 px-4 rounded-lg transition-colors text-sm font-medium"
                    >
                      Contactar por WhatsApp
                    </button>
                  </div>
                )}
              </div>
            ))}

            {isLoading && (
              <div className="flex justify-start">
                <div className="bg-white rounded-2xl px-4 py-3 shadow-sm border border-gray-200">
                  <Loader2 className="w-5 h-5 text-purple-600 animate-spin" />
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <form onSubmit={handleSendMessage} className="p-4 bg-white border-t border-gray-200 rounded-b-2xl">
            <div className="flex items-center space-x-2">
              <input
                type="text"
                value={inputMessage}
                onChange={(e) => setInputMessage(e.target.value)}
                placeholder="Escribe tu mensaje..."
                className="flex-1 px-4 py-2 border border-gray-300 rounded-full focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent text-sm"
                disabled={isLoading}
              />
              <button
                type="submit"
                disabled={isLoading || !inputMessage.trim()}
                className="bg-gradient-to-r from-purple-600 to-indigo-600 text-white p-2 rounded-full hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                aria-label="Enviar mensaje"
              >
                <Send className="w-5 h-5" />
              </button>
            </div>
          </form>
        </div>
      )}
    </>
  );
}
