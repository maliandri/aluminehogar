// Abre en una pestaña nueva un archivo privado que se pide con el token (no se puede enlazar directo).
// La pestaña se abre antes de esperar la respuesta para que el navegador no la bloquee.
export async function abrirBlobEnPestana(promesaDeBlob) {
  const ventana = window.open('', '_blank');
  try {
    const blob = await promesaDeBlob;
    const url = URL.createObjectURL(blob);
    if (ventana) ventana.location.href = url;
    else window.location.href = url;
    setTimeout(() => URL.revokeObjectURL(url), 60000);
  } catch (error) {
    if (ventana) ventana.close();
    throw error;
  }
}
