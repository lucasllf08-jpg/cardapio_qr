'use client';
import { useCallback, useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { supabase } from '@/lib/supabase';
import { usePanel } from '@/lib/panel';

type Table = { id: string; number: number; token: string; active: boolean };
type Confirm = { del: Table[]; blocked: Table[] };

const list = (ts: Table[]) => ts.map((t) => t.number).join(', ');

export default function TablesPage() {
  const { est } = usePanel();
  const [tables, setTables] = useState<Table[]>([]);
  const [qrs, setQrs] = useState<Record<string, string>>({});
  const [qty, setQty] = useState('5');

  const [selecting, setSelecting] = useState(false);
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [last, setLast] = useState<number | null>(null);
  const [confirm, setConfirm] = useState<Confirm | null>(null);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<{ t: string; ok: boolean } | null>(null);

  const load = useCallback(async () => {
    const { data } = await supabase.from('tables').select('*').eq('establishment_id', est.id).order('number');
    const rows = (data ?? []) as Table[];
    setTables(rows);
    setSel((prev) => new Set([...prev].filter((id) => rows.some((t) => t.id === id))));
    const map: Record<string, string> = {};
    for (const t of rows) {
      map[t.id] = await QRCode.toDataURL(`${window.location.origin}/c/${est.slug}?t=${t.token}`, { width: 300, margin: 1 });
    }
    setQrs(map);
  }, [est.id, est.slug]);
  useEffect(() => { load(); }, [load]);

  const exitSelect = () => { setSelecting(false); setSel(new Set()); setLast(null); };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      if (confirm) setConfirm(null); else if (selecting) exitSelect();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [confirm, selecting]);

  async function create() {
    const n = Math.min(Math.max(parseInt(qty) || 0, 1), 100);
    const start = tables.reduce((m, t) => Math.max(m, t.number), 0);
    const rows = Array.from({ length: n }, (_, i) => ({ establishment_id: est.id, number: start + i + 1 }));
    const { error } = await supabase.from('tables').insert(rows);
    if (error) alert(error.message);
    load();
  }

  // Seleção: clique marca/desmarca; Shift+clique marca o intervalo
  function toggle(i: number, shift: boolean) {
    const t = tables[i];
    setSel((prev) => {
      const n = new Set(prev);
      if (shift && last !== null) {
        const on = !prev.has(t.id);
        for (let k = Math.min(last, i); k <= Math.max(last, i); k++) on ? n.add(tables[k].id) : n.delete(tables[k].id);
      } else if (n.has(t.id)) n.delete(t.id);
      else n.add(t.id);
      return n;
    });
    setLast(i);
  }
  const allSelected = tables.length > 0 && sel.size === tables.length;
  const chosen = tables.filter((t) => sel.has(t.id));

  async function bulkActive() {
    const active = !chosen.every((t) => t.active);
    const { error } = await supabase.from('tables').update({ active }).in('id', chosen.map((t) => t.id));
    if (error) return setNote({ t: error.message, ok: false });
    setNote({ t: `${chosen.length} ${chosen.length === 1 ? 'mesa' : 'mesas'} ${active ? 'ativada' : 'desativada'}${chosen.length === 1 ? '' : 's'}.`, ok: true });
    exitSelect(); load();
  }

  async function renew(t: Table) {
    if (!confirmBox(`Gerar novo QR para a Mesa ${t.number}? O QR impresso atual deixará de funcionar.`)) return;
    await supabase.from('tables').update({ token: crypto.randomUUID() }).eq('id', t.id); load();
  }
  async function toggleOne(t: Table) {
    await supabase.from('tables').update({ active: !t.active }).eq('id', t.id); load();
  }

  // Exclusão: mesas com comanda aberta (cliente ainda não pagou) não são removidas
  async function askDelete(ts: Table[]) {
    if (!ts.length) return;
    const { data } = await supabase.from('tabs').select('table_id')
      .eq('establishment_id', est.id).eq('status', 'open').in('table_id', ts.map((t) => t.id));
    const open = new Set((data ?? []).map((r: { table_id: string }) => r.table_id));
    setConfirm({ del: ts.filter((t) => !open.has(t.id)), blocked: ts.filter((t) => open.has(t.id)) });
  }
  async function doDelete() {
    if (!confirm || !confirm.del.length) return setConfirm(null);
    setBusy(true);
    const { error } = await supabase.from('tables').delete().in('id', confirm.del.map((t) => t.id));
    setBusy(false);
    const n = confirm.del.length;
    setConfirm(null);
    if (error) return setNote({ t: error.message, ok: false });
    setNote({ t: `${n} ${n === 1 ? 'mesa excluída' : 'mesas excluídas'}.`, ok: true });
    exitSelect(); load();
  }

  return (
    <div className="space-y-4">
      <div className="no-print card flex flex-wrap items-end gap-3">
        <div className="w-32"><label className="label">Quantas mesas</label>
          <input className="input" inputMode="numeric" value={qty} onChange={(e) => setQty(e.target.value)} /></div>
        <button className="btn-dark" onClick={create}>Adicionar mesas</button>
        <div className="ml-auto flex gap-2">
          {tables.length > 0 && (
            <button className={selecting ? 'btn-dark' : 'btn-light'} onClick={() => (selecting ? exitSelect() : setSelecting(true))}>
              {selecting ? 'Concluir' : 'Selecionar'}
            </button>
          )}
          <button className="btn-light" onClick={() => window.print()}>Imprimir QR Codes</button>
        </div>
      </div>

      {note && (
        <p role="status" className={`no-print text-sm font-semibold ${note.ok ? 'text-emerald-600' : 'text-red-600'}`}>{note.t}</p>
      )}
      {selecting && <p className="no-print text-sm text-muted">Toque nas mesas para marcar. Com Shift pressionado, você marca um intervalo de uma vez.</p>}
      {tables.length === 0 && <p className="text-muted">Nenhuma mesa cadastrada.</p>}

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {tables.map((t, i) => {
          const on = sel.has(t.id);
          const body = (
            <>
              <p className="text-sm text-muted">{est.name}</p>
              <p className="text-xl font-extrabold">Mesa {t.number}</p>
              {qrs[t.id] && <img src={qrs[t.id]} alt={`QR Mesa ${t.number}`} className="mx-auto my-3 w-full max-w-[200px] rounded-xl bg-white p-2" />}
              <p className="text-xs text-muted">Escaneie para ver o cardápio e pedir</p>
              {!t.active && <p className="no-print mt-1 text-xs font-bold text-muted">Desativada</p>}
            </>
          );
          if (selecting) {
            return (
              <button key={t.id} type="button" role="checkbox" aria-checked={on} aria-label={`Mesa ${t.number}`}
                onClick={(e) => toggle(i, e.shiftKey)}
                className={`card relative text-center transition ${on ? '!border-accent ring-2 ring-accent' : 'hover:border-muted'} ${t.active ? '' : 'opacity-60'}`}>
                <span className={`absolute left-3 top-3 flex h-6 w-6 items-center justify-center rounded-md border-2 ${on ? 'border-accent bg-accent text-white' : 'border-line bg-surface'}`}>
                  {on && <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M5 12l5 5 9-10" /></svg>}
                </span>
                {body}
              </button>
            );
          }
          return (
            <div key={t.id} className={`card text-center ${t.active ? '' : 'opacity-60'}`}>
              {body}
              <div className="no-print mt-2 flex flex-wrap justify-center gap-1 text-sm">
                <button className="btn-light px-2 py-1" onClick={() => toggleOne(t)}>{t.active ? 'Desativar' : 'Ativar'}</button>
                <button className="btn-light px-2 py-1" onClick={() => renew(t)}>Novo QR</button>
                <button className="btn-light px-2 py-1 text-red-600" onClick={() => askDelete([t])} aria-label={`Excluir mesa ${t.number}`}>×</button>
              </div>
            </div>
          );
        })}
      </div>

      {selecting && (
        <div className="no-print sticky bottom-20 z-20 flex flex-wrap items-center gap-2 rounded-2xl bg-side p-3 text-white shadow-lg md:bottom-4">
          <p className="mr-auto px-2 font-bold">{sel.size === 0 ? 'Nenhuma selecionada' : `${sel.size} ${sel.size === 1 ? 'selecionada' : 'selecionadas'}`}</p>
          <button className="rounded-xl bg-white/10 px-3 py-2 text-sm font-bold" onClick={() => setSel(allSelected ? new Set() : new Set(tables.map((t) => t.id)))}>
            {allSelected ? 'Limpar seleção' : 'Selecionar todas'}
          </button>
          <button disabled={!sel.size} className="rounded-xl bg-white/10 px-3 py-2 text-sm font-bold disabled:opacity-40" onClick={bulkActive}>
            {chosen.length > 0 && chosen.every((t) => t.active) ? 'Desativar' : 'Ativar'}
          </button>
          <button disabled={!sel.size} className="rounded-xl bg-accent px-4 py-2 text-sm font-bold disabled:opacity-40" onClick={() => askDelete(chosen)}>
            Excluir{sel.size ? ` (${sel.size})` : ''}
          </button>
        </div>
      )}

      {confirm && (
        <div className="no-print fixed inset-0 z-50 flex items-end bg-black/50 md:items-center md:justify-center" onClick={() => setConfirm(null)}>
          <div role="dialog" aria-modal="true" className="w-full space-y-4 rounded-t-3xl bg-surface p-5 md:max-w-md md:rounded-3xl" onClick={(e) => e.stopPropagation()}>
            {confirm.del.length > 0 ? (
              <>
                <h3 className="text-xl">Excluir {confirm.del.length} {confirm.del.length === 1 ? 'mesa' : 'mesas'}?</h3>
                <p><span className="font-bold">{confirm.del.length === 1 ? 'Mesa' : 'Mesas'} {list(confirm.del)}</span></p>
                <p className="text-sm text-muted">Os QR Codes impressos deixam de funcionar e o histórico de comandas dessas mesas some dos relatórios. Para só tirar a mesa de uso sem perder o histórico, use Desativar.</p>
              </>
            ) : (
              <h3 className="text-xl">Nenhuma mesa pode ser excluída agora</h3>
            )}
            {confirm.blocked.length > 0 && (
              <p className="rounded-xl bg-amber-50 p-3 text-sm">
                {confirm.blocked.length === 1 ? 'A mesa' : 'As mesas'} <span className="font-bold">{list(confirm.blocked)}</span> {confirm.blocked.length === 1 ? 'tem' : 'têm'} comanda aberta (ainda não paga) e {confirm.blocked.length === 1 ? 'não será excluída' : 'não serão excluídas'}. Feche a comanda no Caixa antes.
              </p>
            )}
            <div className="flex gap-2">
              <button className="btn-light flex-1" onClick={() => setConfirm(null)}>{confirm.del.length ? 'Cancelar' : 'Entendi'}</button>
              {confirm.del.length > 0 && (
                <button className="btn-dark flex-1" disabled={busy} onClick={doDelete}>{busy ? 'Excluindo…' : 'Excluir'}</button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const confirmBox = (m: string) => window.confirm(m);
