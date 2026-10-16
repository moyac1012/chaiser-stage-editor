/**
 * ブロックセット（ステージで使えるブロックの一覧）の追加・名前変更・削除・並べ替え。
 * 旧エディタ stage_editor_next_blocksets_extra.js と同じ規則で、新しい StageDocument を返す。
 * 並び順は blockSetOrder、消したセットの名前は deletedBlockSets に残す（旧エディタが既定のセットを復活させないため）。
 */
import type { StageDocument } from './types';

/** 半角英数字・_・- のみ。空白は _ にする */
export function normalizeBlockSetName(value: string): string {
  return value.trim().replace(/\s+/g, '_');
}

/** 使えない名前なら理由を返す（before は名前変更前の名前） */
export function blockSetNameError(doc: StageDocument, name: string, before: string | null = null): string | null {
  if (!name) return '名前を入力してください';
  if (!/^[A-Za-z0-9_-]+$/.test(name)) return '名前に使えるのは半角英数字・_・- だけです';
  if (name !== before && doc.blockSetOrder.includes(name)) return '同じ名前のブロックセットがあります';
  return null;
}

/** blockSetOrder の順に blockSets を作り直す（JSON のキー順も並びに合わせる） */
function withSets(doc: StageDocument, order: string[], sets: Record<string, string[]>, deleted = doc.deletedBlockSets): StageDocument {
  const blockSets: Record<string, string[]> = {};
  for (const name of order) blockSets[name] = sets[name] ?? [];
  return { ...doc, blockSets, blockSetOrder: order, deletedBlockSets: deleted };
}

function renameOnStages(doc: StageDocument, before: string, after: string): StageDocument {
  return {
    ...doc,
    phases: doc.phases.map((p) => ({
      ...p,
      stages: p.stages.map((s) => (s.blockSet === before ? { ...s, blockSet: after } : s)),
    })),
  };
}

export function countBlockSetUsage(doc: StageDocument, name: string): number {
  return doc.phases.reduce((n, p) => n + p.stages.filter((s) => s.blockSet === name).length, 0);
}

/** 末尾に追加する。copyFrom を渡すとその中身を写す */
export function addBlockSet(doc: StageDocument, name: string, copyFrom: string | null): StageDocument {
  if (blockSetNameError(doc, name)) return doc;
  const types = copyFrom ? [...(doc.blockSets[copyFrom] ?? [])] : [];
  return withSets(doc, [...doc.blockSetOrder, name], { ...doc.blockSets, [name]: types }, doc.deletedBlockSets.filter((n) => n !== name));
}

/** 名前を変え、そのセットを使っているステージも新しい名前にする */
export function renameBlockSet(doc: StageDocument, before: string, after: string): StageDocument {
  if (before === after || !doc.blockSetOrder.includes(before) || blockSetNameError(doc, after, before)) return doc;
  const order = doc.blockSetOrder.map((n) => (n === before ? after : n));
  const { [before]: types, ...rest } = doc.blockSets;
  const next = withSets(doc, order, { ...rest, [after]: types ?? [] }, doc.deletedBlockSets.filter((n) => n !== after));
  return renameOnStages(next, before, after);
}

/** 削除したセットを使っていたステージが移る先（BASIC があれば BASIC、なければ隣） */
export function replacementBlockSet(doc: StageDocument, name: string): string | null {
  const order = doc.blockSetOrder;
  if (name !== 'BASIC' && order.includes('BASIC')) return 'BASIC';
  const i = order.indexOf(name);
  return order[i + 1] ?? order[i - 1] ?? null;
}

/** 最後の 1 つは消せない */
export function deleteBlockSet(doc: StageDocument, name: string): StageDocument {
  const replacement = replacementBlockSet(doc, name);
  if (!doc.blockSetOrder.includes(name) || doc.blockSetOrder.length <= 1 || !replacement) return doc;
  const { [name]: _, ...rest } = doc.blockSets;
  const deleted = [...new Set([...doc.deletedBlockSets, name])];
  const next = withSets(doc, doc.blockSetOrder.filter((n) => n !== name), rest, deleted);
  return renameOnStages(next, name, replacement);
}

/** 並びの中で 1 つ上（-1）・下（+1）へ */
export function moveBlockSet(doc: StageDocument, name: string, direction: -1 | 1): StageDocument {
  const order = [...doc.blockSetOrder];
  const i = order.indexOf(name);
  const j = i + direction;
  if (i < 0 || j < 0 || j >= order.length) return doc;
  [order[i], order[j]] = [order[j], order[i]];
  return withSets(doc, order, doc.blockSets);
}

/** 使えるブロックを置き換える。重複は除く */
export function setBlockSetTypes(doc: StageDocument, name: string, types: readonly string[]): StageDocument {
  if (!doc.blockSetOrder.includes(name)) return doc;
  return withSets(doc, doc.blockSetOrder, { ...doc.blockSets, [name]: [...new Set(types)] });
}
