/**
 * 画面全体の状態（編集中のドキュメント・履歴・選択位置）と、その更新規則。
 * ドキュメントの中身を変える処理は domain 側の関数で作り、ここは履歴と選択だけを扱う。
 */
import type { StageDocument, StageRef } from '../domain/types';
import { firstStageRef, getStage } from '../domain/stageTree';
import { createHistory, pushHistory, redoHistory, undoHistory, type History } from './history';

export interface EditorState {
  history: History<StageDocument>;
  selected: StageRef | null;
  mapIndex: number;
  /** 最後に書き出した時点のドキュメント（未書き出しの変更の判定に使う） */
  exportedDoc: StageDocument | null;
}

export type EditorAction =
  | { type: 'load'; doc: StageDocument; exported: boolean }
  | { type: 'edit'; doc: StageDocument; key?: string | null; select?: StageRef | null }
  | { type: 'undo' }
  | { type: 'redo' }
  | { type: 'select'; ref: StageRef }
  | { type: 'selectMap'; index: number }
  | { type: 'exported' };

/** 選択位置がドキュメントに無ければ、近い位置に直す */
function validRef(doc: StageDocument, ref: StageRef | null): StageRef | null {
  if (ref && getStage(doc, ref)) return ref;
  if (ref) {
    const phase = doc.phases.find((p) => p.id === ref.phaseId);
    if (phase?.stages.length) return { phaseId: phase.id, index: Math.min(ref.index, phase.stages.length - 1) };
  }
  return firstStageRef(doc);
}

function validMapIndex(doc: StageDocument, ref: StageRef | null, index: number): number {
  const stage = ref ? getStage(doc, ref) : null;
  if (!stage) return 0;
  return Math.max(0, Math.min(index, stage.maps.length - 1));
}

function withDoc(state: EditorState, history: History<StageDocument>, ref: StageRef | null): EditorState {
  const selected = validRef(history.present, ref);
  const mapIndex = ref && state.selected && ref.phaseId === state.selected.phaseId && ref.index === state.selected.index ? state.mapIndex : 0;
  return { ...state, history, selected, mapIndex: validMapIndex(history.present, selected, mapIndex) };
}

export function initialEditorState(doc: StageDocument): EditorState {
  return { history: createHistory(doc), selected: firstStageRef(doc), mapIndex: 0, exportedDoc: null };
}

export function editorReducer(state: EditorState, action: EditorAction): EditorState {
  switch (action.type) {
    case 'load':
      return { ...initialEditorState(action.doc), exportedDoc: action.exported ? action.doc : null };
    case 'edit': {
      const history = pushHistory(state.history, action.doc, action.key ?? null);
      return withDoc(state, history, action.select === undefined ? state.selected : action.select);
    }
    case 'undo':
      return withDoc(state, undoHistory(state.history), state.selected);
    case 'redo':
      return withDoc(state, redoHistory(state.history), state.selected);
    case 'select':
      return { ...state, selected: validRef(state.history.present, action.ref), mapIndex: 0 };
    case 'selectMap':
      return { ...state, mapIndex: validMapIndex(state.history.present, state.selected, action.index) };
    case 'exported':
      return { ...state, exportedDoc: state.history.present };
  }
}

export function hasUnexportedChanges(state: EditorState): boolean {
  return state.history.present !== state.exportedDoc;
}
