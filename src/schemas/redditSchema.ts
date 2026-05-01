import { z } from 'zod';

export const RedditIdeaSchema = z.object({
  platform: z.literal('reddit'),
  post_type: z.enum(['text_post', 'link_post', 'comment_idea']),
  subreddit_suggestion: z.string(),
  title: z.string().max(300),
  body: z.string().max(40000),
  flair_suggestion: z.string().optional(),
  tldr: z.string(),
  engagement_hook: z.string(),
});

export type RedditIdea = z.infer<typeof RedditIdeaSchema>;
