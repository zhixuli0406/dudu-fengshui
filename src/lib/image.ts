/** Downscale an image file to a JPEG data URL (max edge px). */
export async function fileToDataUrl(file: File, maxEdge = 1600, quality = 0.82): Promise<{ dataUrl: string; w: number; h: number }> {
  const bitmap = await createImageBitmap(file)
  const scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height))
  const w = Math.round(bitmap.width * scale), h = Math.round(bitmap.height * scale)
  const canvas = document.createElement('canvas')
  canvas.width = w; canvas.height = h
  const ctx = canvas.getContext('2d')!
  ctx.fillStyle = '#fff'
  ctx.fillRect(0, 0, w, h)
  ctx.drawImage(bitmap, 0, 0, w, h)
  bitmap.close?.()
  return { dataUrl: canvas.toDataURL('image/jpeg', quality), w, h }
}
