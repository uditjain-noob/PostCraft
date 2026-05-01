import { z } from 'zod';
import { YouTubeIdeaSchema } from './youtubeSchema.js';
import { InstagramIdeaSchema } from './instagramSchema.js';
import { XIdeaSchema } from './xSchema.js';
import { LinkedInIdeaSchema } from './linkedinSchema.js';
import { RedditIdeaSchema } from './redditSchema.js';
import { FacebookIdeaSchema } from './facebookSchema.js';

export const ContentIdeaSchema = z.discriminatedUnion('platform', [
  YouTubeIdeaSchema,
  InstagramIdeaSchema,
  XIdeaSchema,
  LinkedInIdeaSchema,
  RedditIdeaSchema,
  FacebookIdeaSchema,
]);

export type ContentIdea = z.infer<typeof ContentIdeaSchema>;

export const PLATFORMS = ['youtube', 'instagram', 'x', 'linkedin', 'reddit', 'facebook'] as const;
export type Platform = typeof PLATFORMS[number];
