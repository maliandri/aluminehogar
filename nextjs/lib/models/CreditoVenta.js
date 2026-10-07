import mongoose from 'mongoose';

const QuienSchema = new mongoose.Schema({
  userId: String,
  nombre: String
}, { _id: false });

// Forma en que se cobró un pago (anticipo o cuota)
const PagoSchema = new mongoose.Schema({
  metodo: { type: String, enum: ['comprobante', 'efectivo'], required: true },
  comprobante: {
    publicId: String,
    resourceType: String,
    formato: String,
    version: Number
  },
  registradoPor: QuienSchema,
  fecha: { type: Date, default: Date.now }
}, { _id: false });

const CuotaSchema = new mongoose.Schema({
  numero: { type: Number, required: true },
  monto: { type: Number, required: true },
  vencimiento: { type: Date, required: true },
  estado: { type: String, enum: ['pendiente', 'pagada'], default: 'pendiente' },
  fechaPago: { type: Date, default: null },
  pago: { type: PagoSchema, default: undefined }
}, { _id: false });

const AprobacionSchema = new mongoose.Schema({
  tipo: { type: String, enum: ['automatica', 'admin'] },
  userId: String,
  nombre: String,
  fecha: Date
}, { _id: false });

const CreditoVentaSchema = new mongoose.Schema({
  // Cliente: los créditos nuevos referencian la ficha; los datos se copian para que el registro sea estable
  clienteId: { type: mongoose.Schema.Types.ObjectId, ref: 'Cliente', default: null },
  clienteNombre: { type: String, required: true },
  clienteTelefono: { type: String },
  clienteEmail: { type: String },
  vendedorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  vendedorNombre: { type: String },
  cargadoPor: { type: QuienSchema, default: undefined },
  depositoId: { type: String, default: null },
  productos: [{
    productId: String,
    nombre: String,
    precio: Number,
    cantidad: Number
  }],
  montoTotal: { type: Number, required: true },
  anticipo: { type: Number, default: 0 },
  anticipoPago: {
    estado: { type: String, enum: ['no_aplica', 'pendiente', 'cobrado'], default: 'no_aplica' },
    metodo: { type: String, enum: ['comprobante', 'efectivo'] },
    comprobante: { publicId: String, resourceType: String, formato: String, version: Number },
    registradoPor: QuienSchema,
    fecha: Date
  },
  // Plan elegido (créditos viejos: sin frecuencia, se consideran mensuales sin recargo)
  frecuencia: { type: String, enum: ['diaria', 'semanal', 'mensual'], default: 'mensual' },
  recargoPorcentaje: { type: Number, default: 0 },
  interes: { type: Number, default: 0 },
  totalCuotas: { type: Number },
  montoCuota: { type: Number },
  cantidadCuotas: { type: Number, required: true },
  cuotas: [CuotaSchema],
  estado: {
    type: String,
    enum: ['pendiente_aprobacion', 'activo', 'rechazado', 'completado'],
    default: 'activo'
  },
  motivoAprobacion: { type: String, default: '' },
  aprobadoPor: { type: AprobacionSchema, default: undefined },
  rechazadoPor: { type: QuienSchema, default: undefined },
  createdAt: { type: Date, default: Date.now }
});

export default mongoose.models.CreditoVenta || mongoose.model('CreditoVenta', CreditoVentaSchema);
