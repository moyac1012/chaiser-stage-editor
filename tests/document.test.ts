import { describe, expect, it } from 'vitest';
import { DocumentFormatError, normalizeDocument } from '../src/domain/normalize';
import { addStage, deleteStage, duplicateStage, getStage, moveStage } from '../src/domain/stageTree';

const sample = {
  version: 2,
  blockSets: { BASIC: ['chaser_on_turn', 'chaser_on_start'] },
  blockSetOrder: ['BASIC'],
  customTopKey: 'keep',
  phases: [
    { id: 'A', name: 'A群', range: '01〜02', stages: [
      { no: 1, id: 'step-01-a', title: 'a', cond: 'items3+goal', maps: [{ rows: ['###', '#C#', '###'] }], extra: { x: 1 },
        solution: { imageDataUrl: 'data:image/png;base64,AAA', imageName: 'a.png' } },
      { no: 2, id: 'step-02-b', title: 'b', play: { validation: { kind: 'winByPut' } } },
    ] },
    { id: 'B', name: 'B群', stages: [{ no: 3, id: 'step-03-c', title: 'c', difficulty: 99 }] },
  ],
};

describe('読み込みと正規化', () => {
  it('知らないキーを残す', () => {
    const doc = normalizeDocument(sample);
    expect(doc.customTopKey).toBe('keep');
    expect(doc.phases[0].range).toBe('01〜02');
    expect(doc.phases[0].stages[0].extra).toEqual({ x: 1 });
  });

  it('旧形式の条件表記と画像を新形式へ移す', () => {
    const doc = normalizeDocument(sample);
    const [a, b] = doc.phases[0].stages;
    expect(a.play.validation.kind).toBe('collectItemsAndGoal');
    expect(a.cond).toBe('items1+goal');
    expect(a.solutions).toHaveLength(1);
    expect(b.play.validation.kind).toBe('defeatEnemy');
    expect(doc.phases[1].stages[0].difficulty).toBe(0);
    expect(doc.blockSets.BASIC).toEqual(['chaser_on_turn']);
  });

  it('phases が無いJSONは分かる言葉で断る', () => {
    expect(() => normalizeDocument({ foo: 1 })).toThrow(DocumentFormatError);
  });
});

describe('ステージの並べ替え', () => {
  it('グループをまたいで移動すると番号とIDが振り直される', () => {
    const doc = normalizeDocument(sample);
    const { doc: next, ref } = moveStage(doc, { phaseId: 'A', index: 0 }, 'B', 1);
    expect(ref).toEqual({ phaseId: 'B', index: 1 });
    expect(next.phases[0].stages.map((s) => s.id)).toEqual(['step-01-b']);
    expect(next.phases[1].stages.map((s) => s.id)).toEqual(['step-02-c', 'step-03-a']);
  });

  it('複製はすぐ後ろに入り、IDが重複しない', () => {
    const doc = normalizeDocument(sample);
    const { doc: next, ref } = duplicateStage(doc, { phaseId: 'A', index: 0 });
    expect(getStage(next, ref)!.id).toBe('step-02-a-copy');
    expect(next.phases[0].stages).toHaveLength(3);
  });

  it('追加と削除', () => {
    const doc = normalizeDocument(sample);
    const added = addStage(doc, 'B');
    expect(getStage(added.doc, added.ref)!.title).toBe('新しいステージ');
    const removed = deleteStage(added.doc, added.ref);
    expect(removed.doc.phases[1].stages).toHaveLength(1);
    expect(removed.ref).toEqual({ phaseId: 'B', index: 0 });
  });
});

import { addPhase, deletePhase } from '../src/domain/stageTree';

describe('グループ', () => {
  it('新しいグループIDは使われていない文字になる', () => {
    const doc = normalizeDocument(sample);
    const { doc: next, phaseId } = addPhase(doc);
    expect(phaseId).toBe('C');
    expect(next.phases).toHaveLength(3);
  });

  it('ステージがあるグループは削除しない', () => {
    const doc = normalizeDocument(sample);
    expect(deletePhase(doc, 'A')).toBe(doc);
    const { doc: withEmpty, phaseId } = addPhase(doc);
    expect(deletePhase(withEmpty, phaseId).phases).toHaveLength(2);
  });
});
