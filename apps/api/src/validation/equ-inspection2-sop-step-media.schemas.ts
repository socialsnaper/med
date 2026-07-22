import { z } from 'zod';
export const AddEquInsp2MediaSchema = z.object({
  fileUrl: z.string().max(500).refine((u) => u.startsWith('http://') || u.startsWith('https://') || u.startsWith('/api/uploads/'), 'Invalid URL'),
  fileName: z.string().max(255).trim().optional(),
  fileType: z.string().max(100).trim().optional(),
  caption: z.string().max(1000).trim().optional(),
  displayOrder: z.number().int().min(1).optional(),
});
export type AddEquInsp2MediaInput = z.infer<typeof AddEquInsp2MediaSchema>;
