// Extrai as artes dos NFTs a partir dos frames exportados do Figma (pasta figma/)
// e gera versões WebP otimizadas em public/nfts. Execução: `npm run assets`.
// As coordenadas foram medidas nos PNGs de 1440px e já descontam o raio dos cards.
import sharp from 'sharp'
import { mkdir } from 'node:fs/promises'

const OUT = 'public/nfts'

const sources = [
  { name: 'emerald', file: 'figma/Desktop/Início.png', left: 874, top: 105, width: 442, height: 442 },
  { name: 'sage', file: 'figma/Desktop/Início.png', left: 124, top: 1562, width: 302, height: 356 },
  { name: 'ivory', file: 'figma/Desktop/Login.png', left: 1075, top: 1078, width: 242, height: 242 },
  { name: 'golden', file: 'figma/Desktop/Login.png', left: 1075, top: 1494, width: 242, height: 242 },
]

await mkdir(OUT, { recursive: true })

for (const { name, file, ...region } of sources) {
  const base = sharp(file).extract(region)
  // Arte principal (cards, galeria e detalhe)
  await base.clone().webp({ quality: 84 }).toFile(`${OUT}/${name}.webp`)
  // Miniatura quadrada para carrinho, checkout e recibo
  await base
    .clone()
    .resize(160, 160, { fit: 'cover', position: 'top' })
    .webp({ quality: 80 })
    .toFile(`${OUT}/${name}-thumb.webp`)
  console.log(`✓ ${name}`)
}

// Ícone "Thank you" do recibo
await sharp('figma/Desktop/Confirmação de Pedido.png')
  .extract({ left: 682, top: 184, width: 76, height: 88 })
  .png()
  .toFile('public/thank-you.png')
console.log('✓ thank-you')
