import axios from 'axios';

// Configuración de la URL base de la API
const API_URL = '/api';
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
    if (typeof window !== 'undefined') {
      const token = localStorage.getItem('authToken');
      if (token) {
        config.headers['Authorization'] = `Bearer ${token}`;
      }
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
      if (typeof window !== 'undefined') {
        localStorage.removeItem('authToken');
        localStorage.removeItem('userEmail');
        window.location.href = '/';
      }
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

export const forgotPassword = async (email) => {
  const response = await api.post('/auth', { action: 'forgot-password', email });
  return response.data;
};

export const resetPassword = async (email, code, newPassword) => {
  const response = await api.post('/auth', { action: 'reset-password', email, code, newPassword });
  return response.data;
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

// =================== ADMIN - CONVERSACIONES ===================

export const getConversaciones = async (params = {}) => {
  const query = new URLSearchParams({ action: 'conversations', ...params }).toString();
  const response = await api.get(`/admin?${query}`);
  return response.data;
};

export const getConversacion = async (id) => {
  const response = await api.get(`/admin?action=conversation&id=${id}`);
  return response.data;
};

// =================== ADMIN - USUARIOS ===================

export const getUsuarios = async () => {
  const response = await api.get('/admin?action=users');
  return response.data;
};

export const actualizarUsuario = async (id, updates) => {
  const response = await api.patch(`/admin?action=user&id=${id}`, updates);
  return response.data;
};

export const eliminarUsuario = async (id) => {
  const response = await api.delete(`/admin?action=user&id=${id}`);
  return response.data;
};

export const generarEspecificacionesIA = async (productId, nombre, categoria) => {
  const response = await api.post('/admin?action=generate-specs', { productId, nombre, categoria });
  return response.data;
};

export const actualizarStock = async (id, stock) => {
  const response = await api.patch(`/admin?action=stock&id=${id}`, { stock });
  return response.data;
};

export const importarStockExcel = async (excelBase64) => {
  const response = await api.post('/admin?action=import-stock', { excelBase64 });
  return response.data;
};

// =================== INVITACIONES ===================

export const crearInvitacion = async (email, role) => {
  const response = await api.post('/invitations', { action: 'create', email, role });
  return response.data;
};

export const listarInvitaciones = async () => {
  const response = await api.get('/invitations');
  return response.data;
};

export const revocarInvitacion = async (id) => {
  const response = await api.delete(`/invitations?id=${id}`);
  return response.data;
};

export const aceptarInvitacion = async (token, { password, nombre, telefono }) => {
  const response = await api.post('/invitations', { action: 'accept', token, password, nombre, telefono });
  return response.data;
};

// =================== CREDITOS (vendedor) ===================

export const crearCredito = async (creditoData) => {
  const response = await api.post('/creditos', { action: 'create', ...creditoData });
  return response.data;
};

export const listarCreditos = async () => {
  const response = await api.get('/creditos?action=list');
  return response.data;
};

export const marcarCuotaCredito = async (id, numero) => {
  const response = await api.post('/creditos', { action: 'marcar-cuota', id, numero });
  return response.data;
};

export const aprobarCredito = async (id) => {
  const response = await api.post('/creditos', { action: 'aprobar', id });
  return response.data;
};

export const rechazarCredito = async (id) => {
  const response = await api.post('/creditos', { action: 'rechazar', id });
  return response.data;
};

// =================== CONFIGURACION DE PAGOS ===================

export const getPaymentSettings = async () => {
  const response = await api.get('/payment-settings');
  return response.data;
};

export const actualizarPaymentSettings = async (settingsData) => {
  const response = await api.put('/payment-settings', settingsData);
  return response.data;
};

// =================== DEPOSITOS ===================

export const listarDepositos = async () => {
  const response = await api.get('/depositos');
  return response.data;
};

export const crearDeposito = async (data) => {
  const response = await api.post('/depositos', data);
  return response.data;
};

export const actualizarDeposito = async (id, data) => {
  const response = await api.put(`/depositos?id=${id}`, data);
  return response.data;
};

export const eliminarDeposito = async (id) => {
  const response = await api.delete(`/depositos?id=${id}`);
  return response.data;
};

// =================== MEDIOS DE PAGO ===================

export const listarMediosPago = async (scope) => {
  const query = scope ? `?scope=${scope}` : '';
  const response = await api.get(`/medios-pago${query}`);
  return response.data;
};

export const crearMedioPago = async (data) => {
  const response = await api.post('/medios-pago', data);
  return response.data;
};

export const actualizarMedioPago = async (id, data) => {
  const response = await api.put(`/medios-pago?id=${id}`, data);
  return response.data;
};

export const eliminarMedioPago = async (id) => {
  const response = await api.delete(`/medios-pago?id=${id}`);
  return response.data;
};

// =================== PROMOCIONES ===================

export const listarPromociones = async (scope) => {
  const query = scope ? `?scope=${scope}` : '';
  const response = await api.get(`/promociones${query}`);
  return response.data;
};

export const crearPromocion = async (data) => {
  const response = await api.post('/promociones', data);
  return response.data;
};

export const actualizarPromocion = async (id, data) => {
  const response = await api.put(`/promociones?id=${id}`, data);
  return response.data;
};

export const eliminarPromocion = async (id) => {
  const response = await api.delete(`/promociones?id=${id}`);
  return response.data;
};

// =================== MERCADO PAGO ===================

export const crearPreferenciaPago = async (items, payer, shippingAddress, medioPagoId) => {
  try {
    const response = await api.post('/mercadopago?action=create', {
      items,
      payer,
      shippingAddress,
      medioPagoId
    });
    return response.data;
  } catch (error) {
    console.error('Error al crear preferencia de pago:', error);
    throw error;
  }
};

export default api;
