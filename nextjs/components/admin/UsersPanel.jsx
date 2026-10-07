'use client';

import { useState, useEffect } from 'react';
import { Search, Trash2, Loader2, Ban, UserCheck } from 'lucide-react';
import {
  getUsuarios,
  actualizarUsuario,
  eliminarUsuario,
  crearInvitacion,
  listarInvitaciones,
  revocarInvitacion,
  listarClientes,
} from '@/services/api';

const ROLE_LABELS_INVITACION = { customer: 'Cliente', vendedor: 'Vendedor', admin: 'Admin' };

function InvitationsBlock() {
  const [invitations, setInvitations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('vendedor');
  const [sending, setSending] = useState(false);

  useEffect(() => { fetchInvitations(); }, []);

  const fetchInvitations = async () => {
    try {
      setLoading(true);
      const data = await listarInvitaciones();
      setInvitations(data.invitations || []);
    } catch {
      // silencioso: no bloquea el resto del panel
    } finally {
      setLoading(false);
    }
  };

  const handleInvitar = async (e) => {
    e.preventDefault();
    if (!email) return;
    setSending(true);
    try {
      await crearInvitacion(email, role);
      setEmail('');
      fetchInvitations();
    } catch (err) {
      alert(err.response?.data?.error || 'Error al enviar la invitacion');
    } finally {
      setSending(false);
    }
  };

  const handleRevocar = async (id) => {
    if (!confirm('¿Revocar esta invitación?')) return;
    try {
      await revocarInvitacion(id);
      fetchInvitations();
    } catch (err) {
      alert(err.response?.data?.error || 'Error al revocar la invitación');
    }
  };

  const pendientes = invitations.filter(inv => !inv.usedAt && new Date(inv.expiresAt) >= new Date());

  return (
    <div className="bg-white shadow rounded-lg p-4 mb-4">
      <h3 className="text-sm font-semibold text-gray-700 mb-3">Invitar usuario nuevo</h3>
      <form onSubmit={handleInvitar} className="flex flex-col sm:flex-row gap-2 mb-4">
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="email@ejemplo.com"
          className="flex-1 border rounded px-3 py-2 text-sm"
          required
        />
        <select
          value={role}
          onChange={(e) => setRole(e.target.value)}
          className="border rounded px-3 py-2 text-sm"
        >
          <option value="customer">Cliente</option>
          <option value="vendedor">Vendedor</option>
          <option value="admin">Admin</option>
        </select>
        <button
          type="submit"
          disabled={sending}
          className="bg-blue-600 text-white px-4 py-2 rounded text-sm hover:bg-blue-700 disabled:bg-gray-400"
        >
          {sending ? 'Enviando...' : 'Invitar'}
        </button>
      </form>

      {!loading && pendientes.length > 0 && (
        <div className="space-y-1">
          <p className="text-xs font-medium text-gray-500 mb-1">Invitaciones pendientes</p>
          {pendientes.map((inv) => (
            <div key={inv._id} className="flex items-center justify-between text-sm py-1 border-t">
              <span>{inv.email} — <span className="text-xs text-gray-500">{ROLE_LABELS_INVITACION[inv.role] || inv.role}</span></span>
              <button onClick={() => handleRevocar(inv._id)} className="text-red-600 hover:text-red-800 text-xs">
                Revocar
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ClientesDeVendedoresBlock() {
  const [clientes, setClientes] = useState([]);
  const [q, setQ] = useState('');
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelado = false;
    const espera = setTimeout(() => {
      setCargando(true);
      listarClientes(q)
        .then((data) => { if (!cancelado) { setClientes(data.clientes || []); setError(null); } })
        .catch(() => { if (!cancelado) { setClientes([]); setError('No se pudieron cargar los clientes'); } })
        .finally(() => { if (!cancelado) setCargando(false); });
    }, 300);
    // Si cambia la búsqueda, la respuesta vieja se descarta
    return () => { cancelado = true; clearTimeout(espera); };
  }, [q]);

  return (
    <div className="bg-white shadow rounded-lg p-6 space-y-3">
      <h3 className="text-lg font-semibold">Clientes cargados por vendedores</h3>
      <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar por nombre, documento o teléfono"
        aria-label="Buscar clientes de vendedores" className="w-full border rounded px-3 py-2 text-sm" />
      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead className="text-left text-xs uppercase text-gray-600">
            <tr><th className="py-2 pr-4">Cliente</th><th className="py-2 pr-4">Documento</th><th className="py-2 pr-4">Teléfono</th><th className="py-2 pr-4">Email</th><th className="py-2">Cargado por</th></tr>
          </thead>
          <tbody className="divide-y">
            {clientes.map((c) => (
              <tr key={c._id}>
                <td className="py-2 pr-4">
                  {c.nombre}{' '}
                  <span className="ml-1 px-2 py-0.5 rounded text-xs bg-purple-100 text-purple-700">Cliente creado por vendedor</span>
                </td>
                <td className="py-2 pr-4">{c.tipoDocumento} {c.numeroDocumento}</td>
                <td className="py-2 pr-4">{c.telefono}</td>
                <td className="py-2 pr-4 max-w-[14rem] truncate" title={c.email}>{c.email}</td>
                <td className="py-2">{c.creadoPor?.nombre || '-'}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {error && <p role="alert" className="text-sm text-red-700 py-4">{error}</p>}
        {!cargando && !error && clientes.length === 0 && <p className="text-sm text-gray-500 py-4">No hay clientes cargados por vendedores.</p>}
      </div>
    </div>
  );
}

export default function UsersPanel({ currentUserId }) {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [updating, setUpdating] = useState(null);

  useEffect(() => { fetchUsers(); }, []);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const data = await getUsuarios();
      setUsers(data.users || []);
    } catch {
      alert('Error al cargar usuarios');
    } finally {
      setLoading(false);
    }
  };

  const handleRoleChange = async (userId, role) => {
    const labels = { customer: 'cliente', vendedor: 'vendedor', admin: 'administrador' };
    if (!confirm(`¿Cambiar rol a ${labels[role]}?`)) return;
    setUpdating(userId);
    try {
      await actualizarUsuario(userId, { role });
      setUsers(prev => prev.map(u => u._id === userId ? { ...u, role } : u));
    } catch (e) {
      alert(e.response?.data?.error || 'Error al actualizar usuario');
    } finally {
      setUpdating(null);
    }
  };

  const handleBan = async (userId, banned) => {
    if (!confirm(banned ? '¿Banear este usuario?' : '¿Desbanear este usuario?')) return;
    setUpdating(userId);
    try {
      await actualizarUsuario(userId, { banned });
      setUsers(prev => prev.map(u => u._id === userId ? { ...u, banned } : u));
    } catch (e) {
      alert(e.response?.data?.error || 'Error al actualizar usuario');
    } finally {
      setUpdating(null);
    }
  };

  const handleDelete = async (userId, email) => {
    if (!confirm(`¿Eliminar permanentemente a "${email}"? Esta acción no se puede deshacer.`)) return;
    setUpdating(userId);
    try {
      await eliminarUsuario(userId);
      setUsers(prev => prev.filter(u => u._id !== userId));
    } catch (e) {
      alert(e.response?.data?.error || 'Error al eliminar usuario');
    } finally {
      setUpdating(null);
    }
  };

  const roleBadge = (role) => {
    const styles = {
      admin: 'bg-purple-100 text-purple-800',
      vendedor: 'bg-blue-100 text-blue-800',
      customer: 'bg-gray-100 text-gray-700',
    };
    const labels = { admin: 'Admin', vendedor: 'Vendedor', customer: 'Cliente' };
    return (
      <span className={`px-2 py-1 rounded text-xs font-medium ${styles[role] || 'bg-gray-100 text-gray-600'}`}>
        {labels[role] || role}
      </span>
    );
  };

  const filtered = users.filter(u =>
    !search ||
    u.email?.toLowerCase().includes(search.toLowerCase()) ||
    u.nombre?.toLowerCase().includes(search.toLowerCase())
  );

  if (loading) return <div className="text-center py-12 text-gray-500">Cargando usuarios...</div>;

  return (
    <>
      <InvitationsBlock />
      <ClientesDeVendedoresBlock />

      <div className="bg-white shadow rounded-lg p-4 mb-4">
        <div className="flex gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
            <input
              type="text"
              placeholder="Buscar por email o nombre..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full border rounded px-3 py-2 pl-9 text-sm"
            />
          </div>
        </div>
        <p className="text-xs text-gray-500 mt-2">{filtered.length} de {users.length} usuarios</p>
      </div>

      <div className="bg-white shadow rounded-lg overflow-hidden overflow-x-auto">
        <table className="min-w-full">
          <thead className="bg-gray-100">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase">Usuario</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase">Rol</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase">Estado</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase">Registro</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-700 uppercase">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {filtered.map((u) => {
              const isMe = u._id === currentUserId;
              const isBusy = updating === u._id;
              return (
                <tr key={u._id} className={`hover:bg-gray-50 ${u.banned ? 'bg-red-50' : ''}`}>
                  <td className="px-4 py-3">
                    <div className="font-medium text-sm">{u.nombre || '—'}</div>
                    <div className="text-xs text-gray-500">{u.email}</div>
                    {isMe && <span className="text-xs text-blue-500">(vos)</span>}
                  </td>
                  <td className="px-4 py-3">{roleBadge(u.role)}</td>
                  <td className="px-4 py-3">
                    {u.banned
                      ? <span className="px-2 py-1 rounded text-xs font-medium bg-red-100 text-red-700">Baneado</span>
                      : <span className="px-2 py-1 rounded text-xs font-medium bg-green-100 text-green-700">Activo</span>
                    }
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-500">
                    {u.createdAt ? new Date(u.createdAt).toLocaleDateString('es-AR') : '—'}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {isMe || isBusy ? (
                      isBusy ? <Loader2 className="w-4 h-4 animate-spin inline text-gray-400" /> : null
                    ) : (
                      <div className="flex items-center justify-end gap-2">
                        {/* Cambio de rol */}
                        <select
                          value={u.role}
                          onChange={(e) => handleRoleChange(u._id, e.target.value)}
                          className="text-xs border rounded px-2 py-1"
                          title="Cambiar rol"
                        >
                          <option value="customer">Cliente</option>
                          <option value="vendedor">Vendedor</option>
                          <option value="admin">Admin</option>
                        </select>
                        {/* Ban / Unban */}
                        <button
                          onClick={() => handleBan(u._id, !u.banned)}
                          title={u.banned ? 'Desbanear' : 'Banear'}
                          className={`p-1.5 rounded transition-colors ${u.banned ? 'text-green-600 hover:bg-green-50' : 'text-orange-500 hover:bg-orange-50'}`}
                        >
                          {u.banned ? <UserCheck className="w-4 h-4" /> : <Ban className="w-4 h-4" />}
                        </button>
                        {/* Eliminar */}
                        <button
                          onClick={() => handleDelete(u._id, u.email)}
                          title="Eliminar usuario"
                          className="p-1.5 rounded text-red-600 hover:bg-red-50 transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {filtered.length === 0 && (
          <div className="text-center py-12 text-gray-500">No se encontraron usuarios.</div>
        )}
      </div>
    </>
  );
}

// =================== CREDITOS PANEL ===================
