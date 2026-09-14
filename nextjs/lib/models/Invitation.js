import mongoose from 'mongoose';

const InvitationSchema = new mongoose.Schema({
  email: { type: String, required: true, lowercase: true },
  role: { type: String, enum: ['customer', 'vendedor', 'admin'], required: true },
  token: { type: String, required: true, unique: true },
  invitadoPor: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  expiresAt: { type: Date, required: true },
  usedAt: { type: Date, default: null },
  createdAt: { type: Date, default: Date.now }
});

export default mongoose.models.Invitation || mongoose.model('Invitation', InvitationSchema);
