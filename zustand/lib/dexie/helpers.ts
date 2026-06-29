import { db } from './db';

export async function putOriginal(file, width, height) {
  const key = crypto.randomUUID();
  const bytes = await file.arrayBuffer();

  await db.originals.put({
    key,
    name: file.name,
    mimeType: file.type,
    bytes,
    width,
    height,
    createdAt: Date.now(),
  });

  return key;
}

export async function getOriginal(key) {
  return db.originals.where('key').equals(key).first();
}

export async function deleteOriginal(key) {
  await db.originals.where('key').equals(key).delete();
}

export async function saveWorkingCopy(photoId, pixels, width, height) {
  await db.workingCopies.put({
    photoId,
    pixels,
    width,
    height,
    updatedAt: Date.now(),
  });
}
