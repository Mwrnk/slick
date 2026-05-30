import { useState, useEffect } from 'react';

type AnimationOptions = number | { intervalMs: number };

export function useAnimation(options: AnimationOptions): number {
  const [frame, setFrame] = useState(0);
  const intervalMs = typeof options === 'number'
    ? Math.round(1000 / options)
    : options.intervalMs;

  useEffect(() => {
    const id = setInterval(() => setFrame(f => f + 1), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);

  return frame;
}
