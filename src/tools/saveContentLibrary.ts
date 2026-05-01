import { z } from 'zod';
import path from 'path';
import { fileURLToPath } from 'url';
import { readJSON, writeJSON, ensureFile } from '../utils/fileStore.js';
import { pushToPrefab } from '../utils/prefab.js';
import { ContentIdea, PLATFORMS } from '../schemas/contentIdeaSchema.js';
import { v4 as uuidv4 } from 'uuid';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function libraryPath(accountId: string): string {
  return path.resolve(__dirname, `../../data/accounts/${accountId}/content-library.json`);
}

interface IdeaSet {
  id: string;
  created_at: string;
  account_id: string;
  platform: string;
  topic: string;
  count: number;
  tone_used: string;
  content_type?: string;
  reference_url?: string | null;
  avoid_topics: string[];
  ideas: ContentIdea[];
  usage: Record<string, { status: string; suggested_at?: string; posted_manually_at?: string; live_post_url?: string }>;
  analytics: Record<string, unknown>;
}

interface Library {
  idea_sets: IdeaSet[];
}

const DEFAULT_LIBRARY: Library = { idea_sets: [] };

export const saveContentLibraryInputSchema = {
  operation: z.enum(['create', 'read', 'update', 'delete', 'list']),
  account_id: z.string().default('postglow'),
  platform: z.enum(PLATFORMS).optional(),
  topic: z.string().optional(),
  tone_used: z.string().optional(),
  content_type: z.string().optional(),
  reference_url: z.string().url().optional(),
  avoid_topics: z.array(z.string()).optional(),
  ideas: z.array(z.unknown()).optional(),
  idea_set_id: z.string().optional(),
  updates: z.record(z.unknown()).optional(),
};

export async function saveContentLibrary(input: {
  operation: 'create' | 'read' | 'update' | 'delete' | 'list';
  account_id?: string;
  platform?: string;
  topic?: string;
  tone_used?: string;
  content_type?: string;
  reference_url?: string;
  avoid_topics?: string[];
  ideas?: unknown[];
  idea_set_id?: string;
  updates?: Record<string, unknown>;
}): Promise<unknown> {
  const accountId = input.account_id ?? 'postglow';
  const libPath = libraryPath(accountId);
  await ensureFile(libPath, DEFAULT_LIBRARY);

  const library = await readJSON<Library>(libPath);

  switch (input.operation) {
    case 'create': {
      const ideaSet: IdeaSet = {
        id: `set_${uuidv4().replace(/-/g, '').slice(0, 8)}`,
        created_at: new Date().toISOString(),
        account_id: accountId,
        platform: input.platform ?? '',
        topic: input.topic ?? '',
        count: (input.ideas ?? []).length,
        tone_used: input.tone_used ?? '',
        content_type: input.content_type,
        reference_url: input.reference_url ?? null,
        avoid_topics: input.avoid_topics ?? [],
        ideas: (input.ideas ?? []) as ContentIdea[],
        usage: {},
        analytics: {},
      };

      // Initialise usage entries
      ideaSet.ideas.forEach((_, i) => {
        const ideaId = `idea_${String(i + 1).padStart(3, '0')}`;
        ideaSet.usage[ideaId] = { status: 'unused' };
      });

      library.idea_sets.push(ideaSet);
      await writeJSON(libPath, library);

      await pushToPrefab('library_panel', { idea_sets: library.idea_sets });

      return { success: true, idea_set_id: ideaSet.id, count: ideaSet.count };
    }

    case 'read': {
      if (input.idea_set_id) {
        const found = library.idea_sets.find(s => s.id === input.idea_set_id);
        if (!found) throw new Error(`Idea set not found: ${input.idea_set_id}`);
        return found;
      }
      // Filter by platform
      const sets = input.platform
        ? library.idea_sets.filter(s => s.platform === input.platform)
        : library.idea_sets;
      return sets;
    }

    case 'update': {
      if (!input.idea_set_id) throw new Error('idea_set_id required for update');
      const idx = library.idea_sets.findIndex(s => s.id === input.idea_set_id);
      if (idx === -1) throw new Error(`Idea set not found: ${input.idea_set_id}`);
      library.idea_sets[idx] = { ...library.idea_sets[idx], ...(input.updates ?? {}) } as IdeaSet;
      await writeJSON(libPath, library);
      return { success: true };
    }

    case 'delete': {
      if (!input.idea_set_id) throw new Error('idea_set_id required for delete');
      const before = library.idea_sets.length;
      library.idea_sets = library.idea_sets.filter(s => s.id !== input.idea_set_id);
      await writeJSON(libPath, library);
      return { success: true, removed: before - library.idea_sets.length };
    }

    case 'list': {
      const sets = input.platform
        ? library.idea_sets.filter(s => s.platform === input.platform)
        : library.idea_sets;

      await pushToPrefab('library_panel', { idea_sets: sets });
      return sets;
    }
  }
}
