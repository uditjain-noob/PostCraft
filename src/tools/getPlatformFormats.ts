import { z } from 'zod';
import path from 'path';
import { fileURLToPath } from 'url';
import { readJSON } from '../utils/fileStore.js';
import { PLATFORMS } from '../schemas/contentIdeaSchema.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FORMATS_PATH = path.resolve(__dirname, '../../data/platform-formats.json');

export const getPlatformFormatsInputSchema = {
  platform: z.enum(PLATFORMS),
};

export async function getPlatformFormats(input: { platform: string }): Promise<unknown> {
  const formats = await readJSON<Record<string, unknown>>(FORMATS_PATH);
  const spec = formats[input.platform];
  if (!spec) {
    throw new Error(`No format spec found for platform: ${input.platform}`);
  }
  return spec;
}
