export async function compressImage(file, options = {}) {
  if (!file) return null;

  const {
    maxWidth = 1280,
    maxHeight = 1280,
    quality = 0.72,
    type = 'image/jpeg',
  } = options;

  const bitmap = await createImageBitmap(file);
  const scale = Math.min(maxWidth / bitmap.width, maxHeight / bitmap.height, 1);
  const width = Math.round(bitmap.width * scale);
  const height = Math.round(bitmap.height * scale);
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(bitmap, 0, 0, width, height);

  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) {
        reject(new Error('Gagal mengompres foto.'));
        return;
      }
      resolve(new File([blob], file.name.replace(/\.[^.]+$/, '.jpg'), { type }));
    }, type, quality);
  });
}
