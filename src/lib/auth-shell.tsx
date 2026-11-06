function QrArt() {
  const n = 25;
  let seed = 11;
  const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const inFinder = (x: number, y: number) => (x < 8 && y < 8) || (x >= n - 8 && y < 8) || (x < 8 && y >= n - 8);
  const cells: { x: number; y: number }[] = [];
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) if (!inFinder(x, y) && rnd() > 0.5) cells.push({ x, y });
  const finders = [[0, 0], [n - 7, 0], [0, n - 7]];
  return (
    <svg viewBox={`0 0 ${n} ${n}`} className="pointer-events-none absolute -bottom-20 -right-20 w-[34rem] opacity-[0.13]" aria-hidden>
      <g fill="#fff">
        {cells.map((c) => <rect key={`${c.x}-${c.y}`} x={c.x + 0.07} y={c.y + 0.07} width="0.86" height="0.86" rx="0.2" />)}
        {finders.map(([x, y]) => (
          <g key={`${x}-${y}`}>
            <path fillRule="evenodd" d={`M${x} ${y}h7v7h-7z M${x + 1} ${y + 1}v5h5v-5z`} />
            <rect x={x + 2} y={y + 2} width="3" height="3" rx="0.4" />
          </g>
        ))}
      </g>
    </svg>
  );
}

export function AuthShell({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <div className="pos-ui md:grid md:grid-cols-2">
      <section className="flex min-h-screen flex-col bg-surface px-6 py-8 sm:px-12">
        <div className="flex items-center gap-3 text-lg font-extrabold">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-side text-white">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M4 4h6v6H4z M14 4h6v6h-6z M4 14h6v6H4z M14 14h3v3h-3z M19 19h1" />
            </svg>
          </span>
          Cardápio Digital
        </div>
        <div className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center py-10">
          <h1 className="text-3xl">{title}</h1>
          {subtitle && <p className="mt-2 text-muted">{subtitle}</p>}
          <div className="mt-8">{children}</div>
        </div>
      </section>

      <aside
        className="relative hidden overflow-hidden md:flex md:items-center md:justify-center"
        style={{ background: 'linear-gradient(rgba(16,16,16,.72), rgba(16,16,16,.72)), url(/login-bg.jpg) center/cover, #101010' }}>
        <QrArt />
        <div className="relative z-10 max-w-md px-10 text-center text-white">
          <h2 className="text-3xl leading-tight">Cardápio digital com pedido direto da mesa</h2>
          <p className="mt-4 text-lg text-neutral-300">
            Seus clientes escaneiam o QR Code, pedem pelo celular e você acompanha tudo em tempo real.
          </p>
        </div>
      </aside>
    </div>
  );
}
