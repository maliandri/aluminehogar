import mongoose from 'mongoose';

// Un solo documento (_id: 'default'), mismo patrón que PaymentSettings y SiteConfig
const CreditoConfigSchema = new mongoose.Schema({
  _id: { type: String, default: 'default' },
  montoMaximoSinAprobacion: { type: Number, default: 200000 },
  planes: { type: Array, default: [] },
  updatedAt: { type: Date, default: Date.now }
}, { minimize: false });

export default mongoose.models.CreditoConfig || mongoose.model('CreditoConfig', CreditoConfigSchema);
