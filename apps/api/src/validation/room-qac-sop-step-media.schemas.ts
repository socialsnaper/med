import { z } from 'zod';

export const AddQacMediaSchema = z.object({
  fileUrl:      z.string()
    .max(500)
    .refine(
      (url) =>
        url.startsWith('http://') ||
        url.startsWith('https://') ||
        url.startsWith('/api/uploads/'),
      'fileUrl must be an http/https URL or an internal /api/uploads/ path',
    ),
  fileName:     z.string().max(255).trim().optional(),
  fileType:     z.string().max(100).trim().optional(),
  caption:      z.string().max(1000).trim().optional(),
  displayOrder: z.number().int().min(1).optional(),
});

export type AddQacMediaInput = z.infer<typeof AddQacMediaSchema>;
