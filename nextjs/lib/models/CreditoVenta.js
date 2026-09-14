import mongoose from 'mongoose';

const CuotaSchema = new mongoose.Schema({
  numero: { type: Number, required: true },
  monto: { type: Number, required: true },
  vencimiento: { type: Date, required: true },
  estado: { type: String, enum: ['pendiente', 'pagada'], default: 'pendiente' },
  fechaPago: { type: Date, default: null }
}, { _id: false });

const CreditoVentaSchema = new mongoose.Schema({
  clienteNombre: { type: String, required: true },
  clienteTelefono: { type: String },
  clienteEmail: { type: String },
  vendedorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  vendedorNombre: { type: String },
  productos: [{
    nombre: String,
    precio: Number,
    cantidad: Number
  }],
  montoTotal: { type: Number, required: true },
  anticipo: { type: Number, default: 0 },
  cantidadCuotas: { type: Number, required: true },
  cuotas: [CuotaSchema],
  estado: {
    type: String,
    enum: ['pendiente_aprobacion', 'activo', 'rechazado', 'completado'],
    default: 'activo'
  },
  createdAt: { type: Date, default: Date.now }
});

export default mongoose.models.CreditoVenta || mongoose.model('CreditoVenta', CreditoVentaSchema);
