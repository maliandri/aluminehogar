import mongoose from 'mongoose';

const ArchivoSchema = new mongoose.Schema({
  tipo: { type: String, required: true },
  publicId: { type: String, required: true },
  resourceType: { type: String, required: true },
  formato: { type: String, default: null },
  version: { type: Number, default: null },
  subidoPor: { userId: String, nombre: String },
  fecha: { type: Date, default: Date.now }
}, { _id: false });

const ClienteSchema = new mongoose.Schema({
  nombre: { type: String, required: true },
  tipoDocumento: { type: String, required: true },
  numeroDocumento: { type: String, required: true },
  telefono: { type: String, required: true },
  email: { type: String, required: true },
  domicilio: {
    calle: String,
    numero: String,
    localidad: String,
    provincia: String
  },
  archivos: { type: [ArchivoSchema], default: [] },
  creadoPor: { userId: String, nombre: String },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

// Un documento = un cliente
ClienteSchema.index({ tipoDocumento: 1, numeroDocumento: 1 }, { unique: true });

export default mongoose.models.Cliente || mongoose.model('Cliente', ClienteSchema);
