/**
 * 盤面に描くマスの一覧を作る純粋関数。
 * 「編集中のマップ＋模範解答の軌跡」と「実行の途中の状態」の 2 通りがある。
 */
import { tileInfo } from '../domain/tiles';
import type { Point } from '../domain/mapGrid';
import type { GameState } from '../engine/game';

export type CellKind = 'wall' | 'floor' | 'item' | 'cool' | 'hot' | 'goal' | 'start';

export interface BoardCell {
  x: number;
  y: number;
  kind: CellKind;
  label: string;
  trail: boolean;
  failed: boolean;
  reached: boolean;
  aria: string;
}

const KIND_BY_CHAR: Record<string, CellKind> = { '#': 'wall', '.': 'floor', I: 'item', C: 'cool', H: 'hot', G: 'goal' };

export function cellKindOf(char: string): CellKind {
  return KIND_BY_CHAR[char] ?? 'floor';
}

/** 軌跡：マスごとに初めて通った手の番号 */
export function stepNumbers(path: readonly Point[]): Map<string, number> {
  const steps = new Map<string, number>();
  path.forEach((p, i) => {
    const key = `${p.x},${p.y}`;
    if (i > 0 && !steps.has(key)) steps.set(key, i);
  });
  return steps;
}

export function pathOf(states: readonly GameState[]): Point[] {
  return states.map((s) => s.cool);
}

function key(x: number, y: number): string {
  return `${x},${y}`;
}

export interface TrailOverlay {
  path: readonly Point[];
  failedAt: Point | null;
  success: boolean;
}

/** 編集中のマップ。trail を渡すと、通ったマスに手の番号を出す。 */
export function editCells(rows: readonly string[], trail: TrailOverlay | null): BoardCell[] {
  const steps = trail ? stepNumbers(trail.path) : new Map<string, number>();
  const failedKey = trail?.failedAt ? key(trail.failedAt.x, trail.failedAt.y) : '';
  const cells: BoardCell[] = [];
  rows.forEach((row, y) => {
    [...row].forEach((ch, x) => {
      const info = tileInfo(ch);
      const kind = KIND_BY_CHAR[ch] ?? 'floor';
      const step = steps.get(key(x, y));
      const onTrail = step !== undefined && (kind === 'floor' || kind === 'item');
      cells.push({
        x,
        y,
        kind,
        label: onTrail ? String(step) : info.glyph,
        trail: onTrail,
        failed: failedKey === key(x, y),
        reached: !!trail?.success && kind === 'goal',
        aria: `(${x},${y}) ${info.name}${onTrail ? `、${step}手目に通る` : ''}`,
      });
    });
  });
  return cells;
}

/** 実行の途中（index 手目）の状態。start は COOL の最初の位置。 */
export function replayCells(state: GameState, path: readonly Point[], start: Point): BoardCell[] {
  const steps = stepNumbers(path);
  const failedKey = state.failedAt ? key(state.failedAt.x, state.failedAt.y) : '';
  const cells: BoardCell[] = [];
  state.tiles.forEach((row, y) => {
    row.forEach((ch, x) => {
      let kind: CellKind = KIND_BY_CHAR[ch] ?? 'floor';
      let label = tileInfo(ch).glyph;
      let trail = false;
      const k = key(x, y);
      if (state.goal && state.goal.x === x && state.goal.y === y) {
        kind = 'goal';
        label = 'G';
      }
      const step = steps.get(k);
      if (step !== undefined && (kind === 'floor' || kind === 'item')) {
        trail = true;
        label = String(step);
      }
      if (start.x === x && start.y === y && kind === 'floor') {
        kind = 'start';
        label = 'C';
        trail = false;
      }
      if (state.hot && state.hot.x === x && state.hot.y === y) {
        kind = 'hot';
        label = 'H';
        trail = false;
      }
      if (state.cool.x === x && state.cool.y === y) {
        kind = 'cool';
        label = 'C';
        trail = false;
      }
      cells.push({
        x,
        y,
        kind,
        label,
        trail,
        failed: failedKey === k,
        reached: state.status === 'success' && kind === 'cool' && !!state.goal && state.goal.x === x && state.goal.y === y,
        aria: `(${x},${y}) ${kind === 'cool' ? 'COOL' : kind === 'start' ? '最初の位置' : tileInfo(ch).name}`,
      });
    });
  });
  return cells;
}
