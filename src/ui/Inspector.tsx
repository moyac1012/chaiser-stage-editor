/** 右側のステージ設定 */
import { MAX_DIFFICULTY, type Phase, type Stage, type Validation, type ValidationKind } from '../domain/types';
import { CONDITION_OPTIONS, conditionCode, describeValidation, needsItemCount, needsTurnCount } from '../domain/validation';
import type { MapRunResult } from '../checks/stageChecks';
import { competitionText, competitionTurns, DEFAULT_COMPETITION_TURNS } from '../domain/hot';
import { findTile } from '../domain/mapGrid';

type Updater = (s: Stage) => Stage;

interface InspectorProps {
  stage: Stage;
  phaseId: string;
  phases: Phase[];
  blockSetNames: string[];
  mapResults: MapRunResult[];
  onUpdate: (fn: Updater, coalesceKey: string | null) => void;
  onMoveToGroup: (phaseId: string) => void;
  onAddImages: (files: File[]) => void;
  onRemoveImage: (index: number) => void;
  onDelete: () => void;
  onOpenHotProgram: () => void;
  onEditBlockSets: () => void;
}

const COMPETITION = 'hotCompetition';

function withValidation(s: Stage, patch: Partial<Validation>): Stage {
  const validation = { ...s.play.validation, ...patch };
  const { hotCompetition: _, ...rest } = s;
  return { ...rest, cond: conditionCode(validation), play: { ...s.play, validation } };
}

/** 対戦条件にする。土台は「HOTを倒す」（旧エディタと同じ） */
function withCompetition(s: Stage, turns: number): Stage {
  const validation: Validation = { ...s.play.validation, kind: 'defeatEnemy', maxActions: null };
  return { ...s, hotCompetition: { ...s.hotCompetition, enabled: true, turns }, cond: competitionText(turns), play: { ...s.play, validation } };
}

function withHotEnabled(s: Stage, enabled: boolean): Stage {
  return { ...s, hotEnabled: enabled, hotBehavior: { ...s.hotBehavior, enabled } };
}

function toPositiveInt(value: string, fallback: number): number {
  const n = Number.parseInt(value, 10);
  return Number.isFinite(n) && n >= 1 ? n : fallback;
}

