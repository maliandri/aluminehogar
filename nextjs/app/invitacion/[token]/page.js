'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { aceptarInvitacion } from '@/services/api';
import { useAuthStore } from '@/store/authStore';

export default function AceptarInvitacionPage() {
  const { token } = useParams();
  const router = useRouter();
  const checkAuth = useAuthStore((state) => state.checkAuth);
  const isAdmin = useAuthStore((state) => state.isAdmin);

  const [nombre, setNombre] = useState('');
  const [telefono, setTelefono] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (password.length < 6) {
      setError('La contraseña debe tener al menos 6 caracteres');
      return;
    }
    if (password !== confirmPassword) {
      setError('Las contraseñas no coinciden');
      return;
    }

    setLoading(true);
    try {
      const data = await aceptarInvitacion(token, { password, nombre, telefono });

      localStorage.setItem('authToken', data.token);
      checkAuth();

      router.push(isAdmin() ? '/admin' : '/');
    } catch (err) {
      setError(err.response?.data?.error || 'No se pudo activar la invitación');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container mx-auto p-8 max-w-md">
      <div className="bg-white rounded-xl shadow-lg p-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Activá tu cuenta</h1>
        <p className="text-gray-600 mb-6">Completá tus datos para crear tu contraseña.</p>

        {error && (
          <div className="bg-red-50 text-red-700 text-sm rounded-lg p-3 mb-4">{error}</div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Nombre</label>
            <input
              type="text"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              className="w-full border rounded px-3 py-2"
              autoFocus
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Teléfono</label>
            <input
              type="tel"
              value={telefono}
              onChange={(e) => setTelefono(e.target.value)}
              className="w-full border rounded px-3 py-2"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Contraseña</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full border rounded px-3 py-2"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Confirmar contraseña</label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full border rounded px-3 py-2"
              required
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-primary text-white rounded px-4 py-2 font-medium hover:opacity-90 disabled:opacity-50"
          >
            {loading ? 'Activando...' : 'Activar cuenta'}
          </button>
        </form>
      </div>
    </div>
  );
}
