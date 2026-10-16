/**
 * 選んでいるステージ・マップを模範解答で動かした結果と、その再生位置。
 * 盤面やプログラムが変わると結果を作り直し、再生は編集表示に戻す。
 */
import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import type { Stage } from '../domain/types';
import { runStageMap } from '../checks/stageChecks';
import type { GameState } from '../engine/game';

export const PLAY_INTERVAL_MS = 350;

export interface StageRun {
  states: GameState[];
  final: GameState;
  /** null のときは編集表示（軌跡つき） */
  index: number | null;
  playing: boolean;
  play: () => void;
  stepForward: () => void;
  seek: (i: number) => void;
  backToEdit: () => void;
}

export function useStageRun(stage: Stage | null, mapIndex: number): StageRun | null {
  const map = stage?.maps[mapIndex];
  const states = useMemo(
    () => (stage ? runStageMap(stage, mapIndex) : []),
    // プログラム・盤面・クリア条件のどれかが変わったときだけ動かし直す
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [stage?.play.savedBlocklyXml, map?.rows.join('\n'), JSON.stringify(stage?.play.validation)],
  );
  const [index, setIndex] = useState<number | null>(null);
  const [playing, setPlaying] = useState(false);
  const timer = useRef<number>(0);

  useEffect(() => {
    setIndex(null);
    setPlaying(false);
  }, [states]);

  useEffect(() => {
    if (!playing) return;
    timer.current = window.setInterval(() => {
      setIndex((i) => {
        const next = (i ?? 0) + 1;
        if (next >= states.length - 1) setPlaying(false);
        return Math.min(next, states.length - 1);
      });
    }, PLAY_INTERVAL_MS);
    return () => window.clearInterval(timer.current);
  }, [playing, states]);

  if (!stage || !states.length) return null;
  const last = states.length - 1;
  return {
    states,
    final: states[last],
    index,
    playing,
    play: () => {
      setIndex((i) => (i === null || i >= last ? 0 : i));
      setPlaying(true);
    },
    stepForward: () => {
      setPlaying(false);
      setIndex((i) => (i === null ? Math.min(1, last) : Math.min(i + 1, last)));
    },
    seek: (i) => {
      setPlaying(false);
      setIndex(Math.max(0, Math.min(i, last)));
    },
    backToEdit: () => {
      setPlaying(false);
      setIndex(null);
    },
  };
}
