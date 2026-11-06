export function Avatar({ url, name, size = 40 }: { url?: string | null; name?: string | null; size?: number }) {
  const box = { width: size, height: size };
  if (url) return <img src={url} alt="" style={box} className="shrink-0 rounded-full object-cover" />;
  return (
    <span style={{ ...box, fontSize: size * 0.42 }}
      className="flex shrink-0 items-center justify-center rounded-full bg-accent font-bold text-white">
      {(name || '?').trim().slice(0, 1).toUpperCase()}
    </span>
  );
}
