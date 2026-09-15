import mongoose from 'mongoose';

const MedioPagoSchema = new mongoose.Schema({
  nombre: { type: String, required: true },
  tipo: { type: String, enum: ['unico', 'cuotas'], default: 'unico' },
  tasaInteres: { type: Number, default: 0 },
  cantidadCuotas: { type: Number, default: 1 },
  scope: { type: [String], default: ['online', 'vendedor'] },
  aplicaA: { type: String, enum: ['todos', 'categoria', 'marca', 'producto'], default: 'todos' },
  aplicaAValores: { type: [String], default: [] },
  activo: { type: Boolean, default: true },
  createdAt: { type: Date, default: Date.now }
});

export default mongoose.models.MedioPago || mongoose.model('MedioPago', MedioPagoSchema);
