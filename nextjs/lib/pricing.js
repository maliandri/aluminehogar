// Helpers compartidos para aplicar medios de pago y promociones segun a que productos alcanzan.

export function productoAplica(regla, producto) {
  if (!regla || !regla.activo) return false;
  if (regla.aplicaA === 'todos') return true;
  if (!producto) return false;

  const valores = regla.aplicaAValores || [];
  if (regla.aplicaA === 'categoria') return valores.includes(producto.categoria);
  if (regla.aplicaA === 'marca') return valores.includes(producto.marca);
  if (regla.aplicaA === 'producto') return valores.includes(String(producto._id));
  return false;
}

// items: [{ producto: {_id, categoria, marca}, precio, cantidad }]
export function calcularTotalConMedioPago(items, medioPago) {
  return items.reduce((total, item) => {
    const aplica = medioPago && productoAplica(medioPago, item.producto);
    const recargo = aplica ? (medioPago.tasaInteres || 0) / 100 : 0;
    return total + item.precio * item.cantidad * (1 + recargo);
  }, 0);
}

export function precioConPromociones(producto, precioBase, promociones) {
  const promoAplicable = (promociones || []).find(p => productoAplica(p, producto) && p.tipo === 'descuento');
  if (!promoAplicable) return precioBase;
  return precioBase * (1 - (promoAplicable.descuentoPorcentaje || 0) / 100);
}

export function vigente(regla) {
  if (!regla) return false;
  const ahora = new Date();
  if (regla.vigenciaDesde && new Date(regla.vigenciaDesde) > ahora) return false;
  if (regla.vigenciaHasta && new Date(regla.vigenciaHasta) < ahora) return false;
  return true;
}
