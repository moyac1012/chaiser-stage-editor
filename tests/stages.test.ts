import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { normalizeDocument } from '../src/domain/normalize';
import { checkProgramOnAllMaps } from '../src/checks/stageChecks';

const raw = JSON.parse(readFileSync(new URL('../public/data/default-stages.json', import.meta.url), 'utf8'));
const doc = normalizeDocument(raw);
const stages = doc.phases.flatMap((p) => p.stages);

describe('既定ステージ（default-stages.json）', () => {
  it('82ステージ・13グループを読み込める', () => {
    expect(stages).toHaveLength(82);
    expect(doc.phases).toHaveLength(13);
  });

  it('旧エディタで完成している模範解答は、全マップでクリアになる', () => {
    // 旧エディタの実行結果と同じく、これらは保存済みプログラムでクリアできる
    const expectedClear = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 16, 17, 18, 19, 20, 21, 22, 23, 24, 26, 27, 28, 29, 31, 32, 33, 38];
    const cleared = stages.filter((s) => checkProgramOnAllMaps(s).every((r) => r.status === 'success')).map((s) => s.no);
    expect(cleared).toEqual(expectedClear);
  });

  it('作りかけのプログラムは理由つきで失敗と判定される', () => {
    const s34 = stages.find((s) => s.no === 34)!;
    expect(checkProgramOnAllMaps(s34)[0].message).toContain('ターンを終える');
    const s15 = stages.find((s) => s.no === 15)!;
    expect(checkProgramOnAllMaps(s15)[0].message).toContain('毎ターン');
  });
});

describe('書き出しの互換性', () => {
  it('読み込み→書き出しで、元のキーと値が失われない（条件表記・画像の移し替えを除く）', () => {
    const out = JSON.parse(JSON.stringify(doc));
    const lost: string[] = [];
    const walk = (a: unknown, b: unknown, path: string) => {
      if (a && typeof a === 'object' && !Array.isArray(a)) {
        for (const k of Object.keys(a as object)) {
          if (!(k in (b as object))) lost.push(`${path}.${k}`);
          else walk((a as Record<string, unknown>)[k], (b as Record<string, unknown>)[k], `${path}.${k}`);
        }
      } else if (Array.isArray(a)) {
        a.forEach((v, i) => walk(v, (b as unknown[])[i], `${path}[${i}]`));
      } else if (a !== b && !/\.(cond|variants|imageDataUrl)$/.test(path)) {
        lost.push(`${path}: ${JSON.stringify(a)} → ${JSON.stringify(b)}`);
      }
    };
    walk(raw, out, '');
    expect(lost).toEqual([]);
  });
});
