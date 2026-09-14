import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { login as apiLogin, register as apiRegister } from '../services/api';

export const useAuthStore = create(
  persist(
    (set, get) => ({
      user: null,
      token: null,
      isAuthenticated: false,

      // Iniciar sesión
      login: async (email, password) => {
        try {
          const data = await apiLogin(email, password);

          localStorage.setItem('authToken', data.token);

          // Decodificar el token para obtener los datos
          const payload = JSON.parse(atob(data.token.split('.')[1]));

          set({
            user: {
              id: payload.userId,
              email: payload.email,
              role: payload.role,
              nombre: data.user?.nombre || '',
              telefono: data.user?.telefono || ''
            },
            token: data.token,
            isAuthenticated: true,
          });

          return { success: true };
        } catch (error) {
          console.error('Error en login:', error);
          return {
            success: false,
            error: error.response?.data?.error || 'Error al iniciar sesión',
          };
        }
      },

      // Registrarse
      register: async (email, password, nombre, telefono) => {
        try {
          const data = await apiRegister(email, password, nombre, telefono);

          // Después del registro, hacer login automáticamente
          if (data.token) {
            localStorage.setItem('authToken', data.token);

            const payload = JSON.parse(atob(data.token.split('.')[1]));

            set({
              user: {
                id: payload.userId,
                email: payload.email,
                role: payload.role,
                nombre: data.user?.nombre || nombre || '',
                telefono: data.user?.telefono || telefono || ''
              },
              token: data.token,
              isAuthenticated: true,
            });
          }

          return { success: true };
        } catch (error) {
          console.error('Error en registro:', error);
          return {
            success: false,
            error: error.response?.data?.error || 'Error al registrarse',
          };
        }
      },

      // Cerrar sesión
      logout: () => {
        localStorage.removeItem('authToken');
        set({
          user: null,
          token: null,
          isAuthenticated: false,
        });
      },

      // Verificar si es admin
      isAdmin: () => {
        const { user } = get();
        return user?.role === 'admin';
      },

      // Verificar si es vendedor (el admin también tiene acceso a funciones de vendedor)
      isVendedor: () => {
        const { user } = get();
        return user?.role === 'vendedor' || user?.role === 'admin';
      },

      // Verificar sesión guardada
      checkAuth: () => {
        const token = localStorage.getItem('authToken');

        if (token) {
          try {
            const payload = JSON.parse(atob(token.split('.')[1]));

            // Verificar si el token no ha expirado
            if (payload.exp && payload.exp * 1000 > Date.now()) {
              set({
                user: {
                  id: payload.userId,
                  email: payload.email,
                  role: payload.role
                },
                token,
                isAuthenticated: true,
              });
              return true;
            } else {
              // Token expirado
              get().logout();
              return false;
            }
          } catch (error) {
            console.error('Error al verificar token:', error);
            get().logout();
            return false;
          }
        }
        return false;
      },
    }),
    {
      name: 'auth-storage',
    }
  )
);

// Provider opcional
export const AuthProvider = ({ children }) => children;
