import { describe, expect, it } from 'vitest';
import { applyAction, applyHotAction, around, createGame, endTurn, hotAround, search, tileCode } from '../src/engine/game';
import { normalizeValidation } from '../src/domain/validation';

const goal = normalizeValidation({ kind: 'reachGoal' }, 'goal');

describe('ゲームルール', () => {
  it('壁に歩くと、その手の番号と場所つきで失敗する', () => {
    const s = createGame(['#####', '#.G.#', '#.#.#', '#C..#', '#####'], goal);
    const s1 = applyAction(s, { kind: 'walk', dir: 'Up' });
    const s2 = applyAction(s1, { kind: 'walk', dir: 'Up' });
    const s3 = applyAction(s2, { kind: 'walk', dir: 'Up' });
    expect(s3.status).toBe('failed');
    expect(s3.message).toBe('3手目で止まりました：上 (1,0) が壁です');
    expect(s3.failedAt).toEqual({ x: 1, y: 0 });
  });

  it('ゴールに着くと成功する', () => {
    const s = createGame(['###', '#G#', '#C#', '###'], goal);
    const s1 = applyAction(s, { kind: 'walk', dir: 'Up' });
    expect(s1.status).toBe('success');
    expect(s1.message).toBe('1手でゴールに到達しました');
  });

  it('アイテムを取ると、直前にいたマスがブロックになる', () => {
    const v = normalizeValidation({ kind: 'collectItems', minItems: 2 }, 'items2');
    const s = createGame(['######', '#CII.#', '######'], v);
    const s1 = applyAction(s, { kind: 'walk', dir: 'Right' });
    expect(s1.items).toBe(1);
    expect(s1.tiles[1][1]).toBe('#');
    const s2 = applyAction(s1, { kind: 'walk', dir: 'Right' });
    expect(s2.status).toBe('success');
  });

  it('HOTの隣にブロックを置くと倒せる', () => {
    const v = normalizeValidation({ kind: 'defeatEnemy' }, 'defeatEnemy');
    const s = createGame(['#####', '#C.H#', '#...#', '#####'], v);
    const s1 = applyAction(s, { kind: 'walk', dir: 'Right' });
    const s2 = applyAction(s1, { kind: 'put', dir: 'Right' });
    expect(s2.status).toBe('success');
    expect(s2.hot).toBeNull();
  });

  it('手数の上限を超えると失敗する', () => {
    const v = normalizeValidation({ kind: 'reachGoal', maxActions: 1 }, 'goal');
    const s = createGame(['#####', '#C.G#', '#####'], v);
    const s1 = applyAction(s, { kind: 'walk', dir: 'Right' });
    expect(s1.status).toBe('failed');
    expect(s1.message).toBe('1手以内にクリアできませんでした');
  });

  it('マスの番号は CHaser と同じ（床0・キャラ1・ブロック2・アイテム3）', () => {
    const s = createGame(['#####', '#.I.#', '#.C.#', '#.H.#', '#####'], goal);
    expect(around(s)).toEqual([0, 3, 0, 0, 1, 0, 0, 1, 0]);
    expect(search(s, 'Up').slice(0, 2)).toEqual([3, 2]);
    expect(tileCode(s, -1, 0)).toBe(2);
  });

  it('終わった後の手は状態を変えない', () => {
    const s = createGame(['###', '#G#', '#C#', '###'], goal);
    const s1 = applyAction(s, { kind: 'walk', dir: 'Up' });
    expect(applyAction(s1, { kind: 'walk', dir: 'Down' })).toBe(s1);
  });
});

describe('HOTの行動', () => {
  const survive = normalizeValidation({ kind: 'survive', minTurns: 10 }, 'survive10');

  it('HOT から見ると COOL は 1、自分のマスは 0', () => {
    const s = createGame(['#####', '#C.H#', '#####'], survive);
    expect(hotAround(s)).toEqual([2, 2, 2, 0, 0, 2, 2, 2, 2]);
    const s1 = applyAction(s, { kind: 'walk', dir: 'Right' });
    expect(hotAround(s1)[3]).toBe(1);
  });

  it('壁に向かって歩くとその場に止まる', () => {
    const s = applyAction(createGame(['#####', '#C.H#', '#####'], survive), null);
    const s1 = applyHotAction(s, { kind: 'walk', dir: 'Right' });
    expect(s1.hot).toEqual({ x: 3, y: 1 });
    expect(s1.status).toBe('running');
    expect(s1.hotLastDir).toBeNull();
  });

  it('COOL のマスに歩くと COOL がやられる', () => {
    const s = applyAction(createGame(['#####', '#C.H#', '#####'], survive), { kind: 'walk', dir: 'Right' });
    const s1 = applyHotAction(s, { kind: 'walk', dir: 'Left' });
    expect(s1.status).toBe('failed');
    expect(s1.message).toBe('1手目にHOTにつかまりました（HOTが左に歩いてきました）');
    expect(s1.failedAt).toEqual({ x: 2, y: 1 });
  });

  it('アイテムを取ると数え、直前にいたマスがブロックになる', () => {
    const s = applyAction(createGame(['######', '#C.IH#', '######'], survive), null);
    const s1 = applyHotAction(s, { kind: 'walk', dir: 'Left' });
    expect(s1.hotItems).toBe(1);
    expect(s1.tiles[1][4]).toBe('#');
    expect(s1.hotLastDir).toBe('Left');
  });

  it('ブロックは床にだけ置ける', () => {
    const s = applyAction(createGame(['######', '#.CH.#', '######'], survive), null);
    expect(applyHotAction(s, { kind: 'put', dir: 'Left' }).tiles[1][2]).toBe('.');
    expect(applyHotAction(s, { kind: 'put', dir: 'Right' }).tiles[1][4]).toBe('#');
  });

  it('対戦条件：N ターン後にアイテム数を比べる', () => {
    const v = normalizeValidation({ kind: 'defeatEnemy' }, 'defeatEnemy');
    const s = createGame(['#######', '#CI..H#', '#######'], v, 1);
    const won = endTurn(applyAction(s, { kind: 'walk', dir: 'Right' }));
    expect(won.status).toBe('success');
    expect(won.message).toBe('1ターン終了時にアイテム数でHOTを上回りました（COOL 1個 / HOT 0個）');
    const lost = endTurn(applyAction(s, null));
    expect(lost.status).toBe('failed');
  });
});
