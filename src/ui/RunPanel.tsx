/** 実行パネル：再生操作・手の流れ・結果・失敗の説明 */
import type { StageRun } from './useStageRun';
import { describeAction } from '../engine/game';

const TIMELINE_LIMIT = 80;

export function RunPanel({ run }: { run: StageRun }) {
  const { states, final, index } = run;
  const last = states.length - 1;
  const current = index === null ? null : states[index];
  const failed = final.status === 'failed';

  return (
    <section class="panel run-panel" aria-label="実行">
      <div class="run-controls">
        <button type="button" class="btn btn-primary" onClick={run.play} disabled={run.playing || last === 0}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M7 4v16l13-8z" /></svg>
          {index !== null && index >= last ? 'もう一度実行' : '実行'}
        </button>
        <button type="button" class="btn" onClick={run.stepForward} disabled={index !== null && index >= last}>1手進める</button>
        <button type="button" class="btn" onClick={run.backToEdit} disabled={index === null}>編集に戻る</button>
        <div role="status" class={`run-status ${final.status}`}>
          {final.status === 'success' ? final.message : final.status === 'failed' ? 'クリアできません' : final.message || '実行中'}
        </div>
      </div>

      {last > 0 && last <= TIMELINE_LIMIT && (
        <div class="timeline" aria-label="手の流れ">
          <span class="timeline-label">手の流れ</span>
          {states.slice(1).map((s, i) => (
            <button
              type="button"
              key={i + 1}
              class={i + 1 === last && failed ? 'fail' : ''}
              aria-current={index === i + 1 ? 'step' : undefined}
              title={describeAction(s.lastAction)}
              onClick={() => run.seek(i + 1)}
            >
              {i + 1}
            </button>
          ))}
        </div>
      )}
      {last > TIMELINE_LIMIT && (
        <label class="inline field-hint">
          手の流れ
          <input type="range" min={0} max={last} value={index ?? last} onInput={(e) => run.seek(Number(e.currentTarget.value))} style={{ flex: 1 }} />
          <span>{index ?? last} / {last}手</span>
        </label>
      )}
      {current && (
        <span class="field-hint">
          {index}手目：{describeAction(current.lastAction)}　アイテム {current.items}個
        </span>
      )}

      {failed && (
        <div class="failure" role="alert">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#c9343f" stroke-width="2" stroke-linecap="round" aria-hidden="true" style={{ flex: 'none', marginTop: '2px' }}>
            <circle cx="12" cy="12" r="9" />
            <path d="M12 7v6" />
            <path d="M12 16.5v.5" />
          </svg>
          <div class="failure-body">
            <span class="failure-title">{final.message}</span>
            {final.lastAction && <span>最後の行動：{describeAction(final.lastAction)}（COOLは ({states[last - 1]?.cool.x},{states[last - 1]?.cool.y}) にいました）</span>}
          </div>
          {last > 1 && (
            <button type="button" class="btn" onClick={() => run.seek(last - 1)}>
              {last - 1}手目に戻す
            </button>
          )}
        </div>
      )}
    </section>
  );
}
