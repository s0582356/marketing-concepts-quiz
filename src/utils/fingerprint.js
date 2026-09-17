export async function fingerprintFile(file) {
  const bytes = await file.arrayBuffer()
  // Uint8Array.from() kopiert in einen frischen, garantiert nativen ArrayBuffer.
  // Manche File/Blob-Polyfills (z. B. jsdom in Tests) liefern sonst ein
  // ArrayBuffer-Objekt, das crypto.subtle.digest nicht als solches akzeptiert.
  const digest = await crypto.subtle.digest('SHA-256', Uint8Array.from(new Uint8Array(bytes)))
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('')
}

// Nur zur Bildung eines technischen Kombi-Fingerprints aus bereits vorhandenen
// Datei-Fingerprints (z. B. für einen zusammengeführten Multi-Bank-Pool) - nie
// mit Frage-/Antworttext oder anderen privaten Inhalten aufgerufen.
export async function hashText(text) {
  const bytes = new TextEncoder().encode(text)
  const digest = await crypto.subtle.digest('SHA-256', bytes)
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('')
}
