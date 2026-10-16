/**
 * ブラウザ内の保存先。画像を含むため localStorage ではなく IndexedDB を使う。
 * 旧エディタ（同じ github.io のオリジン）が localStorage に残したデータも読める。
 */
import { del, get, set } from 'idb-keyval';
import type { StageDocument } from '../domain/types';

const DOC_KEY = 'chaiser-stage-editor:document';
const EXPORTED_KEY = 'chaiser-stage-editor:exported-at';
/** 旧エディタ stage_editor_next.html の保存キー */
const LEGACY_LOCAL_STORAGE_KEY = 'chaiserStageBlockly';

export async function loadSavedDocument(): Promise<unknown | null> {
  return (await get(DOC_KEY)) ?? null;
}

export async function saveDocument(doc: StageDocument): Promise<void> {
  await set(DOC_KEY, doc);
}

export async function clearSavedDocument(): Promise<void> {
  await del(DOC_KEY);
  await del(EXPORTED_KEY);
}

export async function loadExportedAt(): Promise<string | null> {
  return (await get(EXPORTED_KEY)) ?? null;
}

export async function saveExportedAt(iso: string): Promise<void> {
  await set(EXPORTED_KEY, iso);
}

/** 旧エディタのデータ。無い・壊れているときは null */
export function readLegacyLocalData(): unknown | null {
  try {
    const raw = localStorage.getItem(LEGACY_LOCAL_STORAGE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw) as { phases?: unknown };
    return Array.isArray(data.phases) ? data : null;
  } catch {
    return null;
  }
}
