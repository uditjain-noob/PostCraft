import { z } from 'zod';
import Anthropic from '@anthropic-ai/sdk';
import path from 'path';
import { fileURLToPath } from 'url';
import { readJSON } from '../utils/fileStore.js';
import { pushToPrefab } from '../utils/prefab.js';
import { fetchUrlText } from '../utils/urlParser.js';
import { saveContentLibrary } from './saveContentLibrary.js';
import { getPlatformFormats } from './getPlatformFormats.js';
import { ContentIdeaSchema, ContentIdea, PLATFORMS } from '../schemas/contentIdeaSchema.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export const generateContentIdeasInputSchema = {
  platform: z.enum(PLATFORMS),
  topic: z.string().min(1),
  count: z.number().int().positive().max(50),
  content_type: z.string().optional(),
  tone_override: z.string().optional(),
  avoid_topics: z.array(z.string()).optional(),
  reference_url: z.string().url().optional(),
  account_id: z.string().default('postglow'),
};

interface BrandConfig {
  brand_name: string;
  tone: string;
  language: string;
  target_audience: string;
  content_rules: string[];
  avoid_topics: string[];
  platform_overrides?: Record<string, { tone?: string }>;
}

function containsAvoidTerms(idea: unknown, avoidTopics: string[]): boolean {
  if (!avoidTopics.length) return false;
  const text = JSON.stringify(idea).toLowerCase();
  return avoidTopics.some(t => text.includes(t.toLowerCase()));
}

async function generateBatch(
  platform: string,
  topic: string,
  count: number,
  systemPrompt: string,
  contentType?: string,
): Promise<unknown[]> {
  const userMsg = `Generate exactly ${count} social media content ideas for the platform "${platform}" about the topic: "${topic}".${contentType ? ` Content type: ${contentType}.` : ''}

Return ONLY a valid JSON array of ${count} objects. No markdown, no explanations — just the raw JSON array.`;

  const response = await client.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 8096,
    system: systemPrompt,
    messages: [{ role: 'user', content: userMsg }],
  });

  const text = response.content[0].type === 'text' ? response.content[0].text : '';

  // Extract JSON array from response
  const jsonMatch = text.match(/\[[\s\S]*\]/);
  if (!jsonMatch) {
    throw new Error(`Claude did not return a JSON array. Response: ${text.slice(0, 200)}`);
  }

  const parsed = JSON.parse(jsonMatch[0]) as unknown[];

  if (!Array.isArray(parsed) || parsed.length !== count) {
    throw new Error(`Expected ${count} ideas, got ${Array.isArray(parsed) ? parsed.length : 'non-array'}`);
  }

  return parsed;
}

export async function generateContentIdeas(input: {
  platform: string;
  topic: string;
  count: number;
  content_type?: string;
  tone_override?: string;
  avoid_topics?: string[];
  reference_url?: string;
  account_id?: string;
}): Promise<unknown> {
  const accountId = input.account_id ?? 'postglow';
  const allAvoidTopics = input.avoid_topics ?? [];

  // Load brand config and platform format spec
  const configPath = path.resolve(__dirname, `../../data/accounts/${accountId}/brand-config.json`);
  const brandConfig = await readJSON<BrandConfig>(configPath);
  const platformSpec = await getPlatformFormats({ platform: input.platform });

  // Merge avoid_topics from brand config
  const combinedAvoid = [...new Set([...allAvoidTopics, ...(brandConfig.avoid_topics ?? [])])];

  // Determine tone
  const platformTone = brandConfig.platform_overrides?.[input.platform]?.tone;
  const tone = input.tone_override ?? platformTone ?? brandConfig.tone;

  // Fetch reference URL content if provided
  let referenceContext = '';
  if (input.reference_url) {
    const text = await fetchUrlText(input.reference_url);
    referenceContext = `\n\nReference material (use as source for ideas):\n${text}`;
  }

  const systemPrompt = `You are a social media content strategist for ${brandConfig.brand_name}.

Brand details:
- Tone: ${tone}
- Language: ${brandConfig.language}
- Target audience: ${brandConfig.target_audience}
- Content rules: ${brandConfig.content_rules.join('; ')}
${combinedAvoid.length ? `- Avoid these topics/terms: ${combinedAvoid.join(', ')}` : ''}

Platform spec for ${input.platform}:
${JSON.stringify(platformSpec, null, 2)}

Rules:
1. Generate exactly the requested number of ideas — no more, no fewer.
2. Every idea MUST include all required fields for this platform as specified above.
3. Respect all character limits strictly.
4. Platform field: always set to "${input.platform}".
5. Never include any of the avoid topics.${referenceContext}`;

  // First generation pass
  let ideas = await generateBatch(input.platform, input.topic, input.count, systemPrompt, input.content_type);

  // Validate and re-generate any ideas that contain avoid terms or fail schema validation
  const validatedIdeas: ContentIdea[] = [];
  const failedIndices: number[] = [];

  for (let i = 0; i < ideas.length; i++) {
    const raw = { ...(ideas[i] as object), platform: input.platform };
    const parsed = ContentIdeaSchema.safeParse(raw);

    if (!parsed.success || containsAvoidTerms(raw, combinedAvoid)) {
      failedIndices.push(i);
    } else {
      validatedIdeas.push(parsed.data);
    }
  }

  // Single retry pass for failed ideas
  if (failedIndices.length > 0) {
    const retried = await generateBatch(
      input.platform,
      input.topic,
      failedIndices.length,
      systemPrompt + '\n\nIMPORTANT: Previous attempts failed validation. Be extra careful with field requirements and character limits.',
      input.content_type,
    );

    for (const raw of retried) {
      const withPlatform = { ...(raw as object), platform: input.platform };
      const parsed = ContentIdeaSchema.safeParse(withPlatform);
      if (parsed.success && !containsAvoidTerms(withPlatform, combinedAvoid)) {
        validatedIdeas.push(parsed.data);
      }
    }
  }

  // Save to content library
  await saveContentLibrary({
    operation: 'create',
    account_id: accountId,
    platform: input.platform,
    topic: input.topic,
    tone_used: tone,
    content_type: input.content_type,
    reference_url: input.reference_url,
    avoid_topics: combinedAvoid,
    ideas: validatedIdeas,
  });

  // Push to Prefab
  await pushToPrefab('content_cards', {
    platform: input.platform,
    topic: input.topic,
    count: validatedIdeas.length,
    ideas: validatedIdeas,
  });

  return {
    success: true,
    platform: input.platform,
    topic: input.topic,
    count: validatedIdeas.length,
    ideas: validatedIdeas,
  };
}
