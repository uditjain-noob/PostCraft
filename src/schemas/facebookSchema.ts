import { z } from 'zod';

const LinkPreviewSchema = z.object({
  url: z.string().url(),
  title: z.string().optional(),
  description: z.string().optional(),
});

export const FacebookIdeaSchema = z.object({
  platform: z.literal('facebook'),
  content_type: z.enum(['post', 'carousel', 'event_post']),
  caption: z.string().max(400),
  hashtags: z.array(z.string()),
  cta: z.string(),
  best_time_note: z.string(),
  link_preview: LinkPreviewSchema.optional(),
});

export type FacebookIdea = z.infer<typeof FacebookIdeaSchema>;
