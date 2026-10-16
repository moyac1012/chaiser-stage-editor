/**
 * 画面全体の組み立て。状態の持ち方と、各パネルの操作をドメイン関数へつなぐ。
 * 各パネルは必要な値と操作だけを受け取る。
 */
import { useEffect, useMemo, useReducer, useRef, useState } from 'preact/hooks';
import type { SolutionImage, Stage, StageDocument, StageRef } from '../domain/types';
import type { TileChar } from '../domain/tiles';
import { TILES } from '../domain/tiles';
import { DocumentFormatError, normalizeDocument } from '../domain/normalize';
import { makeBlankRows, mapWidth } from '../domain/mapGrid';
import * as tree from '../domain/stageTree';
import { checkProgramOnAllMaps, summarizeForExport, type ExportSummary } from '../checks/stageChecks';
import { editorReducer, hasUnexportedChanges, initialEditorState } from '../store/editorState';
import * as storage from '../store/persistence';
import { defaultExportFileName, documentFingerprint, downloadText, fetchDefaultDocument, readFileAsDataUrl, serializeDocument } from '../io/files';
import { Header } from './Header';
import { StageList } from './StageList';
import { BoardPanel } from './BoardPanel';
import { ProgramPanel } from './ProgramPanel';
import { RunPanel } from './RunPanel';
import { Inspector } from './Inspector';
import { ExportDialog } from './ExportDialog';
import { useStageRun } from './useStageRun';
import { pathOf } from './boardView';

const SAVE_DELAY_MS = 400;
const MAX_IMAGE_BYTES = 3 * 1024 * 1024;
const IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/webp'];

interface Toast {
  text: string;
  undoable: boolean;
}

const EMPTY_DOC: StageDocument = { version: 2, blockSets: {}, blockSetOrder: [], deletedBlockSets: [], phases: [] };

function isTypingTarget(el: EventTarget | null): boolean {
  const node = el as HTMLElement | null;
  if (!node) return false;
  return !!node.closest('input, textarea, select, [contenteditable], .blockly-host, .blocklyWidgetDiv, .blocklyDropDownDiv');
}

