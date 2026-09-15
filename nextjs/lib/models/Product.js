import mongoose from 'mongoose';

const ProductSchema = new mongoose.Schema({
  _id: { type: String, required: true },
  nombre: { type: String, required: true },
  descripcion: { type: String },
  precio: { type: Number, required: true },
  categoria: { type: String, required: true },
  marca: { type: String },
  imagen: { type: String },
  cloudinaryPublicId: { type: String },
  mostrar: { type: String },
  especificaciones: { type: String },
  stockPorDeposito: [{
    depositoId: String,
    cantidad: { type: Number, default: 0 }
  }]
}, { strict: false, collection: 'productos' });

export default mongoose.models.Product || mongoose.model('Product', ProductSchema);
