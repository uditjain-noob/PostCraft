import { z } from 'zod';

export const InstagramSlideSchema = z.object({
  slide_number: z.number().int().positive(),
  headline: z.string(),
  body: z.string(),
});

export const InstagramIdeaSchema = z.object({
  platform: z.literal('instagram'),
  content_type: z.enum(['feed_post', 'carousel', 'reel_idea', 'story_idea']),
  hook: z.string(),
  caption_body: z.string().max(2200),
  hashtags: z.array(z.string()).max(30),
  cta: z.string(),
  slide_count: z.number().int().positive().optional(),
  slides: z.array(InstagramSlideSchema).optional(),
  audio_suggestion: z.string().optional(),
});

export type InstagramIdea = z.infer<typeof InstagramIdeaSchema>;
