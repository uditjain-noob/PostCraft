import { z } from 'zod';
import path from 'path';
import { fileURLToPath } from 'url';
import { readJSON } from '../utils/fileStore.js';
import { pushToPrefab as pushHelper } from '../utils/prefab.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export const pushToPrefabInputSchema = {
  panel_type: z.enum([
    'content_cards',
    'library_panel',
    'config_panel',
    'analytics_card',
    'posting_calendar',
    'posting_checklist',
    'cross_platform_comparison',
    'performance_digest',
  ]),
  idea_set_id: z.string().optional(),
  account_id: z.string().default('postglow'),
};

export async function pushToPrefabTool(input: {
  panel_type: string;
  idea_set_id?: string;
  account_id?: string;
}): Promise<unknown> {
  const accountId = input.account_id ?? 'postglow';

  if (input.idea_set_id) {
    const libPath = path.resolve(__dirname, `../../data/accounts/${accountId}/content-library.json`);
    const library = await readJSON<{ idea_sets: unknown[] }>(libPath);
    const set = (library.idea_sets as Array<{ id: string }>).find(s => s.id === input.idea_set_id);
    if (!set) throw new Error(`Idea set not found: ${input.idea_set_id}`);
    await pushHelper(input.panel_type, { idea_set: set });
    return { success: true, panel_type: input.panel_type, idea_set_id: input.idea_set_id };
  }

  if (input.panel_type === 'config_panel') {
    const configPath = path.resolve(__dirname, `../../data/accounts/${accountId}/brand-config.json`);
    const config = await readJSON<unknown>(configPath);
    await pushHelper('config_panel', { config });
    return { success: true, panel_type: 'config_panel' };
  }

  return { success: false, message: 'Provide idea_set_id or use config_panel panel_type' };
}
