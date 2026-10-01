import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { connectDB } from '@/lib/db';
import User from '@/lib/models/User';
import { generateToken, comparePassword } from '@/lib/auth-helpers';
import { enviarEmail, emailBienvenida, emailRecupero } from '@/lib/email';
import { getSiteConfig } from '@/lib/site-config';

export async function POST(request) {
  try {
    await connectDB();

    const body = await request.json();
    const { action, email } = body;

    if (!action || !email) {
      return NextResponse.json({ error: 'Accion y email son requeridos' }, { status: 400 });
    }

    // LOGIN
    if (action === 'login') {
      const { password } = body;
      if (!password) {
        return NextResponse.json({ error: 'Contrasena requerida' }, { status: 400 });
      }

      const user = await User.findOne({ email: email.toLowerCase() });
      if (!user) {
        return NextResponse.json({ error: 'Email o contrasena incorrectos' }, { status: 401 });
      }

      const isValidPassword = await comparePassword(password, user.password);
      if (!isValidPassword) {
        return NextResponse.json({ error: 'Email o contrasena incorrectos' }, { status: 401 });
      }

      const token = generateToken(user._id, user.email, user.role);

      return NextResponse.json({
        success: true,
        message: 'Login exitoso',
        token,
        user: {
          id: user._id,
          email: user.email,
          nombre: user.nombre,
          telefono: user.telefono,
          role: user.role
        }
      });
    }

    // REGISTER
    if (action === 'register') {
      const { password, nombre, telefono } = body;
      if (!password) {
        return NextResponse.json({ error: 'Contrasena requerida' }, { status: 400 });
      }

      if (password.length < 6) {
        return NextResponse.json({ error: 'La contrasena debe tener al menos 6 caracteres' }, { status: 400 });
      }

      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        return NextResponse.json({ error: 'Email invalido' }, { status: 400 });
      }

      const existingUser = await User.findOne({ email: email.toLowerCase() });
      if (existingUser) {
        return NextResponse.json({ error: 'Este email ya esta registrado' }, { status: 400 });
      }

      const newUser = new User({
        email: email.toLowerCase(),
        password,
        nombre: nombre || '',
        telefono: telefono || '',
        role: 'customer'
      });
      await newUser.save();

      const token = generateToken(newUser._id, newUser.email, newUser.role);

      enviarEmail({
        destinatario: email,
        asunto: 'Bienvenido/a a Alumine Hogar!',
        cuerpoHtml: emailBienvenida(nombre, (await getSiteConfig()).tienda)
      }).catch(err => console.error('Error al enviar email de bienvenida:', err));

      return NextResponse.json({
        success: true,
        message: 'Usuario registrado exitosamente',
        token,
        user: {
          id: newUser._id,
          email: newUser.email,
          nombre: newUser.nombre,
          role: newUser.role
        }
      }, { status: 201 });
    }

    // FORGOT PASSWORD
    if (action === 'forgot-password') {
      const user = await User.findOne({ email: email.toLowerCase() });

      if (user) {
        const code = crypto.randomInt(100000, 999999).toString();
        user.resetCode = code;
        user.resetCodeExpires = new Date(Date.now() + 15 * 60 * 1000);
        await user.save();

        try {
          await enviarEmail({
            destinatario: email,
            asunto: 'Codigo de recupero - Alumine Hogar',
            cuerpoHtml: emailRecupero(code, (await getSiteConfig()).tienda)
          });
          console.log('Email de recupero enviado a:', email);
        } catch (emailErr) {
          console.error('Error al enviar email de recupero:', emailErr.message, emailErr.code);
        }
      }

      return NextResponse.json({
        success: true,
        message: 'Si el email esta registrado, recibiras un codigo de recupero.'
      });
    }

    // RESET PASSWORD
    if (action === 'reset-password') {
      const { code, newPassword } = body;

      if (!code || !newPassword) {
        return NextResponse.json({ error: 'Codigo y nueva contrasena son requeridos' }, { status: 400 });
      }

      if (newPassword.length < 6) {
        return NextResponse.json({ error: 'La contrasena debe tener al menos 6 caracteres' }, { status: 400 });
      }

      const user = await User.findOne({
        email: email.toLowerCase(),
        resetCode: code,
        resetCodeExpires: { $gt: new Date() }
      });

      if (!user) {
        return NextResponse.json({ error: 'Codigo invalido o expirado' }, { status: 400 });
      }

      user.password = newPassword;
      user.resetCode = undefined;
      user.resetCodeExpires = undefined;
      await user.save();

      return NextResponse.json({
        success: true,
        message: 'Contrasena actualizada exitosamente'
      });
    }

    return NextResponse.json({ error: 'Accion invalida.' }, { status: 400 });

  } catch (error) {
    console.error('Error en autenticacion:', error);
    return NextResponse.json({ error: 'Error en el servidor.' }, { status: 500 });
  }
}
