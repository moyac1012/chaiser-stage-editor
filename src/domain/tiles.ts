/** マップのASCII記号と、その意味・表示の対応表 */

export type TileChar = '#' | '.' | 'I' | 'C' | 'H' | 'G';

export interface TileInfo {
  char: TileChar;
  name: string;
  /** 盤面に描く記号（壁・床は空） */
  glyph: string;
  /** 1 マップに 1 つだけ置けるか */
  unique: boolean;
}

export const TILES: readonly TileInfo[] = [
  { char: '#', name: '壁', glyph: '', unique: false },
  { char: '.', name: '床', glyph: '', unique: false },
  { char: 'I', name: 'アイテム', glyph: 'I', unique: false },
  { char: 'C', name: 'COOL', glyph: 'C', unique: true },
  { char: 'H', name: 'HOT', glyph: 'H', unique: true },
  { char: 'G', name: 'ゴール', glyph: 'G', unique: true },
];

const BY_CHAR = new Map<string, TileInfo>(TILES.map((t) => [t.char, t]));

export function tileInfo(char: string): TileInfo {
  return BY_CHAR.get(char) ?? BY_CHAR.get('.')!;
}

export function isTileChar(char: string): char is TileChar {
  return BY_CHAR.has(char);
}
