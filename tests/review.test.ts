import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { normalizeDocument } from '../src/domain/normalize';
import { buildReviewData, reviewHtml } from '../src/io/reviewPage';
import { describeProgram } from '../src/blockly/programText';

const raw = JSON.parse(readFileSync(new URL('../public/data/default-stages.json', import.meta.url), 'utf8'));
const doc = normalizeDocument(raw);

describe('レビュー用 HTML', () => {
  it('公開の対象だけを、番号を振り直して載せる', () => {
    const first = doc.phases[0];
    const off = { ...doc, phases: [{ ...first, stages: first.stages.map((s, i) => (i === 0 ? { ...s, includeInExport: false } : s)) }, ...doc.phases.slice(1)] };
    const data = buildReviewData(off);
    const stages = data.phases.flatMap((p) => p.stages);
    const included = off.phases.flatMap((p) => p.stages).filter((s) => s.includeInExport);
    expect(stages.map((s) => s.id)).toEqual(included.map((s) => s.id));
    expect(stages.map((s) => s.no)).toEqual(included.map((_, i) => i + 1));
    expect(stages[0]).toMatchObject({ no: 1, id: first.stages[1].id });
    expect(data.blockSets.map((b) => b.name)).toEqual(doc.blockSetOrder);
  });

  it('HOT が動くステージには行動プログラムの文章を付ける', () => {
    const id = doc.phases.flatMap((p) => p.stages).find((s) => s.no === 25)!.id;
    const s25 = buildReviewData(doc).phases.flatMap((p) => p.stages).find((s) => s.id === id)!;
    expect(s25.hotProgram).toBe(
      ['HOTの毎ターン', '\tもし HOTの↑ 上のマスがブロック', '\t\tHOTが歩く：↓ 下', '\tそうでなくもし HOTの↓ 下のマスがブロック', '\t\tHOTが歩く：↑ 上', '\tそうでなければ', '\t\tHOTが前に進んだ向きで歩く（最初は：↑ 上）', '\tHOTのターンを終える'].join('\n'),
    );
    const s1 = buildReviewData(doc).phases[0].stages[0];
    expect(s1.hotProgram).toBeNull();
  });

  it('文字はエスケープし、画像は data:image の URL だけを埋め込む', () => {
    const stage = doc.phases[0].stages[0];
    const evil = {
      ...stage,
      title: '<script>alert(1)</script>',
      solutions: [
        { imageDataUrl: 'data:image/png;base64,AAAA', imageName: 'ok.png' },
        { imageDataUrl: 'javascript:alert(1)', imageName: 'bad' },
      ],
    };
    const html = reviewHtml(buildReviewData({ ...doc, phases: [{ ...doc.phases[0], stages: [evil] }] }), new Date(2026, 9, 16));
    expect(html).not.toContain('<script>');
    expect(html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');
    expect(html).toContain('src="data:image/png;base64,AAAA"');
    expect(html).not.toContain('javascript:');
    expect(html).toContain('2026-10-16 書き出し');
  });

  it('対象がないときはその旨を出す', () => {
    const none = { ...doc, phases: doc.phases.map((p) => ({ ...p, stages: p.stages.map((s) => ({ ...s, includeInExport: false })) })) };
    expect(reviewHtml(buildReviewData(none), new Date())).toContain('公開の対象にしたステージがありません');
  });

  it('プログラムの文章：空・壊れた XML', () => {
    expect(describeProgram('')).toBe('（プログラムは未設定です）');
    expect(describeProgram('<xml')).toBe('（プログラムを読み取れませんでした）');
  });
});
