/** 盤面パネル：マップの切り替え・大きさ・パレット・盤面／ASCII 表示・メモ */
import { useEffect, useRef, useState } from 'preact/hooks';
import type { Stage } from '../domain/types';
import { TILES, type TileChar } from '../domain/tiles';
import { mapWidth, paintTile, parseAscii, resizeMap } from '../domain/mapGrid';
import { Board } from './Board';
import { cellKindOf, editCells, replayCells, type TrailOverlay } from './boardView';
import type { GameState } from '../engine/game';
import type { Point } from '../domain/mapGrid';

export interface ReplayView {
  state: GameState;
  path: Point[];
  start: Point;
}

interface BoardPanelProps {
  stage: Stage;
  mapIndex: number;
  tool: TileChar;
  overlay: TrailOverlay | null;
  replay: ReplayView | null;
  onTool: (t: TileChar) => void;
  onSelectMap: (i: number) => void;
  onAddMap: () => void;
  onDeleteMap: (i: number) => void;
  onRows: (rows: string[], coalesceKey: string) => void;
  onNote: (note: string) => void;
}

export function BoardPanel(props: BoardPanelProps) {
  const { stage, mapIndex, tool, overlay, replay } = props;
  const map = stage.maps[mapIndex] ?? stage.maps[0];
  const [view, setView] = useState<'board' | 'ascii'>('board');
  const [hover, setHover] = useState<{ x: number; y: number } | null>(null);
  const rowsRef = useRef(map.rows);
  rowsRef.current = map.rows;
  const stroke = useRef<string | null>(null);

  const width = mapWidth(map.rows);
  const height = map.rows.length;
  const cells = replay ? replayCells(replay.state, replay.path, replay.start) : editCells(map.rows, overlay);

  function paint(x: number, y: number) {
    if (!stroke.current) return;
    const next = paintTile(rowsRef.current, x, y, tool);
    if (next.join('\n') === rowsRef.current.join('\n')) return;
    rowsRef.current = next;
    props.onRows(next, stroke.current);
  }

  function resize(w: number, h: number) {
    props.onRows(resizeMap(map.rows, w, h), `resize-${Date.now()}`);
  }

  const hoverChar = hover ? map.rows[hover.y]?.[hover.x] : undefined;
  const hoverText = hover && hoverChar ? `(${hover.x},${hover.y}) ${TILES.find((t) => t.char === hoverChar)?.name ?? ''}` : 'マスにカーソルを合わせると座標が出ます';

  return (
    <section class="panel board-panel" aria-label="盤面">
      <div class="board-toolbar">
        <div role="tablist" aria-label="マップ" class="inline" style={{ gap: '4px', flexWrap: 'wrap' }}>
          {stage.maps.map((m, i) => (
            <button type="button" role="tab" class="map-tab" aria-selected={i === mapIndex} key={i} onClick={() => props.onSelectMap(i)}>
              {m.label}
            </button>
          ))}
          <button type="button" class="map-add" onClick={props.onAddMap}>マップを追加</button>
        </div>
        <div class="size-control">
          <span class="field-hint">大きさ</span>
          <button type="button" aria-label="幅を減らす" onClick={() => resize(width - 1, height)}>−</button>
          <span class="size-value" aria-label="幅">{width}</span>
          <button type="button" aria-label="幅を増やす" onClick={() => resize(width + 1, height)}>+</button>
          <span class="field-hint">×</span>
          <button type="button" aria-label="高さを減らす" onClick={() => resize(width, height - 1)}>−</button>
          <span class="size-value" aria-label="高さ">{height}</span>
          <button type="button" aria-label="高さを増やす" onClick={() => resize(width, height + 1)}>+</button>
        </div>
      </div>

      <div role="radiogroup" aria-label="塗るマス" class="palette">
        {TILES.map((t, i) => (
          <button type="button" role="radio" aria-checked={tool === t.char} class="palette-item" key={t.char} onClick={() => props.onTool(t.char)}>
            <span class={`swatch t-${cellKindOf(t.char)}`}>
              {t.glyph}
            </span>
            <span>{t.name}</span>
            <span class="palette-key">{i + 1}</span>
          </button>
        ))}
      </div>

      {view === 'board' ? (
        <Board
          cells={cells}
          width={replay ? replay.state.tiles[0]?.length ?? width : width}
          height={replay ? replay.state.tiles.length : height}
          readonly={!!replay}
          onPaintStart={(x, y) => {
            stroke.current = `paint-${Date.now()}`;
            paint(x, y);
          }}
          onPaintOver={paint}
          onPaintEnd={() => (stroke.current = null)}
          onHover={setHover}
        />
      ) : (
        <AsciiEditor rows={map.rows} onRows={(rows) => props.onRows(rows, 'ascii')} />
      )}

      <div class="board-foot">
        <span>{replay ? '実行の途中を表示しています。マスを塗るには「編集に戻る」を押してください。' : hoverText}</span>
        <div class="segmented" role="tablist" aria-label="表示">
          <button type="button" role="tab" aria-selected={view === 'board'} onClick={() => setView('board')}>盤面</button>
          <button type="button" role="tab" aria-selected={view === 'ascii'} onClick={() => setView('ascii')}>ASCII</button>
        </div>
      </div>

      <div class="field">
        <label class="field-label" for="map-note">マップのメモ</label>
        <input id="map-note" class="input" value={map.note} onInput={(e) => props.onNote(e.currentTarget.value)} />
      </div>
      {stage.maps.length > 1 && (
        <button type="button" class="btn-danger-text" style={{ alignSelf: 'flex-start' }} onClick={() => props.onDeleteMap(mapIndex)}>
          {map.label}を削除
        </button>
      )}
    </section>
  );
}

function AsciiEditor({ rows, onRows }: { rows: string[]; onRows: (rows: string[]) => void }) {
  const joined = rows.join('\n');
  const [text, setText] = useState(joined);
  const [error, setError] = useState<string | null>(null);
  const editing = useRef(false);

  useEffect(() => {
    if (!editing.current) setText(joined);
  }, [joined]);

  return (
    <div class="field">
      <label class="field-label" for="ascii">ASCIIで直接編集（# 壁　. 床　I アイテム　C COOL　H HOT　G ゴール）</label>
      <textarea
        id="ascii"
        class="ascii"
        spellcheck={false}
        value={text}
        rows={Math.max(6, rows.length + 1)}
        onFocus={() => (editing.current = true)}
        onBlur={() => {
          editing.current = false;
          setText(joined);
          setError(null);
        }}
        onInput={(e) => {
          const value = e.currentTarget.value;
          setText(value);
          const result = parseAscii(value);
          setError(result.error);
          if (result.rows) onRows(result.rows);
        }}
      />
      {error && <span class="error-text" role="alert">{error}（この内容は反映していません）</span>}
    </div>
  );
}
