/**
 * グループ（phase）とステージの並びに対する操作。
 * すべて純粋関数で、新しい StageDocument を返す。
 * 番号（no）と ID の先頭番号は、並びが変わるたびに振り直す。
 */
import type { Phase, Stage, StageDocument, StageMap, StageRef } from './types';
import { makeBlankRows } from './mapGrid';
import { normalizeStage } from './normalize';

function renumber(doc: StageDocument): StageDocument {
  let no = 1;
  const phases = doc.phases.map((p) => ({
    ...p,
    stages: p.stages.map((s) => {
      const n = no++;
      const m = s.id.match(/^step-\d+-(.+)$/);
      const id = m ? `step-${String(n).padStart(2, '0')}-${m[1]}` : s.id;
      return { ...s, no: n, id };
    }),
  }));
  return { ...doc, phases };
}

function phaseIndex(doc: StageDocument, phaseId: string): number {
  return doc.phases.findIndex((p) => p.id === phaseId);
}

export function getStage(doc: StageDocument, ref: StageRef): Stage | null {
  const p = doc.phases[phaseIndex(doc, ref.phaseId)];
  return p?.stages[ref.index] ?? null;
}

export function getPhase(doc: StageDocument, phaseId: string): Phase | null {
  return doc.phases[phaseIndex(doc, phaseId)] ?? null;
}

/** 指定したステージを関数で置き換える */
export function updateStage(doc: StageDocument, ref: StageRef, fn: (s: Stage) => Stage): StageDocument {
  const pi = phaseIndex(doc, ref.phaseId);
  if (pi < 0 || !doc.phases[pi].stages[ref.index]) return doc;
  const phases = doc.phases.map((p, i) =>
    i === pi ? { ...p, stages: p.stages.map((s, j) => (j === ref.index ? fn(s) : s)) } : p,
  );
  return { ...doc, phases };
}

export function updateMap(doc: StageDocument, ref: StageRef, mapIndex: number, fn: (m: StageMap) => StageMap): StageDocument {
  return updateStage(doc, ref, (s) => ({
    ...s,
    maps: s.maps.map((m, i) => (i === mapIndex ? fn(m) : m)),
  }));
}

function slugOf(id: string): string {
  const m = id.match(/^step-\d+-(.+)$/);
  return m ? m[1] : id || 'new';
}

function uniqueSlug(doc: StageDocument, base: string): string {
  const used = new Set(doc.phases.flatMap((p) => p.stages.map((s) => slugOf(s.id))));
  if (!used.has(base)) return base;
  let n = 2;
  while (used.has(`${base}-${n}`)) n++;
  return `${base}-${n}`;
}

function blankStage(doc: StageDocument): Stage {
  return normalizeStage(
    { id: `step-00-${uniqueSlug(doc, 'new')}`, title: '新しいステージ', blockSet: doc.blockSetOrder[0] ?? 'BASIC', cond: 'goal', maps: [{ rows: makeBlankRows(7, 7) }] },
    0,
  );
}

/** グループの末尾に空のステージを足し、その位置を返す */
export function addStage(doc: StageDocument, phaseId: string): { doc: StageDocument; ref: StageRef } {
  const pi = phaseIndex(doc, phaseId);
  if (pi < 0) return { doc, ref: { phaseId, index: 0 } };
  const stage = blankStage(doc);
  const phases = doc.phases.map((p, i) => (i === pi ? { ...p, stages: [...p.stages, stage] } : p));
  return { doc: renumber({ ...doc, phases }), ref: { phaseId, index: phases[pi].stages.length - 1 } };
}

/** 直後に複製を作る */
export function duplicateStage(doc: StageDocument, ref: StageRef): { doc: StageDocument; ref: StageRef } {
  const src = getStage(doc, ref);
  if (!src) return { doc, ref };
  const copy: Stage = structuredClone(src);
  copy.id = `step-00-${uniqueSlug(doc, `${slugOf(src.id)}-copy`)}`;
  copy.title = `${src.title}（コピー）`;
  const pi = phaseIndex(doc, ref.phaseId);
  const phases = doc.phases.map((p, i) => {
    if (i !== pi) return p;
    const stages = [...p.stages];
    stages.splice(ref.index + 1, 0, copy);
    return { ...p, stages };
  });
  return { doc: renumber({ ...doc, phases }), ref: { phaseId: ref.phaseId, index: ref.index + 1 } };
}

