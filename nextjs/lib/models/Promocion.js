import mongoose from 'mongoose';

const PromocionSchema = new mongoose.Schema({
  nombre: { type: String, required: true },
  tipo: { type: String, enum: ['descuento', 'combo'], default: 'descuento' },
  scope: { type: [String], default: ['online', 'vendedor'] },
  aplicaA: { type: String, enum: ['todos', 'categoria', 'marca', 'producto'], default: 'todos' },
  aplicaAValores: { type: [String], default: [] },
  descuentoPorcentaje: { type: Number, default: 0 },
  comboProductoRegaloId: { type: String, default: null },
  comboDescuentoSegundoProducto: { type: Number, default: 0 },
  vigenciaDesde: { type: Date, default: null },
  vigenciaHasta: { type: Date, default: null },
  activo: { type: Boolean, default: true },
  createdAt: { type: Date, default: Date.now }
});

export default mongoose.models.Promocion || mongoose.model('Promocion', PromocionSchema);
