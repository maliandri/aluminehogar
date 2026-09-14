import axios from 'axios';

// Configuración de la URL base de la API
const API_URL = import.meta.env.VITE_API_URL || '/api';
// Crear instancia de axios con configuración base
const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Interceptor para agregar el token de autenticación
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('authToken');
    if (token) {
      config.headers['Authorization'] = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Interceptor para manejo de errores
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Token inválido o expirado
      localStorage.removeItem('authToken');
      localStorage.removeItem('userEmail');
      window.location.href = '/';
    }
    return Promise.reject(error);
  }
);

// =================== PRODUCTOS ===================

export const getProductos = async () => {
  try {
    const response = await api.get('/productos');
    return response.data;
  } catch (error) {
    console.error('Error al obtener productos:', error);
    throw error;
  }
};

export const getCategorias = async () => {
  try {
    const response = await api.get('/categorias');
    return response.data;
  } catch (error) {
    console.error('Error al obtener categorías:', error);
    throw error;
  }
};

// =================== AUTENTICACIÓN ===================

export const login = async (email, password) => {
  try {
    const response = await api.post('/auth', { action: 'login', email, password });
    return response.data;
  } catch (error) {
    console.error('Error en login:', error);
    throw error;
  }
};

export const register = async (email, password, nombre, telefono) => {
  try {
    const response = await api.post('/auth', { action: 'register', email, password, nombre, telefono });
    return response.data;
  } catch (error) {
    console.error('Error en registro:', error);
    throw error;
  }
};

// =================== INVITACIONES ===================

export const crearInvitacion = async (email, role) => {
  try {
    const response = await api.post('/invitations?action=create', { email, role });
    return response.data;
  } catch (error) {
    console.error('Error al crear invitación:', error);
    throw error;
  }
};

export const listarInvitaciones = async () => {
  try {
    const response = await api.get('/invitations?action=list');
    return response.data;
  } catch (error) {
    console.error('Error al listar invitaciones:', error);
    throw error;
  }
};

export const revocarInvitacion = async (id) => {
  try {
    const response = await api.post('/invitations?action=revoke', { id });
    return response.data;
  } catch (error) {
    console.error('Error al revocar invitación:', error);
    throw error;
  }
};

export const aceptarInvitacion = async (token, { password, nombre, telefono }) => {
  try {
    const response = await api.post('/invitations?action=accept', { token, password, nombre, telefono });
    return response.data;
  } catch (error) {
    console.error('Error al aceptar invitación:', error);
    throw error;
  }
};

// =================== VENTAS / PRESUPUESTOS ===================

export const guardarVenta = async (ventaData) => {
  try {
    const response = await api.post('/ventas', ventaData);
    return response.data;
  } catch (error) {
    console.error('Error al guardar venta:', error);
    throw error;
  }
};

export const getHistorialVentas = async () => {
  try {
    const response = await api.get('/ventas');
    return response.data;
  } catch (error) {
    console.error('Error al obtener historial:', error);
    throw error;
  }
};

export const enviarPresupuesto = async (presupuestoData) => {
  try {
    const response = await api.post('/presupuesto/enviar', presupuestoData);
    return response.data;
  } catch (error) {
    console.error('Error al enviar presupuesto:', error);
    throw error;
  }
};

// =================== ADMIN - PRODUCTOS ===================

export const getProductosAdmin = async () => {
  try {
    const response = await api.get('/admin');
    return response.data;
  } catch (error) {
    console.error('Error al obtener productos (admin):', error);
    throw error;
  }
};

export const crearProducto = async (productoData) => {
  try {
    const response = await api.post('/admin', productoData);
    return response.data;
  } catch (error) {
    console.error('Error al crear producto:', error);
    throw error;
  }
};

export const actualizarProducto = async (id, productoData) => {
  try {
    const response = await api.put(`/admin?id=${id}`, productoData);
    return response.data;
  } catch (error) {
    console.error('Error al actualizar producto:', error);
    throw error;
  }
};

export const eliminarProducto = async (id) => {
  try {
    const response = await api.delete(`/admin?id=${id}`);
    return response.data;
  } catch (error) {
    console.error('Error al eliminar producto:', error);
    throw error;
  }
};

export const subirImagen = async (imageBase64) => {
  try {
    const response = await api.post('/admin?action=upload', { image: imageBase64 });
    return response.data;
  } catch (error) {
    console.error('Error al subir imagen:', error);
    throw error;
  }
};

// =================== MERCADO PAGO ===================

export const crearPreferenciaPago = async (items, payer, shippingAddress) => {
  try {
    const response = await api.post('/mercadopago?action=create', {
      items,
      payer,
      shippingAddress
    });
    return response.data;
  } catch (error) {
    console.error('Error al crear preferencia de pago:', error);
    throw error;
  }
};

export default api;
