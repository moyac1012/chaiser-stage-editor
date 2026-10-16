/**
 * チュートリアル盤面のゲームルール（COOL 1 体の 1 手ずつの進行と勝敗判定）。
 * 旧エディタ stage_editor_next_game_rules.js の最終版の挙動に合わせている。
 * 状態は毎手コピーして返すので、途中の手に戻る表示にそのまま使える。
 */
import type { Direction, Validation } from '../domain/types';
import { findTile, type Point } from '../domain/mapGrid';

/** プログラムから見えるマスの値（CHaser の番号と同じ） */
export const TILE_FLOOR = 0;
export const TILE_CHARACTER = 1;
export const TILE_BLOCK = 2;
export const TILE_ITEM = 3;

export type ActionKind = 'walk' | 'put' | 'look' | 'search';

export interface Action {
  kind: ActionKind;
  dir: Direction;
}

export type GameStatus = 'running' | 'success' | 'failed';

export interface GameState {
  /** '#' '.' 'I' のみ。C/H/G は座標で持つ */
  tiles: string[][];
  cool: Point;
  hot: Point | null;
  goal: Point | null;
  turn: number;
  items: number;
  enemyDefeated: boolean;
  status: GameStatus;
  message: string;
  /** 失敗の原因になったマス（盤面で強調する） */
  failedAt: Point | null;
  /** その手で行った操作（表示用） */
  lastAction: Action | null;
  validation: Validation;
}

export const DIRECTION_DELTA: Record<Direction, Point> = {
  Up: { x: 0, y: -1 },
  Down: { x: 0, y: 1 },
  Left: { x: -1, y: 0 },
  Right: { x: 1, y: 0 },
};

export const DIRECTION_NAME: Record<Direction, string> = { Up: '上', Down: '下', Left: '左', Right: '右' };

const ACTION_NAME: Record<ActionKind, string> = { walk: '歩く', put: 'ブロックを置く', look: '見る', search: 'まっすぐ見る' };

export function describeAction(a: Action | null): string {
  return a ? `${DIRECTION_NAME[a.dir]}に${ACTION_NAME[a.kind]}` : '行動なし';
}

export function createGame(rows: readonly string[], validation: Validation): GameState {
  const cool = findTile(rows, 'C');
  const tiles = rows.map((r) => [...r].map((ch) => (ch === 'C' || ch === 'H' || ch === 'G' ? '.' : ch)));
  const base: GameState = {
    tiles,
    cool: cool ?? { x: 0, y: 0 },
    hot: findTile(rows, 'H'),
    goal: findTile(rows, 'G'),
    turn: 0,
    items: 0,
    enemyDefeated: false,
    status: 'running',
    message: '',
    failedAt: null,
    lastAction: null,
    validation,
  };
  if (!cool) return { ...base, status: 'failed', message: 'COOL（C）が盤面にありません' };
  return base;
}

function inside(s: GameState, x: number, y: number): boolean {
  return y >= 0 && y < s.tiles.length && x >= 0 && x < s.tiles[y].length;
}

function isBlock(s: GameState, x: number, y: number): boolean {
  return !inside(s, x, y) || s.tiles[y][x] === '#';
}

/** プログラムに渡すマスの番号 */
export function tileCode(s: GameState, x: number, y: number): number {
  if (!inside(s, x, y)) return TILE_BLOCK;
  if (s.hot && s.hot.x === x && s.hot.y === y) return TILE_CHARACTER;
  if (s.cool.x === x && s.cool.y === y) return TILE_CHARACTER;
  const ch = s.tiles[y][x];
  if (ch === '#') return TILE_BLOCK;
  if (ch === 'I') return TILE_ITEM;
  return TILE_FLOOR;
}

/** COOL を中心とした 3×3（左上から右下へ 0〜8 番） */
export function around(s: GameState): number[] {
  const out: number[] = [];
  for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) out.push(tileCode(s, s.cool.x + dx, s.cool.y + dy));
  return out;
}

/** 指定方向にまっすぐ 9 マス */
export function search(s: GameState, dir: Direction): number[] {
  const d = DIRECTION_DELTA[dir];
  const out: number[] = [];
  for (let i = 1; i <= 9; i++) out.push(tileCode(s, s.cool.x + d.x * i, s.cool.y + d.y * i));
  return out;
}

