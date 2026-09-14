import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { connectDB } from '@/lib/db';
import User from '@/lib/models/User';
import Invitation from '@/lib/models/Invitation';
import { extractTokenFromHeaders, verifyToken, requireRole, generateToken } from '@/lib/auth-helpers';
import { enviarEmail, emailInvitacion } from '@/lib/email';

const ROLES_INVITABLES = ['customer', 'vendedor', 'admin'];
const INVITATION_TTL_DIAS = 7;

function authenticateAdmin(request) {
  const token = extractTokenFromHeaders(request.headers);
  if (!token) throw new Error('Token de autenticacion requerido');
  const decoded = verifyToken(token);
  requireRole(decoded, ['admin']);
  return decoded;
}

// GET /api/invitations -> listar invitaciones (solo admin)
export async function GET(request) {
  try {
    authenticateAdmin(request);
    await connectDB();

    const invitations = await Invitation.find({}).sort({ createdAt: -1 }).lean();

    return NextResponse.json({ success: true, invitations });
  } catch (error) {
    return handleError(error);
  }
}

// POST /api/invitations -> body { action: 'create' | 'accept', ... }
export async function POST(request) {
  try {
    await connectDB();
    const body = await request.json();
    const { action } = body;

    if (action === 'accept') {
      const { token, password, nombre, telefono } = body;

      if (!token || !password) {
        return NextResponse.json({ error: 'Token y contrasena son requeridos' }, { status: 400 });
      }
      if (password.length < 6) {
        return NextResponse.json({ error: 'La contrasena debe tener al menos 6 caracteres' }, { status: 400 });
      }

      const invitation = await Invitation.findOne({ token });
      if (!invitation) {
        return NextResponse.json({ error: 'Invitacion no encontrada' }, { status: 404 });
      }
      if (invitation.usedAt) {
        return NextResponse.json({ error: 'Esta invitacion ya fue utilizada' }, { status: 400 });
      }
      if (invitation.expiresAt < new Date()) {
        return NextResponse.json({ error: 'Esta invitacion expiro' }, { status: 400 });
      }

      const existingUser = await User.findOne({ email: invitation.email });
      if (existingUser) {
        return NextResponse.json({ error: 'Ya existe una cuenta con este email' }, { status: 400 });
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

      return NextResponse.json({
        success: true,
        message: 'Cuenta creada exitosamente',
        token: jwtToken,
        user: {
          id: newUser._id,
          email: newUser.email,
          nombre: newUser.nombre,
          role: newUser.role
        }
      }, { status: 201 });
    }

    if (action === 'create') {
      const decoded = authenticateAdmin(request);

      const { email, role } = body;
      if (!email || !role) {
        return NextResponse.json({ error: 'Email y rol son requeridos' }, { status: 400 });
      }
      if (!ROLES_INVITABLES.includes(role)) {
        return NextResponse.json({ error: 'Rol invalido' }, { status: 400 });
      }

      const emailLower = email.toLowerCase();

      const existingUser = await User.findOne({ email: emailLower });
      if (existingUser) {
        return NextResponse.json({ error: 'Ya existe una cuenta con este email' }, { status: 400 });
      }

      const existingInvitation = await Invitation.findOne({ email: emailLower, usedAt: null });
      if (existingInvitation) {
        return NextResponse.json({ error: 'Ya existe una invitacion pendiente para este email' }, { status: 400 });
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

      const linkInvitacion = `${process.env.FRONTEND_URL || 'https://aluminehogar.com.ar'}/invitacion/${inviteToken}`;

      enviarEmail({
        destinatario: emailLower,
        asunto: 'Invitacion a Alumine Hogar',
        cuerpoHtml: emailInvitacion(role, linkInvitacion)
      }).catch(err => console.error('Error al enviar email de invitacion:', err));

      return NextResponse.json({
        success: true,
        message: 'Invitacion enviada',
        invitation: {
          id: invitation._id,
          email: invitation.email,
          role: invitation.role,
          expiresAt: invitation.expiresAt
        }
      }, { status: 201 });
    }

    return NextResponse.json({ error: 'Accion invalida' }, { status: 400 });
  } catch (error) {
    return handleError(error);
  }
}

// DELETE /api/invitations?id=... -> revocar invitacion pendiente (solo admin)
export async function DELETE(request) {
  try {
    authenticateAdmin(request);
    await connectDB();

    const id = request.nextUrl.searchParams.get('id');
    if (!id) {
      return NextResponse.json({ error: 'ID de invitacion requerido' }, { status: 400 });
    }

    const invitation = await Invitation.findById(id);
    if (!invitation) {
      return NextResponse.json({ error: 'Invitacion no encontrada' }, { status: 404 });
    }
    if (invitation.usedAt) {
      return NextResponse.json({ error: 'No se puede revocar una invitacion ya utilizada' }, { status: 400 });
    }

    await Invitation.deleteOne({ _id: id });

    return NextResponse.json({ success: true, message: 'Invitacion revocada' });
  } catch (error) {
    return handleError(error);
  }
}

function handleError(error) {
  console.error('Error en invitations:', error);
  if (error.message?.startsWith('Acceso denegado')) {
    return NextResponse.json({ error: error.message }, { status: 403 });
  }
  if (error.message === 'Token invalido o expirado' || error.message === 'Token de autenticacion requerido') {
    return NextResponse.json({ error: error.message }, { status: 401 });
  }
  return NextResponse.json({ error: 'Error en el servidor.' }, { status: 500 });
}
