import { useState, useEffect } from 'react';
import { crearInvitacion, listarInvitaciones, revocarInvitacion } from '../services/api';

const ROLE_LABELS = {
  customer: 'Cliente',
  vendedor: 'Vendedor/a',
  admin: 'Administrador/a'
};

export function InvitationsPanel() {
  const [invitations, setInvitations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('vendedor');
  const [sending, setSending] = useState(false);

  useEffect(() => {
    fetchInvitations();
  }, []);

  const fetchInvitations = async () => {
    try {
      setLoading(true);
      const data = await listarInvitaciones();
      setInvitations(data.invitations);
    } catch (error) {
      console.error('Error al listar invitaciones:', error);
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
      alert('Invitación enviada');
      fetchInvitations();
    } catch (error) {
      alert(error.response?.data?.error || 'Error al enviar la invitación');
    } finally {
      setSending(false);
    }
  };

  const handleRevocar = async (id) => {
    if (!confirm('¿Revocar esta invitación?')) return;

    try {
      await revocarInvitacion(id);
      fetchInvitations();
    } catch (error) {
      alert(error.response?.data?.error || 'Error al revocar la invitación');
    }
  };

  return (
    <div>
      <div className="bg-white shadow rounded-lg p-6 mb-6">
        <h2 className="text-lg font-semibold mb-4">Invitar usuario</h2>
        <form onSubmit={handleInvitar} className="flex flex-col sm:flex-row gap-3">
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="email@ejemplo.com"
            className="flex-1 border rounded px-3 py-2"
            required
          />
          <select
            value={role}
            onChange={(e) => setRole(e.target.value)}
            className="border rounded px-3 py-2"
          >
            <option value="customer">Cliente</option>
            <option value="vendedor">Vendedor/a</option>
            <option value="admin">Administrador/a</option>
          </select>
          <button
            type="submit"
            disabled={sending}
            className="bg-blue-600 text-white px-6 py-2 rounded hover:bg-blue-700 disabled:bg-gray-400"
          >
            {sending ? 'Enviando...' : 'Enviar invitación'}
          </button>
        </form>
      </div>

      <div className="bg-white shadow rounded-lg overflow-hidden">
        <table className="min-w-full">
          <thead className="bg-gray-100">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase">Email</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase">Rol</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase">Estado</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase">Vence</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {loading ? (
              <tr><td colSpan={5} className="px-6 py-6 text-center text-gray-500">Cargando...</td></tr>
            ) : invitations.length === 0 ? (
              <tr><td colSpan={5} className="px-6 py-6 text-center text-gray-500">No hay invitaciones todavía.</td></tr>
            ) : (
              invitations.map((inv) => {
                const expirada = !inv.usedAt && new Date(inv.expiresAt) < new Date();
                return (
                  <tr key={inv._id}>
                    <td className="px-6 py-3">{inv.email}</td>
                    <td className="px-6 py-3">{ROLE_LABELS[inv.role] || inv.role}</td>
                    <td className="px-6 py-3">
                      {inv.usedAt ? (
                        <span className="text-green-600">Aceptada</span>
                      ) : expirada ? (
                        <span className="text-gray-400">Expirada</span>
                      ) : (
                        <span className="text-yellow-600">Pendiente</span>
                      )}
                    </td>
                    <td className="px-6 py-3">{new Date(inv.expiresAt).toLocaleDateString()}</td>
                    <td className="px-6 py-3">
                      {!inv.usedAt && !expirada && (
                        <button
                          onClick={() => handleRevocar(inv._id)}
                          className="text-red-600 hover:text-red-800"
                        >
                          Revocar
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
