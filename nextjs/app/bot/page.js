'use client';

import { useState, useRef, useEffect } from 'react';
import { Send, MessageSquare, Loader2, User, MessageCircle, ArrowLeft, Sparkles } from 'lucide-react';
import Link from 'next/link';
import axios from 'axios';
import { useSite } from '@/components/SiteProvider';

const API_URL = '/api';

const SUGERENCIAS = [
  'Que colchon me recomendas?',
  'Hacen envios a domicilio?',
  'Cuales son las formas de pago?',
  'Quiero ver almohadas',
];

export default function BotPage() {
  const site = useSite();
  const [messages, setMessages] = useState([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [sessionId, setSessionId] = useState(null);
  const [leadCaptured, setLeadCaptured] = useState(false);
  const [chatStarted, setChatStarted] = useState(false);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    if (!sessionId) {
      const newSessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      setSessionId(newSessionId);
    }
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const startChat = (initialMessage) => {
    setChatStarted(true);
    if (initialMessage) {
      setTimeout(() => {
        setInputMessage(initialMessage);
        // Auto-send the suggestion
        sendMessage(initialMessage);
      }, 100);
    }
  };

  const extractLeadDataFromText = (text) => {
    const leadData = { nombre: null, email: null, telefono: null };
    const emailMatch = text.match(/[\w.-]+@[\w.-]+\.\w+/);
    if (emailMatch) leadData.email = emailMatch[0];
    const phoneMatch = text.match(/(?:\+54\s?)?(?:9\s?)?(?:11|\d{3,4})\s?\d{3,4}[-\s]?\d{4}/);
    if (phoneMatch) leadData.telefono = phoneMatch[0].replace(/\s+/g, ' ').trim();
    const nombreMatch = text.match(/(?:me llamo|mi nombre es|soy|nombre:?)\s+([A-ZÁÉÍÓÚÑ][a-záéíóúñ]+(?:\s+[A-ZÁÉÍÓÚÑ][a-záéíóúñ]+)?)/i);
    if (nombreMatch) leadData.nombre = nombreMatch[1].trim();
    return leadData;
  };

  const enviarSolicitudAsistenciaHumana = async (data) => {
    try {
      await axios.post(`${API_URL}/chatbot?action=lead`, {
        leadData: { ...data, interes: data.consulta, tipoSolicitud: 'asistencia_humana' },
        conversationSummary: data.conversationHistory,
        sessionId
      });
    } catch (error) {
      console.error('Error al enviar solicitud:', error);
    }
  };

  const enviarLead = async (leadData, conversationToSend = null) => {
    try {
      await axios.post(`${API_URL}/chatbot?action=lead`, {
        leadData,
        conversationSummary: conversationToSend || messages,
        sessionId
      });
    } catch (error) {
      console.error('Error al enviar lead:', error);
    }
  };

  const sendMessage = async (text) => {
    if (!text.trim() || isLoading) return;

    const userMessage = { role: 'user', content: text, timestamp: new Date() };
    setMessages(prev => [...prev, userMessage]);
    setInputMessage('');
    setIsLoading(true);

    try {
      const currentMessages = [...messages];
      const lastBotMessage = currentMessages[currentMessages.length - 1];

      if (lastBotMessage?.needsHumanAssistance) {
        setMessages(prev => [...prev, {
          role: 'assistant',
          content: 'Perfecto, ya tengo tu consulta.\n\nAhora necesito tus datos para que un asesor te contacte:\n\nCual es tu nombre?\nY tu email o telefono?',
          timestamp: new Date(),
          waitingForContactData: true,
          consultaCliente: text
        }]);
        setIsLoading(false);
        return;
      }

      if (lastBotMessage?.waitingForContactData) {
        const consultaOriginal = lastBotMessage.consultaCliente;
        const allText = currentMessages.map(m => m.content).join(' ') + ' ' + text;
        const leadData = extractLeadDataFromText(allText);
        await enviarSolicitudAsistenciaHumana({
          ...leadData,
          consulta: consultaOriginal,
          conversationHistory: currentMessages
        });
        setMessages(prev => [...prev, {
          role: 'assistant',
          content: 'Listo! Tu solicitud ha sido enviada.\n\nUn asesor se comunicara contigo a la brevedad para ayudarte con tu consulta.\n\nHay algo mas en lo que pueda ayudarte?',
          timestamp: new Date()
        }]);
        setIsLoading(false);
        return;
      }

      const response = await axios.post(`${API_URL}/chatbot?action=conversation`, {
        message: text,
        conversationHistory: currentMessages,
        sessionId
      });

      const { reply: aiResponse, productos: products } = response.data;

      const botMessage = {
        role: 'assistant',
        content: aiResponse,
        products: products || [],
        timestamp: new Date()
      };

      setMessages(prev => [...prev, botMessage]);

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
      inputRef.current?.focus();
    }
  };

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!chatStarted) setChatStarted(true);
    sendMessage(inputMessage);
  };

  const handleProductClick = (producto) => {
    window.open(`/producto/${producto._id}`, '_blank');
  };

  const handleWhatsAppClick = () => {
    const whatsappNumber = site.tienda.whatsapp;
    const conversationSummary = messages.slice(-3).map(m => `${m.role === 'user' ? 'Cliente' : 'Bot'}: ${m.content}`).join('\n');
    const message = encodeURIComponent(`Hola, necesito asistencia.\n\nResumen de conversacion:\n${conversationSummary}`);
    window.open(`https://wa.me/${whatsappNumber}?text=${message}`, '_blank');
  };

  const handleHumanAssistance = () => {
    if (!chatStarted) setChatStarted(true);
    setMessages(prev => [...prev, {
      role: 'assistant',
      content: 'Perfecto! Voy a conectarte con un asesor humano.\n\nPrimero, cuentame:\nHay algun producto en particular que te interese o tenes alguna consulta especifica?',
      timestamp: new Date(),
      needsHumanAssistance: true
    }]);
  };

  const handleContactClick = () => {
    const whatsappNumber = site.tienda.whatsapp;
    const message = encodeURIComponent('Hola, estaba chateando con el bot y me gustaria mas informacion.');
    window.open(`https://wa.me/${whatsappNumber}?text=${message}`, '_blank');
  };

  return (
    <div className="fixed inset-0 z-[60] flex flex-col bg-[#f8faf5]">
      {/* Top bar */}
      <div className="bg-[#2d5016] text-white">
        <div className="max-w-3xl mx-auto px-4 py-2 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 text-sm text-white/80 hover:text-white transition-colors">
            <ArrowLeft className="w-4 h-4" />
            Volver a la tienda
          </Link>
          <div className="flex gap-2">
            <button
              onClick={handleWhatsAppClick}
              className="flex items-center gap-1.5 text-white/80 hover:text-white px-2 py-1 text-sm transition-colors"
            >
              <MessageCircle className="w-4 h-4" />
              <span className="hidden sm:inline">WhatsApp</span>
            </button>
            <button
              onClick={handleHumanAssistance}
              className="flex items-center gap-1.5 text-white/80 hover:text-white px-2 py-1 text-sm transition-colors"
            >
              <User className="w-4 h-4" />
              <span className="hidden sm:inline">Asesor</span>
            </button>
          </div>
        </div>
      </div>

      {/* Landing / Welcome section - visible when chat hasn't started */}
      {!chatStarted && (
        <div className="flex-1 flex flex-col items-center justify-center px-4 overflow-y-auto">
          <div className="max-w-lg w-full text-center space-y-6 py-8">
            {/* Logo / Avatar */}
            <div className="flex justify-center">
              <div className="w-24 h-24 bg-gradient-to-br from-[#2d5016] to-[#4a7c25] rounded-full flex items-center justify-center shadow-lg shadow-[#4a7c25]/20">
                <MessageSquare className="w-12 h-12 text-white" />
              </div>
            </div>

            {/* Bot name and description */}
            <div>
              <h1 className="text-3xl font-bold text-[#2d5016]">Alumine Bot</h1>
              <p className="text-gray-500 mt-2 text-base">Asistente virtual de Alumine Hogar</p>
            </div>

            <p className="text-gray-600 text-sm leading-relaxed max-w-md mx-auto">
              Hola! Soy el asistente de Alumine Hogar. Puedo ayudarte a encontrar el colchon o producto ideal para vos, darte precios, informacion de envios y mucho mas.
            </p>

            {/* Sugerencias rapidas */}
            <div className="space-y-2">
              <p className="text-xs text-gray-400 uppercase tracking-wider font-medium">Preguntame algo</p>
              <div className="flex flex-wrap justify-center gap-2">
                {SUGERENCIAS.map((sug, idx) => (
                  <button
                    key={idx}
                    onClick={() => startChat(sug)}
                    className="px-4 py-2 bg-white border border-[#4a7c25]/20 rounded-full text-sm text-[#2d5016] hover:bg-[#4a7c25] hover:text-white hover:border-[#4a7c25] transition-all shadow-sm"
                  >
                    {sug}
                  </button>
                ))}
              </div>
            </div>

            {/* Info badges */}
            <div className="flex flex-wrap justify-center gap-3 pt-2">
              <span className="inline-flex items-center gap-1.5 text-xs text-gray-500 bg-white px-3 py-1.5 rounded-full border">
                <Sparkles className="w-3 h-3 text-[#4a7c25]" />
                IA de Alumine Hogar
              </span>
              <span className="inline-flex items-center gap-1.5 text-xs text-gray-500 bg-white px-3 py-1.5 rounded-full border">
                <MessageCircle className="w-3 h-3 text-green-500" />
                Respuesta inmediata
              </span>
            </div>
          </div>

          {/* Input at bottom of landing */}
          <div className="w-full border-t bg-white">
            <form onSubmit={(e) => { e.preventDefault(); setChatStarted(true); sendMessage(inputMessage); }} className="max-w-3xl mx-auto px-4 py-3">
              <div className="flex items-center gap-3">
                <input
                  ref={inputRef}
                  type="text"
                  value={inputMessage}
                  onChange={(e) => setInputMessage(e.target.value)}
                  placeholder="Escribe tu consulta..."
                  className="flex-1 px-4 py-3 border border-gray-300 rounded-full focus:outline-none focus:ring-2 focus:ring-[#4a7c25] focus:border-transparent text-sm"
                  autoFocus
                />
                <button
                  type="submit"
                  disabled={!inputMessage.trim()}
                  className="bg-[#4a7c25] text-white p-3 rounded-full hover:bg-[#2d5016] transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-md"
                  aria-label="Enviar mensaje"
                >
                  <Send className="w-5 h-5" />
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Chat section - visible after chat starts */}
      {chatStarted && (
        <>
          {/* Chat header */}
          <div className="bg-white border-b px-4 py-3">
            <div className="max-w-3xl mx-auto flex items-center gap-3">
              <div className="w-9 h-9 bg-gradient-to-br from-[#2d5016] to-[#4a7c25] rounded-full flex items-center justify-center flex-shrink-0">
                <MessageSquare className="w-4 h-4 text-white" />
              </div>
              <div>
                <h2 className="font-semibold text-[#2d5016] text-sm">Alumine Bot</h2>
                <p className="text-xs text-gray-400">En linea</p>
              </div>
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto">
            <div className="max-w-3xl mx-auto px-4 py-6 space-y-4">
              {messages.map((msg, index) => (
                <div key={index}>
                  <div className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'} items-end gap-2`}>
                    {msg.role === 'assistant' && (
                      <div className="w-7 h-7 bg-gradient-to-br from-[#2d5016] to-[#4a7c25] rounded-full flex items-center justify-center flex-shrink-0 mb-1">
                        <MessageSquare className="w-3.5 h-3.5 text-white" />
                      </div>
                    )}
                    <div className={`max-w-[80%] sm:max-w-[70%] rounded-2xl px-4 py-3 ${
                      msg.role === 'user'
                        ? 'bg-[#4a7c25] text-white rounded-br-md'
                        : msg.isError
                        ? 'bg-red-50 text-red-700 border border-red-200 rounded-bl-md'
                        : 'bg-white text-gray-800 shadow-sm border border-gray-200 rounded-bl-md'
                    }`}>
                      <p className="text-sm whitespace-pre-wrap break-words">{msg.content}</p>
                      <span className="text-xs opacity-50 mt-1 block">
                        {msg.timestamp instanceof Date
                          ? msg.timestamp.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })
                          : ''}
                      </span>
                    </div>
                  </div>

                  {/* Products */}
                  {msg.products && msg.products.length > 0 && (
                    <div className="mt-3 ml-9 grid grid-cols-1 sm:grid-cols-2 gap-2 max-w-[80%] sm:max-w-[70%]">
                      {msg.products.map((producto, idx) => (
                        <div
                          key={idx}
                          className="bg-white border border-gray-200 rounded-lg p-3 hover:shadow-md hover:border-[#4a7c25]/30 transition-all cursor-pointer"
                          onClick={() => handleProductClick(producto)}
                        >
                          <h4 className="font-semibold text-sm text-gray-800">{producto.nombre}</h4>
                          <p className="text-xs text-gray-500 mt-0.5">{producto.categoria}</p>
                          <p className="text-[#2d5016] font-bold mt-1 text-sm">
                            ${producto.precio?.toLocaleString('es-AR')} ARS
                          </p>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Contact button */}
                  {msg.showContactForm && (
                    <div className="mt-3 ml-9 max-w-[80%] sm:max-w-[70%]">
                      <button
                        onClick={handleContactClick}
                        className="w-full bg-green-500 hover:bg-green-600 text-white py-2.5 px-4 rounded-lg transition-colors text-sm font-medium"
                      >
                        Contactar por WhatsApp
                      </button>
                    </div>
                  )}
                </div>
              ))}

              {isLoading && (
                <div className="flex justify-start items-end gap-2">
                  <div className="w-7 h-7 bg-gradient-to-br from-[#2d5016] to-[#4a7c25] rounded-full flex items-center justify-center flex-shrink-0">
                    <MessageSquare className="w-3.5 h-3.5 text-white" />
                  </div>
                  <div className="bg-white rounded-2xl rounded-bl-md px-4 py-3 shadow-sm border border-gray-200">
                    <div className="flex gap-1">
                      <span className="w-2 h-2 bg-[#4a7c25] rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></span>
                      <span className="w-2 h-2 bg-[#4a7c25] rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></span>
                      <span className="w-2 h-2 bg-[#4a7c25] rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></span>
                    </div>
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>
          </div>

          {/* Input */}
          <div className="border-t bg-white">
            <form onSubmit={handleSendMessage} className="max-w-3xl mx-auto px-4 py-3">
              <div className="flex items-center gap-3">
                <input
                  ref={inputRef}
                  type="text"
                  value={inputMessage}
                  onChange={(e) => setInputMessage(e.target.value)}
                  placeholder="Escribe tu mensaje..."
                  className="flex-1 px-4 py-3 border border-gray-300 rounded-full focus:outline-none focus:ring-2 focus:ring-[#4a7c25] focus:border-transparent text-sm"
                  disabled={isLoading}
                  autoFocus
                />
                <button
                  type="submit"
                  disabled={isLoading || !inputMessage.trim()}
                  className="bg-[#4a7c25] text-white p-3 rounded-full hover:bg-[#2d5016] transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-md"
                  aria-label="Enviar mensaje"
                >
                  <Send className="w-5 h-5" />
                </button>
              </div>
            </form>
          </div>
        </>
      )}
    </div>
  );
}
