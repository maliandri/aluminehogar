import { connectDB } from '@/lib/db';
import CreditoConfig from '@/lib/models/CreditoConfig';
import PaymentSettings from '@/lib/models/PaymentSettings';
import { planesDeFabrica, normalizarPlan } from '@/lib/credito-calculo';

// Lee la configuración del crédito propio. La primera vez la siembra con lo que había en PaymentSettings
// (monto máximo y cuotas máximas) para que el comportamiento de hoy no cambie. Sin caché: es de uso interno.
export async function getCreditoConfig() {
  await connectDB();
  let doc = await CreditoConfig.findById('default').lean();
  if (!doc) {
    const ps = await PaymentSettings.findById('default').lean();
    const semilla = {
      montoMaximoSinAprobacion: ps?.creditoMontoMaximo ?? 200000,
      planes: planesDeFabrica(ps?.creditoCuotasMaximo ?? 6),
      updatedAt: new Date()
    };
    doc = await CreditoConfig.findOneAndUpdate(
      { _id: 'default' },
      { $setOnInsert: semilla },
      { upsert: true, new: true }
    ).lean();
  }
  return { montoMaximoSinAprobacion: doc.montoMaximoSinAprobacion, planes: (doc.planes || []).map(normalizarPlan) };
}
