import mongoose from 'mongoose';

const PaymentSettingsSchema = new mongoose.Schema({
  _id: { type: String, default: 'default' },
  maxCuotasMercadoPago: { type: Number, default: 12 },
  creditoMontoMaximo: { type: Number, default: 200000 },
  creditoCuotasMaximo: { type: Number, default: 6 },
  updatedAt: { type: Date, default: Date.now }
});

export default mongoose.models.PaymentSettings || mongoose.model('PaymentSettings', PaymentSettingsSchema);
