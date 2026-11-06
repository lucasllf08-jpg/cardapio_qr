let ctx: AudioContext | null = null;

export function enableSound() {
  const AC = window.AudioContext || (window as any).webkitAudioContext;
  ctx = ctx ?? new AC();
  ctx.resume();
  beep();
}

export function beep() {
  if (!ctx) return;
  const c = ctx;
  [0, 0.25, 0.5].forEach((d) => {
    const o = c.createOscillator();
    const g = c.createGain();
    o.connect(g); g.connect(c.destination);
    o.frequency.value = 880; g.gain.value = 0.3;
    o.start(c.currentTime + d); o.stop(c.currentTime + d + 0.15);
  });
}
