import { z } from 'zod';

const TweetSchema = z.object({
  position: z.number().int().positive(),
  text: z.string().max(280),
});

export const XIdeaSchema = z.object({
  platform: z.literal('x'),
  content_type: z.enum(['single_tweet', 'thread']),
  hook_tweet: z.string().max(280),
  hashtags: z.array(z.string()).max(2),
  cta_tweet: z.string().max(280),
  tweet_text: z.string().max(280).optional(),
  thread: z.array(TweetSchema).max(25).optional(),
});

export type XIdea = z.infer<typeof XIdeaSchema>;
