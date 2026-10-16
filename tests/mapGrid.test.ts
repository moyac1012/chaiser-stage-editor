import { describe, expect, it } from 'vitest';
import { findTile, makeBlankRows, paintTile, parseAscii, resizeMap } from '../src/domain/mapGrid';

describe('マップ操作', () => {
  it('COOLは1つだけ：塗ると前の位置は床に戻る', () => {
    const rows = ['#####', '#C..#', '#####'];
    const next = paintTile(rows, 3, 1, 'C');
    expect(next).toEqual(['#####', '#..C#', '#####']);
    expect(rows[1]).toBe('#C..#');
  });

  it('壁は何個でも塗れる', () => {
    expect(paintTile(['#####', '#...#', '#####'], 2, 1, '#')[1]).toBe('#.#.#');
  });

  it('広げると新しい外周が壁になり、中身は残る', () => {
    const next = resizeMap(['#####', '#C.G#', '#####'], 6, 4);
    expect(next).toEqual(['######', '#C.G.#', '#....#', '######']);
  });

  it('狭めても下限より小さくならない', () => {
    expect(resizeMap(makeBlankRows(5, 5), 1, 1)).toHaveLength(3);
  });

  it('ASCII入力の誤りを位置つきで返す', () => {
    expect(parseAscii('###\n#X#\n###').error).toBe('2行目 2文字目の「X」は使えません（# . I C H G のみ）');
    expect(parseAscii('####\n#CC#\n####').error).toBe('COOL（C）は1つだけ置けます');
    expect(parseAscii('####\n#C\n####').rows).toEqual(['####', '#C##', '####']);
  });

  it('記号の位置を探せる', () => {
    expect(findTile(['###', '#G#', '###'], 'G')).toEqual({ x: 1, y: 1 });
  });
});
