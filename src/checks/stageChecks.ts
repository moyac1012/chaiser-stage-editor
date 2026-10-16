/**
 * ステージ単位・ドキュメント単位の確認。
 * 実行（engine）とプログラム変換（blockly）をつなぐ唯一の場所。
 */
import type { Stage, StageDocument, StageRef } from '../domain/types';
import { compileProgram } from '../blockly/compileProgram';
import { createGame, type GameState } from '../engine/game';
import { runToEnd } from '../engine/runner';

/** 1 マップを模範解答で最後まで動かし、全ての手の状態を返す */
export function runStageMap(stage: Stage, mapIndex: number): GameState[] {
  const map = stage.maps[mapIndex] ?? stage.maps[0];
  const start = createGame(map.rows, stage.play.validation);
  if (start.status !== 'running') return [start];
  try {
    return runToEnd(start, compileProgram(stage.play.savedBlocklyXml));
  } catch (e) {
    return [{ ...start, status: 'failed', message: e instanceof Error ? e.message : String(e) }];
  }
}

export interface MapRunResult {
  mapIndex: number;
  label: string;
  status: GameState['status'];
  message: string;
  turns: number;
}

export function checkProgramOnAllMaps(stage: Stage): MapRunResult[] {
  return stage.maps.map((m, i) => {
    const last = runStageMap(stage, i).at(-1)!;
    return { mapIndex: i, label: m.label, status: last.status, message: last.message, turns: last.turn };
  });
}

export interface ExportSummary {
  totalStages: number;
  phaseCount: number;
  included: Array<StageRef & { stage: Stage }>;
  difficultyUnset: Array<StageRef & { stage: Stage }>;
  noSolutionImage: Array<StageRef & { stage: Stage }>;
  unsolved: Array<StageRef & { stage: Stage; reason: string }>;
}

/** 書き出し前の確認。「書き出しに含める」ステージだけを数える。 */
export function summarizeForExport(doc: StageDocument): ExportSummary {
  const included = doc.phases.flatMap((p) =>
    p.stages.map((stage, index) => ({ phaseId: p.id, index, stage })).filter((x) => x.stage.includeInExport),
  );
  const unsolved = included.flatMap((x) => {
    const bad = checkProgramOnAllMaps(x.stage).find((r) => r.status !== 'success');
    return bad ? [{ ...x, reason: `${bad.label}：${bad.message}` }] : [];
  });
  return {
    totalStages: doc.phases.reduce((n, p) => n + p.stages.length, 0),
    phaseCount: doc.phases.length,
    included,
    difficultyUnset: included.filter((x) => !x.stage.difficulty),
    noSolutionImage: included.filter((x) => x.stage.solutions.length === 0),
    unsolved,
  };
}
