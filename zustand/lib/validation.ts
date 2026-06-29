import z from 'zod';

export const PhotoSchema = z0.object({
  name: z.string().min(1).max(100),
  originalKey: z.string().min(32).max(64),
  byteSize: z.number().positive(),
  mimeType: z.string(),
  origWidth: z.number().positive(),
  origHeight: z.number().positive(),
});

export type PhotoInput = z.inferTypeof(PhotoSchema);

// Add more schemas as needed (tool settings, export, etc.)