export function Inspector(props: InspectorProps) {
  const { stage: s, onUpdate } = props;
  const v = s.play.validation;
  const hotOn = s.hotBehavior.enabled;
  const competition = s.hotCompetition?.enabled ? s.hotCompetition : null;
  const mapsWithoutHot = s.maps.filter((m) => !findTile(m.rows, 'H')).map((m) => m.label);
  const solved = props.mapResults.every((r) => r.status === 'success');
  const firstBad = props.mapResults.find((r) => r.status !== 'success');

  return (
    <aside class="pane-right" aria-label="ステージ設定">
      <h2 style={{ margin: 0, fontSize: '15px' }}>ステージ設定</h2>

      <div class="field">
        <label class="field-label" for="f-title">タイトル</label>
        <input id="f-title" class="input" value={s.title} onInput={(e) => { const title = e.currentTarget.value; onUpdate((x) => ({ ...x, title }), 'title'); }} />
        <span class="field-hint">ID：<span class="mono">{s.id}</span>（番号は並びに合わせて自動で振り直します）</span>
      </div>

      <div class="grid-2">
        <div class="field">
          <label class="field-label" for="f-group">グループ</label>
          <select id="f-group" class="select" value={props.phaseId} onChange={(e) => props.onMoveToGroup(e.currentTarget.value)}>
            {props.phases.map((p) => (
              <option value={p.id} key={p.id}>{p.id} {p.name}</option>
            ))}
          </select>
        </div>
        <div class="field">
          <div class="inline" style={{ justifyContent: 'space-between' }}>
            <label class="field-label" for="f-set">ブロックセット</label>
            <button type="button" class="btn-text" style={{ fontSize: '12px', padding: 0 }} onClick={props.onEditBlockSets}>編集</button>
          </div>
          <select id="f-set" class="select" value={s.blockSet} onChange={(e) => { const blockSet = e.currentTarget.value; onUpdate((x) => ({ ...x, blockSet }), null); }}>
            {!props.blockSetNames.includes(s.blockSet) && <option value={s.blockSet}>{s.blockSet}（定義なし）</option>}
            {props.blockSetNames.map((n) => (
              <option value={n} key={n}>{n}</option>
            ))}
          </select>
        </div>
      </div>

      <div class="field">
        <div class="inline" style={{ justifyContent: 'space-between' }}>
          <label class="field-label" for="f-diff">難易度</label>
          <span style={{ fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{s.difficulty ? `${s.difficulty} / ${MAX_DIFFICULTY}` : '未設定'}</span>
        </div>
        <input
          id="f-diff"
          type="range"
          min={1}
          max={MAX_DIFFICULTY}
          value={s.difficulty || 1}
          style={{ width: '100%', accentColor: s.difficulty ? '#1b1f24' : '#a8aea7' }}
          onInput={(e) => { const difficulty = Number(e.currentTarget.value); onUpdate((x) => ({ ...x, difficulty }), 'difficulty'); }}
        />
        {s.difficulty > 0 && (
          <button type="button" class="btn-text" style={{ alignSelf: 'flex-start', fontSize: '12px' }} onClick={() => onUpdate((x) => ({ ...x, difficulty: 0 }), null)}>
            未設定に戻す
          </button>
        )}
      </div>

      <div class="field">
        <label class="field-label" for="f-cond">クリア条件</label>
        <select
          id="f-cond"
          class="select"
          value={competition ? COMPETITION : v.kind}
          onChange={(e) => {
            const value = e.currentTarget.value;
            if (value === COMPETITION) onUpdate((x) => withCompetition(x, competitionTurns(x.hotCompetition?.turns)), null);
            else onUpdate((x) => withValidation(x, { kind: value as ValidationKind }), null);
          }}
        >
          {CONDITION_OPTIONS.map((o) => (
            <option value={o.kind} key={o.kind}>{o.label}</option>
          ))}
          <option value={COMPETITION}>HOTを倒す、または N ターン後にアイテム数で上回る</option>
        </select>
        {competition ? (
          <div class="inline" style={{ flexWrap: 'wrap' }}>
            <label class="inline field-hint">
              N =
              <input type="number" min={1} class="input" style={{ width: '80px' }} value={competition.turns} onInput={(e) => { const turns = toPositiveInt(e.currentTarget.value, DEFAULT_COMPETITION_TURNS); onUpdate((x) => withCompetition(x, turns), 'competitionTurns'); }} />
              ターン
            </label>
            <span class="field-hint">N ターン目の COOL と HOT の行動が終わってから、取ったアイテムの数を比べます。同じ数か HOT が多ければ失敗です。</span>
          </div>
        ) : (
        <div class="inline" style={{ flexWrap: 'wrap' }}>
          {needsItemCount(v.kind) && (
            <label class="inline field-hint">
              N =
              <input type="number" min={1} class="input" style={{ width: '80px' }} value={v.minItems} onInput={(e) => { const minItems = toPositiveInt(e.currentTarget.value, 1); onUpdate((x) => withValidation(x, { minItems }), 'minItems'); }} />
              個
            </label>
          )}
          {needsTurnCount(v.kind) && (
            <label class="inline field-hint">
              N =
              <input type="number" min={1} class="input" style={{ width: '80px' }} value={v.minTurns} onInput={(e) => { const minTurns = toPositiveInt(e.currentTarget.value, 10); onUpdate((x) => withValidation(x, { minTurns }), 'minTurns'); }} />
              ターン
            </label>
          )}
          {v.kind === 'reachGoal' && (
            <label class="check field-hint">
              <input type="checkbox" checked={v.requireAllItems} onChange={(e) => { const requireAllItems = e.currentTarget.checked; onUpdate((x) => withValidation(x, { requireAllItems }), null); }} />
              アイテムを全部取る
            </label>
          )}
          <label class="inline field-hint">
            手数の上限
            <input type="number" min={0} class="input" style={{ width: '90px' }} placeholder="なし" value={v.maxActions ?? ''} onInput={(e) => { const n = Number.parseInt(e.currentTarget.value, 10); const maxActions = Number.isFinite(n) && n > 0 ? n : null; onUpdate((x) => withValidation(x, { maxActions }), 'maxActions'); }} />
          </label>
        </div>
        )}
        <span class="field-hint">{competition ? competitionText(competition.turns) : describeValidation(v)}</span>
        <span class="field-hint" style={{ color: solved ? 'var(--ok-ink)' : 'var(--ng-ink)' }}>
          {solved
            ? `全${props.mapResults.length}マップを模範解答でクリアできます（${props.mapResults.map((r) => `${r.label} ${r.turns}手`).join('・')}）`
            : `模範解答ではクリアできないマップがあります。${firstBad?.label}：${firstBad?.message}`}
        </span>
      </div>

      <div class="field">
        <label class="field-label" for="f-goal">学習目標</label>
        <textarea id="f-goal" class="textarea" rows={3} value={s.goal} onInput={(e) => { const goal = e.currentTarget.value; onUpdate((x) => ({ ...x, goal }), 'goal'); }} />
      </div>
      <div class="field">
        <label class="field-label" for="f-rule">反応型ルール</label>
        <textarea id="f-rule" class="textarea" rows={2} value={s.rule} onInput={(e) => { const rule = e.currentTarget.value; onUpdate((x) => ({ ...x, rule }), 'rule'); }} />
      </div>

      <div class="inspector-section">
        <span class="field-label">HOTの動き</span>
        <label class="check">
          <input type="checkbox" checked={hotOn} onChange={(e) => { const enabled = e.currentTarget.checked; onUpdate((x) => withHotEnabled(x, enabled), null); }} />
          HOTを行動プログラムで動かす
        </label>
        <span class="field-hint">
          {hotOn
            ? 'COOLが1手動くたびに、ゲームが続いていればHOTも1回動きます。プログラムは中央の「HOTの動き」で編集します。'
            : 'HOTはその場から動きません（壁と同じように道をふさぎます）。'}
        </span>
        {hotOn && mapsWithoutHot.length > 0 && (
          <span class="field-hint" style={{ color: 'var(--warn-ink)' }}>
            {mapsWithoutHot.join('・')}にはHOT（H）がないので、そのマップではHOTは動きません。
          </span>
        )}
        {(hotOn || competition) && (
          <button type="button" class="btn-text" style={{ alignSelf: 'flex-start', fontSize: '13px', padding: '2px 0' }} onClick={props.onOpenHotProgram}>
            HOTの行動プログラムを開く
          </button>
        )}
      </div>

      <div class="inspector-section">
        <span class="field-label">模範解答の画像</span>
        <div class="thumbs">
          {s.solutions.length === 0 && <div class="thumb-empty">未登録</div>}
          {s.solutions.map((img, i) => (
            <div class="thumb" key={i}>
              <img src={img.imageDataUrl} alt={`模範解答 ${i + 1}${img.imageName ? `（${img.imageName}）` : ''}`} />
              <button type="button" aria-label={`模範解答 ${i + 1} を削除`} onClick={() => props.onRemoveImage(i)}>×</button>
            </div>
          ))}
        </div>
        <label class="btn" style={{ alignSelf: 'flex-start' }}>
          画像を追加
          <input
            type="file"
            accept="image/png,image/jpeg,image/webp"
            multiple
            class="visually-hidden"
            onChange={(e) => {
              const files = [...(e.currentTarget.files ?? [])];
              e.currentTarget.value = '';
              if (files.length) props.onAddImages(files);
            }}
          />
        </label>
        <span class="field-hint">PNG・JPEG・WebP、1枚3MBまで。</span>
      </div>

      <div class="inspector-section">
        <label class="check">
          <input type="checkbox" checked={s.includeInExport} onChange={(e) => { const includeInExport = e.currentTarget.checked; onUpdate((x) => ({ ...x, includeInExport }), null); }} />
          公開の対象にする
        </label>
        <span class="field-hint">旧エディタの「出力対象」と同じ印です。外すと一覧で薄く表示され、書き出し前の確認からも外れます。JSONには残ります。</span>
        <button type="button" class="btn-danger-text" style={{ alignSelf: 'flex-start' }} onClick={props.onDelete}>このステージを削除</button>
      </div>
    </aside>
  );
}
