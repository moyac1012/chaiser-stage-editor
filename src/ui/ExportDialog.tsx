/** 書き出し前の確認ダイアログ */
import { useEffect, useRef, useState } from 'preact/hooks';
import type { StageRef } from '../domain/types';
import type { ExportSummary } from '../checks/stageChecks';

interface ExportDialogProps {
  summary: ExportSummary;
  defaultName: string;
  onExport: (fileName: string) => void;
  onJump: (ref: StageRef) => void;
  onClose: () => void;
}

type Item = StageRef & { stage: { no: number; title: string }; reason?: string };

function CheckRow({ label, items, onJump }: { label: string; items: Item[]; onJump: (r: StageRef) => void }) {
  return (
    <div>
      <div class="check-line">
        <span>{label}</span>
        <span class={`check-count ${items.length ? 'warn' : 'ok'}`}>{items.length ? `${items.length} ステージ` : 'なし'}</span>
      </div>
      {items.length > 0 && (
        <details>
          <summary class="field-hint" style={{ cursor: 'pointer' }}>ステージを見る（押すとそのステージを開きます）</summary>
        <div class="check-items" style={{ marginTop: '6px' }}>
          {items.slice(0, 40).map((x) => (
            <button type="button" key={`${x.phaseId}-${x.index}`} title={x.reason ?? x.stage.title} onClick={() => onJump(x)}>
              {String(x.stage.no).padStart(2, '0')} {x.stage.title}
            </button>
          ))}
          {items.length > 40 && <span class="field-hint">ほか {items.length - 40} 件</span>}
        </div>
        </details>
      )}
    </div>
  );
}

export function ExportDialog({ summary, defaultName, onExport, onJump, onClose }: ExportDialogProps) {
  const [name, setName] = useState(defaultName);
  const first = useRef<HTMLInputElement>(null);

  useEffect(() => {
    first.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const fileName = name.trim().endsWith('.json') ? name.trim() : `${name.trim() || 'chaiser-stages'}.json`;

  return (
    <div class="backdrop" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div class="dialog" role="dialog" aria-modal="true" aria-labelledby="export-title">
        <div class="field">
          <h2 id="export-title">JSONを書き出す</h2>
          <span class="field-hint">
            {summary.phaseCount}グループ・{summary.totalStages}ステージをすべて書き出します。下の確認は、公開の対象にしている {summary.included.length} ステージについてです。確認は書き出しを止めません。
          </span>
        </div>
        <div class="check-list">
          <CheckRow label="模範解答でクリアできない盤面がある" items={summary.unsolved} onJump={onJump} />
          <CheckRow label="難易度が未設定" items={summary.difficultyUnset} onJump={onJump} />
          <CheckRow label="模範解答の画像がない" items={summary.noSolutionImage} onJump={onJump} />
        </div>
        <div class="field">
          <label class="field-label" for="export-name">ファイル名</label>
          <input id="export-name" ref={first} class="input mono" value={name} onInput={(e) => setName(e.currentTarget.value)} />
          <span class="field-hint">旧エディタ・ステージ一覧と同じ形式（version 2）です。</span>
        </div>
        <div class="dialog-actions">
          <button type="button" class="btn" onClick={onClose}>キャンセル</button>
          <button type="button" class="btn btn-primary" onClick={() => onExport(fileName)}>書き出す</button>
        </div>
      </div>
    </div>
  );
}