function cloneState(s: GameState): GameState {
  return { ...s, tiles: s.tiles.map((r) => [...r]), cool: { ...s.cool }, hot: s.hot && { ...s.hot } };
}

function succeed(s: GameState, message: string): GameState {
  return { ...s, status: 'success', message };
}

function fail(s: GameState, message: string, at: Point | null = null): GameState {
  return { ...s, status: 'failed', message, failedAt: at };
}

function surrounded(s: GameState, p: Point): boolean {
  return Object.values(DIRECTION_DELTA).every((d) => isBlock(s, p.x + d.x, p.y + d.y));
}

function remainingItems(s: GameState): number {
  return s.tiles.reduce((n, row) => n + row.filter((c) => c === 'I').length, 0);
}

/** 1 手終わるたびの勝敗判定 */
export function judge(s: GameState): GameState {
  if (s.status !== 'running') return s;
  if (s.hot && surrounded(s, s.hot)) return succeed(s, `${s.turn}手目にHOTの四方をブロックで囲みました`);
  if (surrounded(s, s.cool)) return fail(s, `${s.turn}手目にCOOLの四方がブロックになりました`, s.cool);

  const v = s.validation;
  const atGoal = !!s.goal && s.cool.x === s.goal.x && s.cool.y === s.goal.y;
  let note = '';
  if (v.kind === 'reachGoal' && atGoal) {
    const left = remainingItems(s);
    if (!v.requireAllItems || left === 0) return succeed(s, `${s.turn}手でゴールに到達しました`);
    note = `ゴールに着きましたが、アイテムが残り${left}個あります`;
  }
  if (v.kind === 'collectItemsAndGoal' && atGoal) {
    if (s.items >= v.minItems) return succeed(s, `${s.turn}手でアイテムを${s.items}個取ってゴールしました`);
    note = `ゴールに着きましたが、アイテムが足りません（${s.items}/${v.minItems}個）`;
  }
  if (v.kind === 'collectItems' && s.items >= v.minItems) return succeed(s, `${s.turn}手でアイテムを${s.items}個取りました`);
  if (v.kind === 'defeatEnemy' && s.enemyDefeated) return succeed(s, `${s.turn}手目にHOTを倒しました`);
  if (v.kind === 'survive' && s.turn >= v.minTurns) return succeed(s, `${v.minTurns}ターンやられずにいられました`);
  if (v.maxActions && s.turn >= v.maxActions) return fail(s, `${v.maxActions}手以内にクリアできませんでした`);
  return note ? { ...s, message: note } : s;
}

/** 1 手進める（action が null なら何もせずに手番だけ進む） */
export function applyAction(prev: GameState, action: Action | null): GameState {
  if (prev.status !== 'running') return prev;
  let s = cloneState(prev);
  s.turn += 1;
  s.lastAction = action;
  s.message = '';
  if (!action || action.kind === 'look' || action.kind === 'search') return judge(s);

  const d = DIRECTION_DELTA[action.dir];
  const target = { x: s.cool.x + d.x, y: s.cool.y + d.y };
  const where = `${DIRECTION_NAME[action.dir]} (${target.x},${target.y})`;

  if (action.kind === 'walk') {
    if (isBlock(s, target.x, target.y)) return fail(s, `${s.turn}手目で止まりました：${where} が壁です`, target);
    if (s.hot && s.hot.x === target.x && s.hot.y === target.y) return fail(s, `${s.turn}手目でHOTにぶつかりました：${where}`, target);
    const from = s.cool;
    s.cool = target;
    if (s.tiles[target.y][target.x] === 'I') {
      // CHaser のルール：アイテムを取ると、直前にいたマスがブロックになる
      s.items += 1;
      s.tiles[target.y][target.x] = '.';
      s.tiles[from.y][from.x] = '#';
    }
    return judge(s);
  }

  // put
  if (s.hot && s.hot.x === target.x && s.hot.y === target.y) {
    s = { ...s, hot: null, enemyDefeated: true };
    return judge(s);
  }
  if (inside(s, target.x, target.y) && s.tiles[target.y][target.x] === '.') s.tiles[target.y][target.x] = '#';
  return judge(s);
}

export function failWithError(s: GameState, message: string): GameState {
  return fail({ ...s, turn: s.turn + 1 }, `${s.turn + 1}手目でプログラムが止まりました：${message}`);
}
