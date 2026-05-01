import 'dotenv/config';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import path from 'path';
import { fileURLToPath } from 'url';

import { ensureFile } from './utils/fileStore.js';
import { generateContentIdeas, generateContentIdeasInputSchema } from './tools/generateContentIdeas.js';
import { getPlatformFormats, getPlatformFormatsInputSchema } from './tools/getPlatformFormats.js';
import { saveContentLibrary, saveContentLibraryInputSchema } from './tools/saveContentLibrary.js';
import { updateBrandConfig, updateBrandConfigInputSchema } from './tools/updateBrandConfig.js';
import { pushToPrefabTool, pushToPrefabInputSchema } from './tools/pushToPrefab.js';
import { PLATFORMS } from './schemas/contentIdeaSchema.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const DEFAULT_BRAND_CONFIG = {
  account_id: 'postglow',
  brand_name: 'PostGlow',
  tone: 'warm, educational, empowering',
  language: 'en',
  products: ['vitamin C serum', 'hyaluronic moisturiser'],
  target_audience: 'Women 25-40, skin-conscious, ingredient-aware',
  active_platforms: ['youtube', 'instagram', 'x', 'reddit', 'linkedin', 'facebook'],
  content_pillars: ['ingredient_spotlight', 'skin_tips', 'product_education', 'community_qa'],
  content_mix: { educational: 0.7, promotional: 0.2, personal: 0.1 },
  topic_bank: ['morning routines', 'ingredient science', 'skincare myths', 'seasonal care'],
  avoid_topics: ['competitor brand names', 'medical claims', 'before/after language'],
  posting_times: {
    instagram: ['09:00', '19:00'],
    linkedin: ['08:00', '17:00'],
    x: ['08:00', '20:00'],
    youtube: ['15:00'],
    reddit: ['10:00'],
    facebook: ['10:00', '20:00'],
  },
  content_rules: [
    'Always end Instagram posts with a question',
    'Reddit posts must not use brand voice — community member tone only',
    'YouTube titles must be curiosity-gap or specific result format',
    'Never mention competitor brand names',
  ],
  platform_overrides: {
    reddit: { tone: 'casual, community-native, zero promotional language' },
    youtube: { tone: 'educational, structured, searchable' },
    linkedin: { tone: 'professional, insight-led, credibility-first' },
  },
};

async function bootstrap(): Promise<void> {
  const configPath = path.resolve(__dirname, '../data/accounts/postglow/brand-config.json');
  await ensureFile(configPath, DEFAULT_BRAND_CONFIG);
}

function wrapHandler<T>(fn: (input: T) => Promise<unknown>) {
  return async (input: T) => {
    try {
      const result = await fn(input);
      return {
        content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }],
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return {
        content: [{ type: 'text' as const, text: `Error: ${message}` }],
        isError: true,
      };
    }
  };
}

async function main(): Promise<void> {
  await bootstrap();

  const server = new McpServer({
    name: 'postcraft',
    version: '1.0.0',
  });

  // Phase 1 Tools
  server.tool(
    'get_platform_formats',
    'Returns content types, character limits, required fields, and formatting rules for a platform. Call before generate_content_ideas to validate the spec.',
    getPlatformFormatsInputSchema,
    wrapHandler(getPlatformFormats),
  );

  server.tool(
    'generate_content_ideas',
    'Core generation tool. Takes brand brief, platform, topic, and count. Returns N platform-native structured content ideas. Saves to library and pushes to Prefab.',
    generateContentIdeasInputSchema,
    wrapHandler(generateContentIdeas),
  );

  server.tool(
    'save_content_library',
    'CRUD on content-library.json. Saves, retrieves, updates, and deletes idea sets. Supports filtering by platform. Use operation=list to see all ideas.',
    saveContentLibraryInputSchema,
    wrapHandler(saveContentLibrary),
  );

  server.tool(
    'update_brand_config',
    'Reads and writes brand-config.json. Updates tone, platforms, content pillars, topic lists, and content rules. Validates before writing. Pushes updated config to Prefab.',
    updateBrandConfigInputSchema,
    wrapHandler(updateBrandConfig),
  );

  server.tool(
    'push_to_prefab',
    'Re-pushes any saved idea set, config, or analytics to Prefab. Use to refresh the dashboard without re-generating.',
    pushToPrefabInputSchema,
    wrapHandler(pushToPrefabTool),
  );

  // Phase 2 Stubs — registered so the agent can discover them
  const phase2Stub = wrapHandler(async () => ({ message: 'Phase 2 — not yet implemented' }));
  const phase2Platforms = z.enum(PLATFORMS);

  server.tool(
    'build_posting_schedule',
    'Maps approved ideas to suggested date/time slots per platform. Produces a full posting plan (calendar + checklist). Does not publish.',
    {
      ideas: z.array(z.unknown()),
      platforms: z.array(phase2Platforms),
      start_date: z.string(),
      horizon_days: z.number().int().positive(),
      account_id: z.string().default('postglow'),
    },
    phase2Stub,
  );

  server.tool(
    'suggest_cross_platform_distribution',
    'Given a topic or idea set, proposes how to spread content across platforms — which formats, sequencing, and repurposing angles.',
    {
      topic: z.string().optional(),
      idea_set_id: z.string().optional(),
      platforms: z.array(phase2Platforms),
      account_id: z.string().default('postglow'),
    },
    phase2Stub,
  );

  server.tool(
    'fetch_post_analytics',
    'Fetches engagement metrics for a single post by URL (after the user has published it manually). Pushes results to Prefab analytics card.',
    {
      post_url: z.string().url(),
      platform: phase2Platforms,
      account_id: z.string().default('postglow'),
    },
    phase2Stub,
  );

  server.tool(
    'fetch_account_analytics',
    'Fetches account-level stats: recent posts, average engagement rate, follower trend, top N posts.',
    {
      account_handle: z.string(),
      platform: phase2Platforms,
      days: z.number().int().positive().default(30),
      account_id: z.string().default('postglow'),
    },
    phase2Stub,
  );

  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch(err => {
  console.error('[PostCraft] Fatal error:', err);
  process.exit(1);
});
