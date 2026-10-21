// docs/persistence/10-DECISIONES.md #148: archivos minimos para las subidas del e2e (la web
// valida tipo y tamano; el API compara el content-type con el objeto subido).
export const PDF_FILE = {
  name: 'documento.pdf',
  mimeType: 'application/pdf',
  buffer: Buffer.from('%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n'),
};

// PNG de 1x1 transparente.
export const PNG_FILE = {
  name: 'documento.png',
  mimeType: 'image/png',
  buffer: Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
    'base64',
  ),
};
