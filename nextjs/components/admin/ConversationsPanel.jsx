'use client';

import { useState, useEffect } from 'react';
import { X, ChevronLeft, ChevronRight } from 'lucide-react';
import {
  getConversaciones,
  getConversacion,
} from '@/services/api';

export default function ConversationsPanel() {
  const [conversations, setConversations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedConversation, setSelectedConversation] = useState(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [filters, setFilters] = useState({ dateFrom: '', dateTo: '', status: '' });

  useEffect(() => {
    fetchConversations();
  }, [page, filters]);

  const fetchConversations = async () => {
    try {
      setLoading(true);
      const params = { page: page.toString() };
      if (filters.dateFrom) params.dateFrom = filters.dateFrom;
      if (filters.dateTo) params.dateTo = filters.dateTo;
      if (filters.status) params.status = filters.status;

      const data = await getConversaciones(params);
      setConversations(data.conversations || []);
      setTotalPages(data.totalPages || 1);
      setTotal(data.total || 0);
    } catch (error) {
      console.error('Error cargando conversaciones:', error);
    } finally {
      setLoading(false);
    }
  };

  const openConversation = async (conv) => {
    try {
      setLoadingDetail(true);
      const data = await getConversacion(conv._id);
      setSelectedConversation(data.conversation);
    } catch (error) {
      console.error('Error cargando conversacion:', error);
      alert('Error al cargar la conversacion');
    } finally {
      setLoadingDetail(false);
    }
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '-';
    const d = new Date(dateStr);
    return d.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: '2-digit' }) +
      ' ' + d.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });
  };

  const statusBadge = (status) => {
    const styles = {
      active: 'bg-blue-100 text-blue-800',
      closed: 'bg-gray-100 text-gray-800',
      lead_captured: 'bg-green-100 text-green-800'
    };
    const labels = {
      active: 'Activa',
      closed: 'Cerrada',
      lead_captured: 'Lead'
    };
    return (
      <span className={`px-2 py-1 rounded text-xs font-medium ${styles[status] || 'bg-gray-100 text-gray-600'}`}>
        {labels[status] || status}
      </span>
    );
  };

  return (
    <>
      {/* Filtros */}
      <div className="bg-white shadow rounded-lg p-4 mb-4">
        <div className="flex flex-col md:flex-row gap-3 items-end">
          <div>
            <label className="block text-xs text-gray-500 mb-1">Desde</label>
            <input
              type="date"
              value={filters.dateFrom}
              onChange={(e) => { setFilters({ ...filters, dateFrom: e.target.value }); setPage(1); }}
              className="border rounded px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Hasta</label>
            <input
              type="date"
              value={filters.dateTo}
              onChange={(e) => { setFilters({ ...filters, dateTo: e.target.value }); setPage(1); }}
              className="border rounded px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Estado</label>
            <select
              value={filters.status}
              onChange={(e) => { setFilters({ ...filters, status: e.target.value }); setPage(1); }}
              className="border rounded px-3 py-2 text-sm"
            >
              <option value="">Todos</option>
              <option value="active">Activas</option>
              <option value="lead_captured">Con lead</option>
              <option value="closed">Cerradas</option>
            </select>
          </div>
          {(filters.dateFrom || filters.dateTo || filters.status) && (
            <button
              onClick={() => { setFilters({ dateFrom: '', dateTo: '', status: '' }); setPage(1); }}
              className="text-sm text-gray-500 hover:text-gray-700 underline"
            >
              Limpiar filtros
            </button>
          )}
        </div>
        <p className="text-xs text-gray-500 mt-2">
          {total} conversacion{total !== 1 ? 'es' : ''} encontrada{total !== 1 ? 's' : ''}
        </p>
      </div>

      {/* Table */}
      {loading ? (
        <div className="text-center py-12 text-gray-500">Cargando conversaciones...</div>
      ) : (
        <div className="bg-white shadow rounded-lg overflow-hidden">
          <table className="min-w-full">
            <thead className="bg-gray-100">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase">Fecha</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase">Usuario</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase">Mensajes</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase">Estado</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase">Lead</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-700 uppercase">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {conversations.map((conv) => (
                <tr key={conv._id} className="hover:bg-gray-50 cursor-pointer" onClick={() => openConversation(conv)}>
                  <td className="px-6 py-4 text-sm">{formatDate(conv.createdAt)}</td>
                  <td className="px-6 py-4 text-sm">
                    {conv.userInfo?.nombre || conv.userInfo?.email || 'Anonimo'}
                    {conv.userInfo?.email && (
                      <span className="block text-xs text-gray-400">{conv.userInfo.email}</span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-sm">{conv.messageCount || 0}</td>
                  <td className="px-6 py-4">{statusBadge(conv.status)}</td>
                  <td className="px-6 py-4">
                    {conv.leadCaptured ? (
                      <span className="inline-flex items-center gap-1 text-green-600 text-xs font-medium">
                        <span className="w-2 h-2 bg-green-500 rounded-full"></span>
                        Si
                      </span>
                    ) : (
                      <span className="text-gray-400 text-xs">No</span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <button className="text-blue-600 hover:text-blue-800 text-sm">Ver</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {conversations.length === 0 && (
            <div className="text-center py-12 text-gray-500">
              No hay conversaciones registradas.
            </div>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-6 py-3 bg-gray-50 border-t">
              <span className="text-sm text-gray-500">Pagina {page} de {totalPages}</span>
              <div className="flex gap-2">
                <button
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="p-2 rounded hover:bg-gray-200 disabled:opacity-30"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  className="p-2 rounded hover:bg-gray-200 disabled:opacity-30"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Conversation Detail Modal */}
      {(selectedConversation || loadingDetail) && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between p-4 border-b">
              <div>
                <h3 className="font-bold text-lg">Detalle de Conversacion</h3>
                {selectedConversation && (
                  <p className="text-xs text-gray-500">
                    {formatDate(selectedConversation.createdAt)} - {selectedConversation.messageCount} mensajes
                    {selectedConversation.leadCaptured && ' - Lead capturado'}
                  </p>
                )}
              </div>
              <button onClick={() => setSelectedConversation(null)} className="p-2 hover:bg-gray-100 rounded">
                <X className="w-5 h-5" />
              </button>
            </div>

            {loadingDetail ? (
              <div className="flex-1 flex items-center justify-center p-8">
                <span className="text-gray-500">Cargando...</span>
              </div>
            ) : selectedConversation && (
              <>
                {/* Lead info */}
                {selectedConversation.leadCaptured && selectedConversation.leadData && (
                  <div className="mx-4 mt-4 p-3 bg-green-50 border border-green-200 rounded-lg">
                    <p className="text-xs font-medium text-green-800 mb-1">Datos del Lead:</p>
                    <div className="text-xs text-green-700 space-y-0.5">
                      {selectedConversation.leadData.nombre && <p>Nombre: {selectedConversation.leadData.nombre}</p>}
                      {selectedConversation.leadData.email && <p>Email: {selectedConversation.leadData.email}</p>}
                      {selectedConversation.leadData.telefono && <p>Tel: {selectedConversation.leadData.telefono}</p>}
                      {selectedConversation.leadData.interes && <p>Interes: {selectedConversation.leadData.interes}</p>}
                    </div>
                  </div>
                )}

                {/* Messages */}
                <div className="flex-1 overflow-y-auto p-4 space-y-3">
                  {selectedConversation.messages?.map((msg, idx) => (
                    <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                      <div className={`max-w-[80%] rounded-2xl px-4 py-2 ${
                        msg.role === 'user'
                          ? 'bg-blue-600 text-white'
                          : 'bg-gray-100 text-gray-800'
                      }`}>
                        <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                        {msg.products && msg.products.length > 0 && (
                          <div className="mt-2 space-y-1">
                            {msg.products.map((p, pidx) => (
                              <div key={pidx} className="text-xs bg-white/20 rounded px-2 py-1">
                                {p.nombre} - ${p.precio?.toLocaleString('es-AR')}
                              </div>
                            ))}
                          </div>
                        )}
                        <span className="text-xs opacity-60 mt-1 block">
                          {msg.timestamp ? new Date(msg.timestamp).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' }) : ''}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}

// =================== PRODUCT FORM ===================
