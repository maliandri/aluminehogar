/**
 * Helpers para autenticación JWT
 */
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';

const JWT_SECRET = process.env.JWT_SECRET || 'tu-secreto-super-seguro-cambialo-en-produccion';
const JWT_EXPIRES_IN = '7d'; // Token válido por 7 días

/**
 * Genera un token JWT para el usuario
 */
export function generateToken(userId, email, role) {
  return jwt.sign(
    { userId, email, role },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES_IN }
  );
}

/**
 * Verifica y decodifica un token JWT
 */
export function verifyToken(token) {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch (error) {
    throw new Error('Token inválido o expirado');
  }
}

/**
 * Compara una contraseña con el hash almacenado
 */
export async function comparePassword(password, hashedPassword) {
  return await bcrypt.compare(password, hashedPassword);
}

/**
 * Middleware para verificar autenticación
 */
export function extractTokenFromRequest(req) {
  // Buscar token en header Authorization
  const authHeader = req.headers.authorization || req.headers.Authorization;

  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.substring(7);
  }

  // Buscar token en cookies (alternativa)
  if (req.headers.cookie) {
    const cookies = req.headers.cookie.split(';');
    for (const cookie of cookies) {
      const [name, value] = cookie.trim().split('=');
      if (name === 'auth_token') {
        return value;
      }
    }
  }

  return null;
}

/**
 * Verifica que el usuario tenga alguno de los roles permitidos
 */
export function requireRole(decoded, roles = []) {
  if (!roles.includes(decoded.role)) {
    throw new Error(`Acceso denegado: se requiere rol ${roles.join(' o ')}`);
  }
}

/**
 * Verifica que el usuario sea admin
 */
export function requireAdmin(decoded) {
  requireRole(decoded, ['admin']);
}
