import { describe, expect, it } from 'vitest';
import { normalizeDocument } from '../src/domain/normalize';
import { addBlockSet, blockSetNameError, deleteBlockSet, moveBlockSet, renameBlockSet, setBlockSetTypes } from '../src/domain/blockSets';

const doc = normalizeDocument({
  blockSets: { BASIC: ['chaser_on_turn', 'chaser_turn_end'], CHECK: ['chaser_on_turn', 'controls_if'], LOOK: [] },
  blockSetOrder: ['BASIC', 'CHECK', 'LOOK'],
  phases: [{ id: 'A', stages: [{ title: 'a', blockSet: 'CHECK' }, { title: 'b', blockSet: 'LOOK' }] }],
});

describe('ブロックセットの編集', () => {
  it('名前の誤りを分かる言葉で返す', () => {
    expect(blockSetNameError(doc, '')).toBe('名前を入力してください');
    expect(blockSetNameError(doc, 'ループ')).toBe('名前に使えるのは半角英数字・_・- だけです');
    expect(blockSetNameError(doc, 'CHECK')).toBe('同じ名前のブロックセットがあります');
    expect(blockSetNameError(doc, 'CHECK', 'CHECK')).toBeNull();
  });

  it('追加：中身を写すか空で作る', () => {
    const copied = addBlockSet(doc, 'LOOP', 'CHECK');
    expect(copied.blockSetOrder).toEqual(['BASIC', 'CHECK', 'LOOK', 'LOOP']);
    expect(copied.blockSets.LOOP).toEqual(['chaser_on_turn', 'controls_if']);
    expect(addBlockSet(doc, 'LOOP', null).blockSets.LOOP).toEqual([]);
    expect(addBlockSet(doc, 'CHECK', null)).toBe(doc);
  });

  it('名前変更：並びの位置とステージの指定も変わる', () => {
    const next = renameBlockSet(doc, 'CHECK', 'IF');
    expect(next.blockSetOrder).toEqual(['BASIC', 'IF', 'LOOK']);
    expect(Object.keys(next.blockSets)).toEqual(['BASIC', 'IF', 'LOOK']);
    expect(next.phases[0].stages[0].blockSet).toBe('IF');
  });

  it('削除：使っていたステージは BASIC に移り、名前を deletedBlockSets に残す', () => {
    const next = deleteBlockSet(doc, 'LOOK');
    expect(next.blockSetOrder).toEqual(['BASIC', 'CHECK']);
    expect(next.blockSets.LOOK).toBeUndefined();
    expect(next.deletedBlockSets).toEqual(['LOOK']);
    expect(next.phases[0].stages[1].blockSet).toBe('BASIC');
  });

  it('BASIC を消すと隣のセットへ移る。最後の1つは消せない', () => {
    const withoutBasic = deleteBlockSet(doc, 'BASIC');
    expect(withoutBasic.blockSetOrder).toEqual(['CHECK', 'LOOK']);
    const only = deleteBlockSet(deleteBlockSet(withoutBasic, 'CHECK'), 'LOOK');
    expect(only.blockSetOrder).toEqual(['LOOK']);
    expect(only.phases[0].stages.map((s) => s.blockSet)).toEqual(['LOOK', 'LOOK']);
  });

  it('並べ替えとブロックの選択', () => {
    expect(moveBlockSet(doc, 'LOOK', -1).blockSetOrder).toEqual(['BASIC', 'LOOK', 'CHECK']);
    expect(moveBlockSet(doc, 'BASIC', -1)).toBe(doc);
    expect(setBlockSetTypes(doc, 'LOOK', ['chaser_on_turn', 'chaser_on_turn']).blockSets.LOOK).toEqual(['chaser_on_turn']);
  });
});

describe('HOT のデータ', () => {
  it('hotEnabled を優先し、hotBehavior.enabled とそろえる（旧エディタと同じ）', () => {
    const d = normalizeDocument({ phases: [{ stages: [
      { title: 'a', hotEnabled: true, hotBehavior: { enabled: false, savedBlocklyXml: '<xml/>', extra: 1 } },
      { title: 'b' },
      { title: 'c', hotCompetition: { enabled: true, turns: '5' }, cond: 'goal' },
    ] }] });
    const [a, b, c] = d.phases[0].stages;
    expect(a.hotBehavior).toEqual({ enabled: true, savedBlocklyXml: '<xml/>', extra: 1 });
    expect(b.hotEnabled).toBe(false);
    expect(b.hotBehavior.savedBlocklyXml).toContain('chaser_hot_on_turn');
    expect(c.hotCompetition).toEqual({ enabled: true, turns: 5 });
    expect(c.play.validation.kind).toBe('defeatEnemy');
    expect(c.cond).toBe('HOTを倒す または 5ターン後にアイテム数でHOTを上回る');
  });
});
