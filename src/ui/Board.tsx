/** 盤面のマス目。塗る操作はポインタイベントを親へ伝えるだけにする。 */
import type { BoardCell } from './boardView';

interface BoardProps {
  cells: BoardCell[];
  width: number;
  height: number;
  readonly: boolean;
  onPaintStart?: (x: number, y: number) => void;
  onPaintOver?: (x: number, y: number) => void;
  onPaintEnd?: () => void;
  onHover?: (p: { x: number; y: number } | null) => void;
}

function cellSize(width: number, height: number): number {
  return Math.max(22, Math.min(40, Math.floor(420 / Math.max(width, height))));
}

function cellClass(c: BoardCell, readonly: boolean): string {
  return ['cell', `t-${c.kind}`, c.trail && 'trail', c.failed && 'failed-at', c.reached && 'reached', readonly && 'readonly']
    .filter(Boolean)
    .join(' ');
}

/** ポインタの下にあるマスの座標（指でなぞったときに必要） */
function cellFromPoint(clientX: number, clientY: number): { x: number; y: number } | null {
  const el = document.elementFromPoint(clientX, clientY) as HTMLElement | null;
  const x = el?.dataset.x;
  const y = el?.dataset.y;
  return x !== undefined && y !== undefined ? { x: Number(x), y: Number(y) } : null;
}

export function Board({ cells, width, height, readonly, onPaintStart, onPaintOver, onPaintEnd, onHover }: BoardProps) {
  const size = cellSize(width, height);
  const cols = Array.from({ length: width }, (_, i) => i);
  const rows = Array.from({ length: height }, (_, i) => i);
  const track = `repeat(${width}, ${size}px)`;

  return (
    <div class="board-frame" style={{ '--cell': `${size}px` }}>
      <span />
      <div class="axis-cols" style={{ gridTemplateColumns: track }} aria-hidden="true">
        {cols.map((c) => (
          <span class="axis" key={c}>{c}</span>
        ))}
      </div>
      <div class="axis-rows" style={{ gridTemplateRows: `repeat(${height}, ${size}px)` }} aria-hidden="true">
        {rows.map((r) => (
          <span class="axis" key={r}>{r}</span>
        ))}
      </div>
      <div
        class="board"
        role="grid"
        aria-label="盤面"
        style={{ gridTemplateColumns: track }}
        onPointerMove={(e) => {
          if (readonly) return;
          const p = cellFromPoint(e.clientX, e.clientY);
          onHover?.(p);
          if (p && e.buttons === 1) onPaintOver?.(p.x, p.y);
        }}
        onPointerUp={() => onPaintEnd?.()}
        onPointerLeave={() => {
          onHover?.(null);
          onPaintEnd?.();
        }}
      >
        {cells.map((c) => (
          <button
            type="button"
            key={`${c.x},${c.y}`}
            class={cellClass(c, readonly)}
            data-x={c.x}
            data-y={c.y}
            aria-label={c.aria}
            tabIndex={readonly ? -1 : 0}
            onPointerDown={(e) => {
              if (readonly) return;
              e.preventDefault();
              (e.currentTarget as HTMLElement).releasePointerCapture?.(e.pointerId);
              onPaintStart?.(c.x, c.y);
            }}
            onKeyDown={(e) => {
              if (readonly || (e.key !== 'Enter' && e.key !== ' ')) return;
              e.preventDefault();
              onPaintStart?.(c.x, c.y);
              onPaintEnd?.();
            }}
          >
            {c.label}
          </button>
        ))}
      </div>
    </div>
  );
}