export function App() {
  const [state, dispatch] = useReducer(editorReducer, initialEditorState(EMPTY_DOC));
  const [booted, setBooted] = useState(false);
  const [bootError, setBootError] = useState<string | null>(null);
  const [legacyData, setLegacyData] = useState<unknown | null>(null);
  const [saving, setSaving] = useState(false);
  const [tool, setTool] = useState<TileChar>('#');
  const [toast, setToast] = useState<Toast | null>(null);
  const [exportSummary, setExportSummary] = useState<ExportSummary | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  const doc = state.history.present;
  const ref = state.selected;
  const stage = ref ? tree.getStage(doc, ref) : null;
  const phase = ref ? tree.getPhase(doc, ref.phaseId) : null;

  // ---- 起動：ブラウザ内の保存 → 旧エディタのデータ → 既定データ ----
  useEffect(() => {
    (async () => {
      try {
        const saved = await storage.loadSavedDocument();
        if (saved) {
          const loaded = normalizeDocument(saved);
          const exportedPrint = await storage.loadExportedAt();
          dispatch({ type: 'load', doc: loaded, exported: exportedPrint === documentFingerprint(loaded) });
        } else {
          setLegacyData(storage.readLegacyLocalData());
          const loaded = normalizeDocument(await fetchDefaultDocument());
          dispatch({ type: 'load', doc: loaded, exported: true });
        }
      } catch (e) {
        setBootError(e instanceof Error ? e.message : String(e));
      } finally {
        setBooted(true);
      }
    })();
  }, []);

  // ---- 自動保存（IndexedDB） ----
  useEffect(() => {
    if (!booted || doc === EMPTY_DOC) return;
    setSaving(true);
    const timer = window.setTimeout(() => {
      storage.saveDocument(doc).finally(() => setSaving(false));
    }, SAVE_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [doc, booted]);

  // ---- キーボード ----
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const mod = e.ctrlKey || e.metaKey;
      if (mod && e.key.toLowerCase() === 'z' && !isTypingTarget(e.target)) {
        e.preventDefault();
        dispatch({ type: e.shiftKey ? 'redo' : 'undo' });
        return;
      }
      if (mod && e.key.toLowerCase() === 'y' && !isTypingTarget(e.target)) {
        e.preventDefault();
        dispatch({ type: 'redo' });
        return;
      }
      if (!mod && !e.altKey && /^[1-6]$/.test(e.key) && !isTypingTarget(e.target)) {
        setTool(TILES[Number(e.key) - 1].char);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 6000);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const run = useStageRun(stage, state.mapIndex);
  const mapResults = useMemo(
    () => (stage ? checkProgramOnAllMaps(stage) : []),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [stage?.play.savedBlocklyXml, stage?.maps, JSON.stringify(stage?.play.validation)],
  );

  // ---- 操作 ----
  function edit(next: StageDocument, key: string | null = null, select?: StageRef | null) {
    dispatch({ type: 'edit', doc: next, key, select });
  }

  function updateStage(fn: (s: Stage) => Stage, key: string | null) {
    if (ref) edit(tree.updateStage(doc, ref, fn), key ? `${key}:${ref.phaseId}:${ref.index}` : null);
  }

  function loadDocument(raw: unknown, message: string) {
    try {
      const loaded = normalizeDocument(raw);
      dispatch({ type: 'load', doc: loaded, exported: false });
      setToast({ text: message, undoable: false });
    } catch (e) {
      setToast({ text: e instanceof DocumentFormatError ? e.message : `読み込めませんでした：${e instanceof Error ? e.message : String(e)}`, undoable: false });
    }
  }

  async function addImages(files: File[]) {
    const rejected: string[] = [];
    const images: SolutionImage[] = [];
    for (const f of files) {
      if (!IMAGE_TYPES.includes(f.type)) rejected.push(`${f.name}（形式）`);
      else if (f.size > MAX_IMAGE_BYTES) rejected.push(`${f.name}（3MB超）`);
      else images.push({ imageDataUrl: await readFileAsDataUrl(f), imageName: f.name, imageMimeType: f.type, note: '', updatedAt: new Date().toISOString() });
    }
    if (images.length) updateStage((s) => ({ ...s, solutions: [...s.solutions, ...images] }), null);
    if (rejected.length) setToast({ text: `追加できなかった画像：${rejected.join('、')}`, undoable: false });
  }

  function openExport() {
    setExportSummary(summarizeForExport(doc));
  }

  async function exportJson(fileName: string) {
    downloadText(serializeDocument(doc), fileName, 'application/json');
    await storage.saveExportedAt(documentFingerprint(doc));
    dispatch({ type: 'exported' });
    setExportSummary(null);
    setToast({ text: `${fileName} を書き出しました`, undoable: false });
  }

  if (!booted) return <div class="boot">読み込んでいます…</div>;

  const allowedTypes = stage ? doc.blockSets[stage.blockSet] ?? doc.blockSets.BASIC ?? [] : [];
  const replay =
    run && run.index !== null
      ? { state: run.states[run.index], path: pathOf(run.states.slice(0, run.index + 1)), start: run.states[0].cool }
      : null;
  const overlay = run ? { path: pathOf(run.states), failedAt: run.final.failedAt, success: run.final.status === 'success' } : null;

  return (
    <div class="app">
      <Header
        crumbGroup={phase ? `${phase.id} ${phase.name}` : '—'}
        crumbStage={stage ? `${String(stage.no).padStart(2, '0')} ${stage.title}` : 'ステージ未選択'}
        saving={saving}
        dirty={hasUnexportedChanges(state)}
        canUndo={state.history.past.length > 0}
        canRedo={state.history.future.length > 0}
        onUndo={() => dispatch({ type: 'undo' })}
        onRedo={() => dispatch({ type: 'redo' })}
        onExport={openExport}
        onImport={() => fileInput.current?.click()}
        onLoadDefault={async () => {
          if (!confirm('いまのデータを既定のステージに置き換えます。書き出していない変更は失われます。よろしいですか？')) return;
          loadDocument(await fetchDefaultDocument(), '既定のステージを読み込みました');
        }}
        onClearLocal={async () => {
          if (!confirm('このブラウザに保存したステージデータを消して、既定のステージに戻します。よろしいですか？')) return;
          await storage.clearSavedDocument();
          loadDocument(await fetchDefaultDocument(), 'ブラウザのデータを消して、既定のステージに戻しました');
        }}
      />
      <input
        ref={fileInput}
        type="file"
        accept=".json,application/json"
        class="visually-hidden"
        tabIndex={-1}
        aria-hidden="true"
        onChange={async (e) => {
          const file = e.currentTarget.files?.[0];
          e.currentTarget.value = '';
          if (!file) return;
          try {
            loadDocument(JSON.parse(await file.text()), `${file.name} を読み込みました`);
          } catch {
            setToast({ text: `${file.name} はJSONとして読めませんでした`, undoable: false });
          }
        }}
      />

      {bootError && (
        <div class="panel notice" role="alert">
          <p>{bootError}</p>
        </div>
      )}
      {legacyData !== null && (
        <div class="panel notice">
          <p>このブラウザに旧エディタ（stage_editor_next.html）の作業データがあります。既定のステージの代わりに、そちらを読み込めます。</p>
          <button type="button" class="btn btn-primary" onClick={() => { loadDocument(legacyData, '旧エディタの作業データを読み込みました'); setLegacyData(null); }}>旧エディタのデータを読み込む</button>
          <button type="button" class="btn" onClick={() => setLegacyData(null)}>既定のステージのまま使う</button>
        </div>
      )}

      <div class="workspace">
        <StageList
          phases={doc.phases}
          selected={ref}
          onSelect={(r) => dispatch({ type: 'select', ref: r })}
          onAddStage={(phaseId) => {
            const r = tree.addStage(doc, phaseId);
            edit(r.doc, null, r.ref);
          }}
          onMove={(from, toPhaseId, toIndex) => {
            const r = tree.moveStage(doc, from, toPhaseId, toIndex);
            const followSelection = ref && ref.phaseId === from.phaseId && ref.index === from.index;
            edit(r.doc, null, followSelection ? r.ref : undefined);
          }}
          onDuplicate={(r0) => {
            const r = tree.duplicateStage(doc, r0);
            edit(r.doc, null, r.ref);
          }}
          onDelete={(r0) => {
            const title = tree.getStage(doc, r0)?.title ?? '';
            const r = tree.deleteStage(doc, r0);
            edit(r.doc, null, r.ref);
            setToast({ text: `「${title}」を削除しました`, undoable: true });
          }}
          onAddGroup={() => edit(tree.addPhase(doc).doc)}
          onRenameGroup={(phaseId, name) => edit(tree.renamePhase(doc, phaseId, name), `group-name:${phaseId}`)}
          onDeleteGroup={(phaseId) => edit(tree.deletePhase(doc, phaseId))}
        />

        <main class="pane-center">
          {stage && ref && run ? (
            <>
              <div class="board-and-program">
                <div class="board-column">
                <BoardPanel
                  stage={stage}
                  mapIndex={state.mapIndex}
                  tool={tool}
                  overlay={overlay}
                  replay={replay}
                  onTool={setTool}
                  onSelectMap={(i) => dispatch({ type: 'selectMap', index: i })}
                  onAddMap={() => {
                    const cur = stage.maps[state.mapIndex];
                    edit(tree.addMap(doc, ref, makeBlankRows(mapWidth(cur.rows), cur.rows.length)));
                    dispatch({ type: 'selectMap', index: stage.maps.length });
                  }}
                  onDeleteMap={(i) => edit(tree.deleteMap(doc, ref, i))}
                  onRows={(rows, key) => edit(tree.updateMap(doc, ref, state.mapIndex, (m) => ({ ...m, rows })), `${key}:${ref.phaseId}:${ref.index}`)}
                  onNote={(note) => edit(tree.updateMap(doc, ref, state.mapIndex, (m) => ({ ...m, note })), `note:${ref.phaseId}:${ref.index}:${state.mapIndex}`)}
                />
                <RunPanel run={run} />
                </div>
                <ProgramPanel
                  stageKey={`${ref.phaseId}:${ref.index}:${stage.id}`}
                  xml={stage.play.savedBlocklyXml}
                  blockSet={stage.blockSet}
                  allowedTypes={allowedTypes}
                  onChange={(xml) => updateStage((s) => ({ ...s, play: { ...s.play, savedBlocklyXml: xml } }), null)}
                />
              </div>
            </>
          ) : (
            <div class="panel notice">
              <p>ステージがありません。左の一覧の「ステージを追加」から作ってください。</p>
            </div>
          )}
        </main>

        {stage && ref && (
          <Inspector
            stage={stage}
            phaseId={ref.phaseId}
            phases={doc.phases}
            blockSetNames={doc.blockSetOrder}
            mapResults={mapResults}
            onUpdate={updateStage}
            onMoveToGroup={(toPhaseId) => {
              if (toPhaseId === ref.phaseId) return;
              const target = tree.getPhase(doc, toPhaseId);
              const r = tree.moveStage(doc, ref, toPhaseId, target ? target.stages.length : 0);
              edit(r.doc, null, r.ref);
            }}
            onAddImages={addImages}
            onRemoveImage={(i) => updateStage((s) => ({ ...s, solutions: s.solutions.filter((_, j) => j !== i) }), null)}
            onDelete={() => {
              const title = stage.title;
              const r = tree.deleteStage(doc, ref);
              edit(r.doc, null, r.ref);
              setToast({ text: `「${title}」を削除しました`, undoable: true });
            }}
          />
        )}
      </div>

      {exportSummary && (
        <ExportDialog
          summary={exportSummary}
          defaultName={defaultExportFileName(new Date())}
          onExport={exportJson}
          onJump={(r) => {
            setExportSummary(null);
            dispatch({ type: 'select', ref: r });
          }}
          onClose={() => setExportSummary(null)}
        />
      )}

      {toast && (
        <div class="toast" role="status">
          <span>{toast.text}</span>
          {toast.undoable && (
            <button type="button" onClick={() => { dispatch({ type: 'undo' }); setToast(null); }}>元に戻す</button>
          )}
        </div>
      )}
    </div>
  );
}
