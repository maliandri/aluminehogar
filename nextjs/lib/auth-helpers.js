import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';

const JWT_SECRET = process.env.TOKEN_SECRET || process.env.JWT_SECRET || 'tu-secreto-super-seguro-cambialo-en-produccion';
const JWT_EXPIRES_IN = '7d';

export function generateToken(userId, email, role) {
  return jwt.sign(
    { userId, email, role },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES_IN }
  );
}

export function verifyToken(token) {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch (error) {
    throw new Error('Token invalido o expirado');
  }
}

export async function comparePassword(password, hashedPassword) {
  return await bcrypt.compare(password, hashedPassword);
}

export function extractTokenFromHeaders(headers) {
  const authHeader = headers.get('authorization') || headers.get('Authorization');

  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.substring(7);
  }

  // Buscar token en cookies (alternativa)
  const cookie = headers.get('cookie');
  if (cookie) {
    const cookies = cookie.split(';');
    for (const c of cookies) {
      const [name, value] = c.trim().split('=');
      if (name === 'auth_token') {
        return value;
      }
    }
  }

  return null;
}

export function requireRole(decoded, roles = []) {
  if (!roles.includes(decoded.role)) {
    throw new Error(`Acceso denegado: se requiere rol ${roles.join(' o ')}`);
  }
}

export function requireAdmin(decoded) {
  if (decoded.role !== 'admin') {
    throw new Error('Acceso denegado: se requiere rol de administrador');
  }
}
