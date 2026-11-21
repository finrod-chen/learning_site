import sharp from 'sharp'
const jobs = [
  ['public/logo.svg', 'public/icon-192.png', 192],
  ['public/logo.svg', 'public/icon-512.png', 512],
  ['public/logo.svg', 'public/apple-touch-icon.png', 180],
  ['public/logo-maskable.svg', 'public/icon-maskable-512.png', 512],
]
for (const [src, out, size] of jobs) {
  await sharp(src, { density: 384 }).resize(size, size).png().toFile(out)
  console.log('wrote', out)
}
