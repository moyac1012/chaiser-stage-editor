/**
 * ステージデータの型。旧エディタ（docs/stage_editor_next.html）が書き出す
 * version 2 形式と互換にする。ここに無いキーも `[key: string]: unknown` で保持し、
 * 読み込み → 書き出しで情報が欠けないようにする。
 */

export type Direction = 'Up' | 'Down' | 'Left' | 'Right';

export type ValidationKind =
  | 'reachGoal'
  | 'collectItemsAndGoal'
  | 'collectItems'
  | 'defeatEnemy'
  | 'survive';

export interface Validation {
  kind: ValidationKind;
  /** null は手数制限なし */
  maxActions: number | null;
  minItems: number;
  minTurns: number;
  requireAllItems: boolean;
}

export interface StageMap {
  label: string;
  rows: string[];
  note: string;
  [key: string]: unknown;
}

export interface SolutionImage {
  imageDataUrl: string;
  imageName?: string;
  imageMimeType?: string;
  note?: string;
  updatedAt?: string;
  [key: string]: unknown;
}

/** HOT の行動プログラム。enabled のときだけ実行確認で HOT を動かす */
export interface HotBehavior {
  enabled: boolean;
  savedBlocklyXml: string;
  [key: string]: unknown;
}

/** 旧エディタの「HOTを倒す、または N ターン後にアイテム数で上回る」条件 */
export interface HotCompetition {
  enabled: boolean;
  turns: number;
  [key: string]: unknown;
}

export interface Stage {
  no: number;
  id: string;
  title: string;
  blockSet: string;
  variants: number;
  cond: string;
  goal: string;
  rule: string;
  maps: StageMap[];
  play: {
    validation: Validation;
    savedBlocklyXml: string;
    [key: string]: unknown;
  };
  /** 0 は未設定。1〜15 */
  difficulty: number;
  includeInExport: boolean;
  solutions: SolutionImage[];
  /** 旧エディタは hotBehavior.enabled と同じ値をここにも書く */
  hotEnabled: boolean;
  hotBehavior: HotBehavior;
  hotCompetition?: HotCompetition;
  [key: string]: unknown;
}

export interface Phase {
  id: string;
  name: string;
  desc: string;
  color: string;
  bg: string;
  stages: Stage[];
  [key: string]: unknown;
}

export interface StageDocument {
  version: 2;
  blockSets: Record<string, string[]>;
  blockSetOrder: string[];
  deletedBlockSets: string[];
  phases: Phase[];
  [key: string]: unknown;
}

/** 一覧上でステージを指す位置 */
export interface StageRef {
  phaseId: string;
  index: number;
}

export const MAX_DIFFICULTY = 15;
