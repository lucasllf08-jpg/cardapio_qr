const KEY = 'painel:som';
let ctx: AudioContext | null = null;
let armed = false;

export const readSoundPref = () => { try { return localStorage.getItem(KEY) === '1'; } catch { return false; } };
export const saveSoundPref = (on: boolean) => { try { localStorage.setItem(KEY, on ? '1' : '0'); } catch { /* ignora */ } };

function ensureCtx() {
  const AC = window.AudioContext || (window as any).webkitAudioContext;
  if (!AC) return null;
  ctx = ctx ?? new AC();
  return ctx;
}

// Chamar dentro de um clique/toque (o navegador só libera áudio após interação)
export function enableSound() {
  const c = ensureCtx();
  if (!c) return;
  c.resume();
  beep();
}

// Depois de recarregar a página, o som já aparece ligado e é liberado no primeiro toque
export function armOnGesture() {
  if (armed) return;
  armed = true;
  const go = () => {
    ensureCtx()?.resume();
    armed = false;
    window.removeEventListener('pointerdown', go);
    window.removeEventListener('keydown', go);
  };
  window.addEventListener('pointerdown', go);
  window.addEventListener('keydown', go);
}

export function beep() {
  const c = ctx;
  if (!c || c.state !== 'running') return;
  [0, 0.25, 0.5].forEach((d) => {
    const o = c.createOscillator();
    const g = c.createGain();
    o.connect(g); g.connect(c.destination);
    o.frequency.value = 880; g.gain.value = 0.3;
    o.start(c.currentTime + d); o.stop(c.currentTime + d + 0.15);
  });
}
