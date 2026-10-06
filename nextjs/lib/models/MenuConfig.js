import mongoose from 'mongoose';

// Un solo documento (_id: 'default'). Guarda solo lo editable (nombres, orden, visibilidad, roles);
// la ruta y el ícono de cada pantalla salen siempre del catálogo en código.
const MenuConfigSchema = new mongoose.Schema({
  _id: { type: String, default: 'default' },
  secciones: { type: Array, default: [] },
  items: { type: Array, default: [] },
  updatedAt: { type: Date, default: Date.now }
}, { minimize: false });

export default mongoose.models.MenuConfig || mongoose.model('MenuConfig', MenuConfigSchema);
