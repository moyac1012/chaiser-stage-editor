/**
 * クリア条件（play.validation）と、旧形式の短い表記（stage.cond）の相互変換。
 * 旧エディタ stage_editor_next_conditions.js の normalizeValidation と同じ解釈にする。
 */
import type { Validation, ValidationKind } from './types';

const KINDS: readonly ValidationKind[] = ['reachGoal', 'collectItemsAndGoal', 'collectItems', 'defeatEnemy', 'survive'];

export const CONDITION_OPTIONS: ReadonlyArray<{ kind: ValidationKind; label: string }> = [
  { kind: 'reachGoal', label: 'ゴールに到達する' },
  { kind: 'collectItemsAndGoal', label: 'アイテムを N 個以上取ってゴールする' },
  { kind: 'collectItems', label: 'アイテムを N 個以上取る' },
  { kind: 'defeatEnemy', label: 'HOTを倒す' },
  { kind: 'survive', label: 'N ターンやられずにいる' },
];

function positiveInt(value: unknown, fallback: number, min: number): number {
  const n = Number.parseInt(String(value ?? ''), 10);
  return Number.isFinite(n) && n >= min ? n : fallback;
}

function inferKind(cond: string): ValidationKind {
  const text = cond.toLowerCase();
  if (text.includes('survive')) return 'survive';
  if (text.includes('enemy') || text.includes('defeat') || text.includes('put')) return 'defeatEnemy';
  if (text.includes('items') && text.includes('goal')) return 'collectItemsAndGoal';
  if (text.includes('items')) return 'collectItems';
  return 'reachGoal';
}

/** 保存済みの validation と cond 表記から、正規化した validation を作る */
export function normalizeValidation(raw: unknown, cond: string): Validation {
  const prev = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  let kind = prev.kind as string | undefined;
  if (kind === 'winByPut') kind = 'defeatEnemy';
  if (!kind || !KINDS.includes(kind as ValidationKind)) kind = inferKind(cond);
  return {
    kind: kind as ValidationKind,
    maxActions: positiveInt(prev.maxActions, 0, 0) || null,
    minItems: positiveInt(prev.minItems, 1, 1),
    minTurns: positiveInt(prev.minTurns, 10, 1),
    requireAllItems: Boolean(prev.requireAllItems),
  };
}

/** 旧エディタと同じ短い表記（書き出し時に stage.cond へ入れる） */
export function conditionCode(v: Validation): string {
  switch (v.kind) {
    case 'collectItemsAndGoal':
      return `items${v.minItems}+goal`;
    case 'collectItems':
      return `items${v.minItems}`;
    case 'defeatEnemy':
      return 'defeatEnemy';
    case 'survive':
      return `survive${v.minTurns}`;
    case 'reachGoal':
      return v.requireAllItems ? 'goal+items' : 'goal';
  }
}

/** 画面に出す説明文 */
export function describeValidation(v: Validation): string {
  const limit = v.maxActions ? `（${v.maxActions}手以内）` : '';
  switch (v.kind) {
    case 'collectItemsAndGoal':
      return `アイテムを${v.minItems}個以上取ってゴール${limit}`;
    case 'collectItems':
      return `アイテムを${v.minItems}個以上取る${limit}`;
    case 'defeatEnemy':
      return `HOTを倒す${limit}`;
    case 'survive':
      return `${v.minTurns}ターンやられずにいる${limit}`;
    case 'reachGoal':
      return `${v.requireAllItems ? 'アイテムを全部取って' : ''}ゴールに到達${limit}`;
  }
}

/** N 個・N ターンの入力欄が要るか */
export function needsItemCount(kind: ValidationKind): boolean {
  return kind === 'collectItemsAndGoal' || kind === 'collectItems';
}

export function needsTurnCount(kind: ValidationKind): boolean {
  return kind === 'survive';
}
