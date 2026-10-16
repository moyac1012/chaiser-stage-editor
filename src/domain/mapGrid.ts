/**
 * マップ（ASCII 行の配列）に対する純粋関数。
 * どれも引数を書き換えず、新しい配列を返す。
 */
import { isTileChar, tileInfo, type TileChar } from './tiles';

export interface Point {
  x: number;
  y: number;
}

export const MIN_MAP_SIZE = 3;
export const MAX_MAP_SIZE = 25;

export function mapWidth(rows: readonly string[]): number {
  return rows.reduce((w, r) => Math.max(w, r.length), 0);
}

export function charAt(rows: readonly string[], x: number, y: number): string | null {
  if (y < 0 || y >= rows.length || x < 0) return null;
  const row = rows[y];
  if (x >= row.length) return null;
  return row[x];
}

export function findTile(rows: readonly string[], char: TileChar): Point | null {
  for (let y = 0; y < rows.length; y++) {
    const x = rows[y].indexOf(char);
    if (x >= 0) return { x, y };
  }
  return null;
}

function replaceAt(row: string, x: number, char: string): string {
  return row.slice(0, x) + char + row.slice(x + 1);
}

/** 1 マスを塗る。COOL・HOT・ゴールは既存の位置を床に戻してから置く。 */
export function paintTile(rows: readonly string[], x: number, y: number, char: TileChar): string[] {
  if (charAt(rows, x, y) === null) return [...rows];
  const next = [...rows];
  if (tileInfo(char).unique) {
    const old = findTile(next, char);
    if (old && (old.x !== x || old.y !== y)) next[old.y] = replaceAt(next[old.y], old.x, '.');
  }
  next[y] = replaceAt(next[y], x, char);
  return next;
}

function isBorder(x: number, y: number, w: number, h: number): boolean {
  return x === 0 || y === 0 || x === w - 1 || y === h - 1;
}

/** 外周を壁、内側を床にした空のマップ */
export function makeBlankRows(width: number, height: number): string[] {
  const rows: string[] = [];
  for (let y = 0; y < height; y++) {
    let line = '';
    for (let x = 0; x < width; x++) line += isBorder(x, y, width, height) ? '#' : '.';
    rows.push(line);
  }
  return rows;
}

function clampSize(n: number): number {
  return Math.min(MAX_MAP_SIZE, Math.max(MIN_MAP_SIZE, Math.round(n)));
}

/**
 * 大きさを変える。右端・下端で増減し、外周はいつも壁にする。
 * 広げたとき、元の外周だったマスは床に戻す（内側に壁の線が残らないように）。
 */
export function resizeMap(rows: readonly string[], width: number, height: number): string[] {
  const w = clampSize(width);
  const h = clampSize(height);
  const oldW = mapWidth(rows);
  const oldH = rows.length;
  const next: string[] = [];
  for (let y = 0; y < h; y++) {
    let line = '';
    for (let x = 0; x < w; x++) {
      const old = charAt(rows, x, y);
      if (isBorder(x, y, w, h)) line += '#';
      else if (old === null || isBorder(x, y, oldW, oldH)) line += '.';
      else line += old;
    }
    next.push(line);
  }
  return next;
}

/** 行の長さをそろえ、足りない部分を壁で埋める */
export function padRows(rows: readonly string[]): string[] {
  const w = mapWidth(rows);
  return rows.map((r) => r.padEnd(w, '#'));
}

export interface AsciiParseResult {
  rows: string[] | null;
  error: string | null;
}

/** ASCII 入力を検証してマップにする */
export function parseAscii(text: string): AsciiParseResult {
  const lines = text.replace(/\r\n?/g, '\n').split('\n').filter((l) => l.length > 0);
  if (lines.length < MIN_MAP_SIZE) return { rows: null, error: `${MIN_MAP_SIZE}行以上必要です` };
  for (let y = 0; y < lines.length; y++) {
    for (let x = 0; x < lines[y].length; x++) {
      const ch = lines[y][x];
      if (!isTileChar(ch)) return { rows: null, error: `${y + 1}行目 ${x + 1}文字目の「${ch}」は使えません（# . I C H G のみ）` };
    }
  }
  for (const ch of ['C', 'H', 'G'] as const) {
    const count = lines.join('').split(ch).length - 1;
    if (count > 1) return { rows: null, error: `${tileInfo(ch).name}（${ch}）は1つだけ置けます` };
  }
  return { rows: padRows(lines), error: null };
}
