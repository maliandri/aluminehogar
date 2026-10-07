# Proyectos C + D — Clientes de vendedores y crédito propio (AlumiCrédito)

Fecha: 2026-10-07 · Estado: decisiones del dueño tomadas en la conversación; se trabaja directo sobre `master` (sin ramas), sin push hasta que el dueño lo pida
Continúa los proyectos A (marco del admin) y B (configuración, menú y permisos por rol), ya publicados. Retoma las decisiones guardadas del 2026-09-30 (cuotas diaria/semanal/mensual, el vendedor aprueba dentro de límites y el admin lo que los excede, ficha de cliente con documentación, sin garante).

## Objetivo

1. Separar la configuración que hoy está mezclada en la pestaña Créditos: **Mercado Pago** por un lado y **crédito propio** (planes y recargos) por otro.
2. Que el vendedor cargue **clientes** con sus datos y documentación, y que esos clientes aparezcan en Usuarios como "cliente creado por vendedor".
3. Que cada crédito propio quede asociado a un cliente, con **quién lo cargó y quién lo aprobó**, y que el **anticipo y cada cuota** se registren con comprobante o "cobrado en mano".
4. Un **registro de operaciones** que muestre todo eso.

## Decisiones del dueño

- **Recargo (tasa):** recargo fijo por plan de cuotas, en una tabla **por cada frecuencia** (diaria, semanal, mensual). Cada plan: cantidad de cuotas, recargo %, si requiere aprobación del admin, si está activo.
- **Cobros:** para el anticipo y para cada cuota, el vendedor sube el comprobante **o** marca "ya lo cobré, lo tengo en mano". Queda quién lo registró y cuándo.
- **Ubicación:** pestañas separadas en Gestión de Ventas: Créditos (registro), Planes de crédito propio, Mercado Pago, y Clientes.
- **Cliente:** nombre, documento, **teléfono obligatorio**, **email obligatorio** (si no tiene, el vendedor escribe a mano exactamente `cliente no posee mail en este momento o no usa`), domicilio, número, localidad, provincia (lista; por ahora solo Neuquen), y documentación (DNI frente y dorso, recibo de ingresos, servicio). Sin garante.
- Cada vendedor ve solo sus clientes y créditos; el admin ve todo.

## Diseño

### Datos
- `Cliente` (colección nueva): datos personales, `creadoPor { userId, nombre }`, `archivos[]` (tipo, publicId de Cloudinary, formato, subidoPor, fecha). Documento único (tipo + número).
- `CreditoConfig` (documento único `default`): `montoMaximoSinAprobacion` y `planes[] { frecuencia, cuotas, recargo, requiereAprobacion, activo }`. Se siembra la primera vez desde `PaymentSettings` (monto máximo actual; planes mensuales de 1 a N cuotas sin recargo, N = cuotas máximas actuales) para que el comportamiento de hoy no cambie. `PaymentSettings` queda solo para Mercado Pago.
- `CreditoVenta` (se extiende, lo viejo sigue funcionando): `clienteId`, `frecuencia`, `recargoPorcentaje`, `interes`, `totalCuotas`, `montoCuota`, `cargadoPor`, `aprobadoPor { tipo: 'automatica'|'admin', userId, nombre, fecha }`, `rechazadoPor`, `anticipoPago` y `cuotas[].pago` con `{ metodo: 'comprobante'|'efectivo', comprobante?, registradoPor, fecha }`.

### Cálculo (módulo puro, probado)
`interes = (total − anticipo) × recargo%`; se reparte `(total − anticipo) + interes` en cuotas iguales al centavo; la última cuota absorbe la diferencia de redondeo; vencimientos a un período del día de alta (diaria +1 día, semanal +7, mensual +1 mes con tope de fin de mes, sin el desborde de `setMonth`). Requiere aprobación si el monto total supera el máximo o si el plan lo exige.

### Archivos privados
Documentos de clientes y comprobantes se suben a Cloudinary con `type: 'authenticated'` (sin link público). El servidor los entrega solo si el token es del admin o del vendedor dueño (endpoint que consulta Cloudinary con URL firmada y devuelve los bytes). Imágenes JPG/PNG/WebP o PDF, máximo 3 MB cada uno (límite de cuerpo de las funciones de Vercel).

### Permisos
`lib/permisos.js` suma: `clientes` (ver y editar: admin y vendedor; el vendedor solo los suyos, validado en el servidor), `planes-credito` y `mercado-pago` (solo admin). `creditos`: el vendedor ve los suyos y registra cobros de los suyos; aprobar/rechazar solo admin. Se elimina la acción vieja `marcar-cuota` (permitía marcar pagada sin comprobante).

### Pantallas
- Gestión de Ventas: **Créditos** (registro de operaciones con detalle por cuota), **Clientes** (admin y vendedor), **Planes de crédito propio** y **Mercado Pago** (admin).
- Usuarios: bloque "Clientes cargados por vendedores", con la marca "cliente creado por vendedor" y quién lo cargó.
- Panel del vendedor (`VendedorModal`): al otorgar un crédito se elige un cliente existente (buscador) o se crea uno nuevo sin salir; se elige frecuencia y plan con la cuota calculada en vivo; en "Mis créditos" cada cuota se cobra con comprobante o "en mano".

## Seguridad y errores
- Todo se valida en el servidor (datos del cliente, frase exacta del email, planes, archivos); lo desconocido se descarta. Un vendedor no puede leer ni modificar clientes o créditos de otro (403/404).
- El vendedor puede otorgar crédito solo a un cliente propio y solo con un plan activo de la tabla.
- Limitación conocida (hallazgo previo de la auditoría): el monto total del crédito viene del presupuesto del vendedor; no se recalcula contra el catálogo.
- Sin tests automáticos en el proyecto: verificadores en Node de las funciones puras (cálculo, validaciones, permisos y menú) y lista de comprobación manual.

## Fuera de alcance
Garante, mora o intereses por atraso, avisos automáticos al cliente (WhatsApp/email), pagos online de cuotas, y recalcular el monto contra el catálogo.