/** 削除して、次に選ぶ位置を返す（グループが空なら null） */
export function deleteStage(doc: StageDocument, ref: StageRef): { doc: StageDocument; ref: StageRef | null } {
  const pi = phaseIndex(doc, ref.phaseId);
  if (pi < 0) return { doc, ref };
  const phases = doc.phases.map((p, i) => (i === pi ? { ...p, stages: p.stages.filter((_, j) => j !== ref.index) } : p));
  const left = phases[pi].stages.length;
  const next = left ? { phaseId: ref.phaseId, index: Math.min(ref.index, left - 1) } : null;
  return { doc: renumber({ ...doc, phases }), ref: next };
}

/**
 * ステージを別の位置へ移す（ドラッグ＆ドロップ・グループ変更の両方で使う）。
 * toIndex は移動先グループでの挿入位置。
 */
export function moveStage(doc: StageDocument, from: StageRef, toPhaseId: string, toIndex: number): { doc: StageDocument; ref: StageRef } {
  const stage = getStage(doc, from);
  const toPi = phaseIndex(doc, toPhaseId);
  if (!stage || toPi < 0) return { doc, ref: from };
  const removed = doc.phases.map((p) =>
    p.id === from.phaseId ? { ...p, stages: p.stages.filter((_, j) => j !== from.index) } : p,
  );
  const target = removed[toPi].stages;
  const at = Math.max(0, Math.min(toIndex, target.length));
  const phases = removed.map((p, i) => {
    if (i !== toPi) return p;
    const stages = [...p.stages];
    stages.splice(at, 0, stage);
    return { ...p, stages };
  });
  return { doc: renumber({ ...doc, phases }), ref: { phaseId: toPhaseId, index: at } };
}

/** 見つからないときは最初のステージ */
export function firstStageRef(doc: StageDocument): StageRef | null {
  for (const p of doc.phases) if (p.stages.length) return { phaseId: p.id, index: 0 };
  return null;
}

export function addMap(doc: StageDocument, ref: StageRef, rows: string[]): StageDocument {
  return updateStage(doc, ref, (s) => {
    const maps = [...s.maps, { label: `マップ ${String.fromCharCode(65 + s.maps.length)}`, rows, note: '' }];
    return { ...s, maps, variants: maps.length };
  });
}

export function deleteMap(doc: StageDocument, ref: StageRef, mapIndex: number): StageDocument {
  return updateStage(doc, ref, (s) => {
    if (s.maps.length <= 1) return s;
    const maps = s.maps.filter((_, i) => i !== mapIndex);
    return { ...s, maps, variants: maps.length };
  });
}

/** 使われていないグループ ID（A, B, … Z, AA, …）を作る */
function nextPhaseId(doc: StageDocument): string {
  const used = new Set(doc.phases.map((p) => p.id));
  for (let n = 0; ; n++) {
    let id = '';
    let k = n;
    do {
      id = String.fromCharCode(65 + (k % 26)) + id;
      k = Math.floor(k / 26) - 1;
    } while (k >= 0);
    if (!used.has(id)) return id;
  }
}

export function addPhase(doc: StageDocument): { doc: StageDocument; phaseId: string } {
  const id = nextPhaseId(doc);
  const phase: Phase = { id, name: '新しいグループ', desc: '', color: '#64748b', bg: '#f1f5f9', stages: [] };
  return { doc: { ...doc, phases: [...doc.phases, phase] }, phaseId: id };
}

/**
 * グループを別の位置へ移す。toIndex は移す前の並びでの挿入位置（その位置のグループの前に入る）。
 * ステージの番号と ID は新しい並びで振り直す。
 */
export function movePhase(doc: StageDocument, phaseId: string, toIndex: number): StageDocument {
  const from = phaseIndex(doc, phaseId);
  if (from < 0) return doc;
  const at = Math.max(0, Math.min(toIndex > from ? toIndex - 1 : toIndex, doc.phases.length - 1));
  if (at === from) return doc;
  const phases = doc.phases.filter((_, i) => i !== from);
  phases.splice(at, 0, doc.phases[from]);
  return renumber({ ...doc, phases });
}

export function renamePhase(doc: StageDocument, phaseId: string, name: string): StageDocument {
  return { ...doc, phases: doc.phases.map((p) => (p.id === phaseId ? { ...p, name } : p)) };
}

/** 空のグループだけ削除できる */
export function deletePhase(doc: StageDocument, phaseId: string): StageDocument {
  const phase = getPhase(doc, phaseId);
  if (!phase || phase.stages.length) return doc;
  return { ...doc, phases: doc.phases.filter((p) => p.id !== phaseId) };
}
