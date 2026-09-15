import mongoose from 'mongoose';

const DepositoSchema = new mongoose.Schema({
  codigo: { type: String, required: true },
  nombre: { type: String, required: true },
  esVirtualVendedor: { type: Boolean, default: false },
  activo: { type: Boolean, default: true },
  createdAt: { type: Date, default: Date.now }
});

export default mongoose.models.Deposito || mongoose.model('Deposito', DepositoSchema);
