export function Switch({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button type="button" role="switch" aria-checked={checked} onClick={() => onChange(!checked)}
      className="flex items-center gap-3 rounded-full py-1 text-left">
      <span className={`relative inline-flex h-8 w-14 shrink-0 items-center rounded-full transition-colors ${checked ? 'bg-accent' : 'bg-neutral-300'}`}>
        <span className={`inline-block h-6 w-6 transform rounded-full bg-white shadow transition-transform ${checked ? 'translate-x-7' : 'translate-x-1'}`} />
      </span>
      <span className="text-sm font-bold">
        {label} <span className="font-normal text-muted">· {checked ? 'Ligado' : 'Desligado'}</span>
      </span>
    </button>
  );
}
