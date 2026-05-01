import { z } from 'zod';

export const LinkedInIdeaSchema = z.object({
  platform: z.literal('linkedin'),
  content_type: z.enum(['article', 'post', 'document_post']),
  headline: z.string(),
  body: z.string().max(3000),
  cta: z.string(),
  hashtags: z.array(z.string()).max(5),
  target_audience_note: z.string(),
});

export type LinkedInIdea = z.infer<typeof LinkedInIdeaSchema>;
