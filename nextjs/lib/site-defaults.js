// Valores de fábrica de la configuración del sitio: son exactamente los que estaban escritos en el código.
// Si no hay nada guardado (o la base falla), el sitio muestra esto.
export const SITE_DEFAULTS = {
  tienda: {
    nombre: 'Alumine Hogar',
    telefono: '+54 9 299 576-9999',
    whatsapp: '5492995769999',
    emailContacto: 'aluminehogar@gmail.com',
    emailNotificaciones: 'aluminehogar@gmail.com',
    emailInfo: 'info@aluminehogar.com.ar',
    direccion: '',
    ciudad: 'Neuquen',
  },
  redes: {
    instagram: '',
    facebook: '',
  },
  inicio: {
    titulo: 'Alumine con el calor del HOGAR!',
    subtitulo: 'Encuentra los mejores productos para tu descanso',
  },
  chatbot: {
    envio: 'Envio GRATIS en Neuquen Capital',
    formasDePago: 'Efectivo, transferencia, tarjetas (consultar cuotas)',
    politicas: [
      'Garantia de 5 anos en colchones premium',
      'Garantia de 3 anos en colchones estandar',
      'Garantia de 1 ano en almohadas',
      'Cambios y devoluciones dentro de los 30 dias',
    ].join('\n'),
  },
};
