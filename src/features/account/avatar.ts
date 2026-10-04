import { AVATAR_MAX_BYTES, AVATAR_TYPES } from '@/api/contracts'

export function validateAvatar(file: File): string | null {
  if (!AVATAR_TYPES.includes(file.type as (typeof AVATAR_TYPES)[number])) return 'Use uma imagem PNG, JPG ou WebP.'
  if (file.size > AVATAR_MAX_BYTES) return 'A imagem deve ter no máximo 2 MB.'
  return null
}

/** Reduz o avatar para 256×256 (WebP) antes do envio — menos dados trafegados e armazenados. */
export async function resizeAvatar(file: File, size = 256): Promise<Blob> {
  try {
    const bitmap = await createImageBitmap(file)
    const canvas = document.createElement('canvas')
    canvas.width = size
    canvas.height = size
    const ctx = canvas.getContext('2d')
    if (!ctx) return file
    const scale = Math.max(size / bitmap.width, size / bitmap.height)
    const w = bitmap.width * scale
    const h = bitmap.height * scale
    ctx.drawImage(bitmap, (size - w) / 2, (size - h) / 2, w, h)
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/webp', 0.85))
    return blob ?? file
  } catch {
    return file
  }
}
