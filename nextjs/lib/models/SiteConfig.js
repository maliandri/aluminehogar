import mongoose from 'mongoose';

// Un solo documento (_id: 'default'), mismo patrón que PaymentSettings
const SiteConfigSchema = new mongoose.Schema({
  _id: { type: String, default: 'default' },
  tienda: { type: Object, default: {} },
  redes: { type: Object, default: {} },
  inicio: { type: Object, default: {} },
  chatbot: { type: Object, default: {} },
  updatedAt: { type: Date, default: Date.now }
}, { minimize: false });

export default mongoose.models.SiteConfig || mongoose.model('SiteConfig', SiteConfigSchema);
