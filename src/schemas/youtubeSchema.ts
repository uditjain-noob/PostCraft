import { z } from 'zod';

export const YouTubeChapterSchema = z.object({
  timestamp: z.string(),
  title: z.string(),
});

export const YouTubeIdeaSchema = z.object({
  platform: z.literal('youtube'),
  content_type: z.enum(['video_idea', 'short_idea', 'community_post']),
  title: z.string().max(60),
  description: z.string().max(5000),
  tags: z.array(z.string()),
  thumbnail_concept: z.string(),
  chapters: z.array(YouTubeChapterSchema).optional(),
  cta: z.string(),
  target_duration_min: z.number().positive(),
  hook_script_line: z.string(),
});

export type YouTubeIdea = z.infer<typeof YouTubeIdeaSchema>;
