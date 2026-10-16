/**
 * 読み込んだ JSON（旧エディタ形式を含む）を StageDocument にそろえる。
 * 知らないキーは捨てずに残す。
 */
import { MAX_DIFFICULTY, type Phase, type SolutionImage, type Stage, type StageDocument, type StageMap } from './types';
import { makeBlankRows, padRows } from './mapGrid';
import { conditionCode, normalizeValidation } from './validation';

type Raw = Record<string, unknown>;

function asObject(value: unknown): Raw {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Raw) : {};
}

function asString(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback;
}

function asStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((v): v is string => typeof v === 'string') : [];
}

function mapLabel(index: number): string {
  return `マップ ${String.fromCharCode(65 + index)}`;
}

export function normalizeMap(raw: unknown, index: number): StageMap {
  const m = asObject(raw);
  const rows = asStringArray(m.rows);
  return {
    ...m,
    label: asString(m.label) || mapLabel(index),
    rows: rows.length ? padRows(rows) : makeBlankRows(7, 7),
    note: asString(m.note),
  };
}

function normalizeDifficulty(value: unknown): number {
  const n = Number.parseInt(String(value ?? ''), 10);
  return Number.isFinite(n) && n >= 1 && n <= MAX_DIFFICULTY ? n : 0;
}

function isImage(value: unknown): value is SolutionImage {
  const url = asObject(value).imageDataUrl;
  return typeof url === 'string' && url.startsWith('data:image/');
}

/** 旧来の solution（1 枚）を solutions（複数）へ移す。旧エディタと同じ扱い。 */
function normalizeSolutions(stage: Raw): { solutions: SolutionImage[]; solution: Raw | undefined } {
  const solutions = (Array.isArray(stage.solutions) ? stage.solutions : []).filter(isImage);
  const legacy = stage.solution === undefined ? undefined : asObject(stage.solution);
  if (legacy && isImage(legacy) && !solutions.some((s) => s.imageDataUrl === legacy.imageDataUrl)) {
    solutions.push({
      imageDataUrl: legacy.imageDataUrl as string,
      imageName: asString(legacy.imageName),
      imageMimeType: asString(legacy.imageMimeType),
      note: asString(legacy.note),
      updatedAt: asString(legacy.updatedAt),
    });
  }
  const solution = legacy ? { ...legacy, imageDataUrl: '' } : undefined;
  return { solutions, solution };
}

export function normalizeStage(raw: unknown, no: number): Stage {
  const s = asObject(raw);
  const play = asObject(s.play);
  const cond = asString(s.cond, 'goal');
  const validation = normalizeValidation(play.validation, cond);
  // 旧エディタの「HOT対戦」条件は、HOTを倒す条件として扱われていた
  if (asObject(s.hotCompetition).enabled) {
    validation.kind = 'defeatEnemy';
    validation.maxActions = null;
  }
  const rawMaps = Array.isArray(s.maps) && s.maps.length ? s.maps : [{}];
  const maps = rawMaps.map(normalizeMap);
  const { solutions, solution } = normalizeSolutions(s);
  const stage: Stage = {
    ...s,
    no: Number(s.no) || no,
    id: asString(s.id) || `step-${String(no).padStart(2, '0')}-new`,
    title: asString(s.title) || '無題ステージ',
    blockSet: asString(s.blockSet) || 'BASIC',
    variants: maps.length,
    cond: asObject(s.hotCompetition).enabled ? cond : conditionCode(validation),
    goal: asString(s.goal),
    rule: asString(s.rule),
    maps,
    play: { ...play, validation, savedBlocklyXml: asString(play.savedBlocklyXml) },
    difficulty: normalizeDifficulty(s.difficulty),
    includeInExport: s.includeInExport !== false,
    solutions,
  };
  if (solution) stage.solution = solution;
  return stage;
}

function normalizePhase(raw: unknown, index: number, startNo: number): Phase {
  const p = asObject(raw);
  const rawStages = Array.isArray(p.stages) ? p.stages : [];
  return {
    ...p,
    id: asString(p.id) || String.fromCharCode(65 + index),
    name: asString(p.name) || '無題グループ',
    desc: asString(p.desc),
    color: asString(p.color) || '#64748b',
    bg: asString(p.bg) || '#f1f5f9',
    stages: rawStages.map((s, i) => normalizeStage(s, startNo + i)),
  };
}

function normalizeBlockSets(raw: unknown): Record<string, string[]> {
  const src = asObject(raw);
  const result: Record<string, string[]> = {};
  for (const [name, list] of Object.entries(src)) {
    result[name] = [...new Set(asStringArray(list).filter((t) => t !== 'chaser_on_start'))];
  }
  return result;
}

export class DocumentFormatError extends Error {}

export function normalizeDocument(raw: unknown): StageDocument {
  const d = asObject(raw);
  if (!Array.isArray(d.phases)) throw new DocumentFormatError('phases が見つかりません。ステージエディタで書き出したJSONを選んでください。');
  let no = 1;
  const phases = d.phases.map((p, i) => {
    const phase = normalizePhase(p, i, no);
    no += phase.stages.length;
    return phase;
  });
  const blockSets = normalizeBlockSets(d.blockSets);
  const order = asStringArray(d.blockSetOrder).filter((n) => n in blockSets);
  for (const name of Object.keys(blockSets)) if (!order.includes(name)) order.push(name);
  return {
    ...d,
    version: 2,
    blockSets,
    blockSetOrder: order,
    deletedBlockSets: asStringArray(d.deletedBlockSets),
    phases,
  };
}
