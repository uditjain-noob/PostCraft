import { promises as fs } from 'fs';
import path from 'path';
import os from 'os';

export async function readJSON<T>(filePath: string): Promise<T> {
  const raw = await fs.readFile(filePath, 'utf-8');
  return JSON.parse(raw) as T;
}

export async function writeJSON(filePath: string, data: unknown): Promise<void> {
  const dir = path.dirname(filePath);
  await fs.mkdir(dir, { recursive: true });

  // Atomic write: write to temp file then rename
  const tmpPath = path.join(os.tmpdir(), `postcraft-${Date.now()}-${Math.random().toString(36).slice(2)}.tmp`);
  await fs.writeFile(tmpPath, JSON.stringify(data, null, 2), 'utf-8');
  await fs.rename(tmpPath, filePath);
}

export async function ensureFile(filePath: string, defaultData: unknown): Promise<void> {
  try {
    await fs.access(filePath);
  } catch {
    await writeJSON(filePath, defaultData);
  }
}
