// Arma el link para llamar: deja solo + y dígitos
export function telHref(telefono) {
  return `tel:${String(telefono).replace(/[^\d+]/g, '')}`;
}

// Link de WhatsApp: el número va solo con dígitos y código de país
export function waUrl(whatsapp, mensaje) {
  const base = `https://wa.me/${whatsapp}`;
  return mensaje ? `${base}?text=${encodeURIComponent(mensaje)}` : base;
}
