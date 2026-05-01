import { z } from 'zod';
import path from 'path';
import { fileURLToPath } from 'url';
import { readJSON, writeJSON, ensureFile } from '../utils/fileStore.js';
import { pushToPrefab } from '../utils/prefab.js';
import { PLATFORMS } from '../schemas/contentIdeaSchema.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function configPath(accountId: string): string {
  return path.resolve(__dirname, `../../data/accounts/${accountId}/brand-config.json`);
}

const DEFAULT_CONFIG = {
  account_id: 'default',
  brand_name: 'My Brand',
  tone: 'professional',
  language: 'en',
  products: [],
  target_audience: '',
  active_platforms: ['instagram', 'x'],
  content_pillars: [],
  content_mix: { educational: 0.6, promotional: 0.3, personal: 0.1 },
  topic_bank: [],
  avoid_topics: [],
  posting_times: {},
  content_rules: [],
  platform_overrides: {},
};

const BrandConfigSchema = z.object({
  account_id: z.string(),
  brand_name: z.string(),
  tone: z.string(),
  language: z.string(),
  products: z.array(z.string()),
  target_audience: z.string(),
  active_platforms: z.array(z.enum(PLATFORMS)),
  content_pillars: z.array(z.string()),
  content_mix: z.object({
    educational: z.number(),
    promotional: z.number(),
    personal: z.number(),
  }),
  topic_bank: z.array(z.string()),
  avoid_topics: z.array(z.string()),
  posting_times: z.record(z.array(z.string())),
  content_rules: z.array(z.string()),
  platform_overrides: z.record(z.object({ tone: z.string().optional() })),
});

export const updateBrandConfigInputSchema = {
  account_id: z.string().default('postglow'),
  field: z.string().optional(),
  value: z.unknown().optional(),
  full_config: z.record(z.unknown()).optional(),
};

export async function updateBrandConfig(input: {
  account_id?: string;
  field?: string;
  value?: unknown;
  full_config?: Record<string, unknown>;
}): Promise<unknown> {
  const accountId = input.account_id ?? 'postglow';
  const cfgPath = configPath(accountId);

  await ensureFile(cfgPath, { ...DEFAULT_CONFIG, account_id: accountId });

  const current = await readJSON<Record<string, unknown>>(cfgPath);

  let updated: Record<string, unknown>;

  if (input.full_config) {
    updated = { ...current, ...input.full_config };
  } else if (input.field !== undefined) {
    updated = { ...current, [input.field]: input.value };
  } else {
    throw new Error('Provide either field+value or full_config');
  }

  // Validate before writing
  BrandConfigSchema.parse(updated);
  await writeJSON(cfgPath, updated);
  await pushToPrefab('config_panel', { config: updated });

  return { success: true, config: updated };
}
