/**
 * API de invitaciones de usuarios
 * Maneja /api/invitations?action=create|list|revoke|accept
 */
import crypto from 'crypto';
import { connectDB } from './_lib/db.js';
import User from './_lib/models/User.js';
import Invitation from './_lib/models/Invitation.js';
import { extractTokenFromRequest, verifyToken, requireRole, generateToken } from './_lib/auth-helpers.js';
import { enviarEmail } from './_lib/email.js';

const ROLES_INVITABLES = ['customer', 'vendedor', 'admin'];
const INVITATION_TTL_DIAS = 7;

const ROLE_LABELS = {
  customer: 'Cliente',
  vendedor: 'Vendedor/a',
  admin: 'Administrador/a'
};

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    await connectDB();

    const { action } = req.query;

    // =================== ACEPTAR INVITACIÓN (público, sin token de sesión) ===================
    if (action === 'accept' && req.method === 'POST') {
      const { token, password, nombre, telefono } = req.body;

      if (!token || !password) {
        return res.status(400).json({ error: 'Token y contraseña son requeridos' });
      }
      if (password.length < 6) {
        return res.status(400).json({ error: 'La contraseña debe tener al menos 6 caracteres' });
      }

      const invitation = await Invitation.findOne({ token });
      if (!invitation) {
        return res.status(404).json({ error: 'Invitación no encontrada' });
      }
      if (invitation.usedAt) {
        return res.status(400).json({ error: 'Esta invitación ya fue utilizada' });
      }
      if (invitation.expiresAt < new Date()) {
        return res.status(400).json({ error: 'Esta invitación expiró' });
      }

      const existingUser = await User.findOne({ email: invitation.email });
      if (existingUser) {
        return res.status(400).json({ error: 'Ya existe una cuenta con este email' });
      }

      const newUser = new User({
        email: invitation.email,
        password,
        nombre: nombre || '',
        telefono: telefono || '',
        role: invitation.role
      });
      await newUser.save();

      invitation.usedAt = new Date();
      await invitation.save();

      const jwtToken = generateToken(newUser._id, newUser.email, newUser.role);

      console.log(`✅ Invitación aceptada: ${newUser.email} (${newUser.role})`);

      return res.status(201).json({
        success: true,
        message: 'Cuenta creada exitosamente',
        token: jwtToken,
        user: {
          id: newUser._id,
          email: newUser.email,
          nombre: newUser.nombre,
          role: newUser.role
        }
      });
    }

    // =================== A PARTIR DE ACÁ: requiere sesión de admin ===================
    const token = extractTokenFromRequest(req);
    if (!token) {
      return res.status(401).json({ error: 'Token de autenticación requerido' });
    }
    const decoded = verifyToken(token);
    requireRole(decoded, ['admin']);

    // =================== CREAR INVITACIÓN ===================
    if (action === 'create' && req.method === 'POST') {
      const { email, role } = req.body;

      if (!email || !role) {
        return res.status(400).json({ error: 'Email y rol son requeridos' });
      }
      if (!ROLES_INVITABLES.includes(role)) {
        return res.status(400).json({ error: 'Rol inválido' });
      }

      const emailLower = email.toLowerCase();

      const existingUser = await User.findOne({ email: emailLower });
      if (existingUser) {
        return res.status(400).json({ error: 'Ya existe una cuenta con este email' });
      }

      const existingInvitation = await Invitation.findOne({ email: emailLower, usedAt: null });
      if (existingInvitation) {
        return res.status(400).json({ error: 'Ya existe una invitación pendiente para este email' });
      }

      const inviteToken = crypto.randomBytes(32).toString('hex');
      const expiresAt = new Date(Date.now() + INVITATION_TTL_DIAS * 24 * 60 * 60 * 1000);

      const invitation = new Invitation({
        email: emailLower,
        role,
        token: inviteToken,
        invitadoPor: decoded.userId,
        expiresAt
      });
      await invitation.save();

      const linkInvitacion = `${process.env.FRONTEND_URL}/invitacion/${inviteToken}`;
      const asunto = 'Invitación a Aluminé Hogar';
      const cuerpoHtml = `
        <html>
          <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
            <div style="max-width: 600px; margin: 20px auto; padding: 20px; border: 1px solid #ddd; border-radius: 8px;">
              <h2>Te invitaron a Aluminé Hogar</h2>
              <p>Fuiste invitado/a a unirte como <strong>${ROLE_LABELS[role] || role}</strong>.</p>
              <p>Hacé click en el siguiente enlace para crear tu contraseña y activar tu cuenta:</p>
              <p style="text-align: center; margin: 30px 0;">
                <a href="${linkInvitacion}" style="display: inline-block; padding: 12px 25px; background-color: #ff2600; color: white; text-decoration: none; border-radius: 5px; font-weight: bold;">Activar mi cuenta</a>
              </p>
              <p>Este enlace vence en ${INVITATION_TTL_DIAS} días.</p>
              <p>Saludos,<br>El equipo de Aluminé Hogar</p>
            </div>
          </body>
        </html>
      `;

      enviarEmail({ destinatario: emailLower, asunto, cuerpoHtml })
        .catch(err => console.error('Error al enviar email de invitación:', err));

      console.log(`✅ Invitación creada para ${emailLower} (${role}) por ${decoded.email}`);

      return res.status(201).json({
        success: true,
        message: 'Invitación enviada',
        invitation: {
          id: invitation._id,
          email: invitation.email,
          role: invitation.role,
          expiresAt: invitation.expiresAt
        }
      });
    }

    // =================== LISTAR INVITACIONES ===================
    if (action === 'list' && req.method === 'GET') {
      const invitations = await Invitation.find({})
        .sort({ createdAt: -1 })
        .lean();

      return res.status(200).json({
        success: true,
        invitations
      });
    }

    // =================== REVOCAR INVITACIÓN ===================
    if (action === 'revoke' && req.method === 'POST') {
      const { id } = req.body;

      if (!id) {
        return res.status(400).json({ error: 'ID de invitación requerido' });
      }

      const invitation = await Invitation.findById(id);
      if (!invitation) {
        return res.status(404).json({ error: 'Invitación no encontrada' });
      }
      if (invitation.usedAt) {
        return res.status(400).json({ error: 'No se puede revocar una invitación ya utilizada' });
      }

      await Invitation.deleteOne({ _id: id });

      return res.status(200).json({ success: true, message: 'Invitación revocada' });
    }

    return res.status(400).json({ error: 'Acción inválida' });

  } catch (error) {
    console.error('Error en invitations:', error);
    if (error.message?.startsWith('Acceso denegado')) {
      return res.status(403).json({ error: error.message });
    }
    if (error.message === 'Token inválido o expirado') {
      return res.status(401).json({ error: error.message });
    }
    return res.status(500).json({ error: 'Error en el servidor.' });
  }
}
