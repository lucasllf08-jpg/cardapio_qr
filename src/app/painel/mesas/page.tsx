'use client';
import { useCallback, useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { supabase } from '@/lib/supabase';
import { usePanel } from '@/lib/panel';

type Table = { id: string; number: number; token: string; active: boolean };

export default function TablesPage() {
  const { est } = usePanel();
  const [tables, setTables] = useState<Table[]>([]);
  const [qrs, setQrs] = useState<Record<string, string>>({});
  const [qty, setQty] = useState('5');

  const load = useCallback(async () => {
    const { data } = await supabase.from('tables').select('*').eq('establishment_id', est.id).order('number');
    const list = (data ?? []) as Table[];
    setTables(list);
    const map: Record<string, string> = {};
    for (const t of list) {
      map[t.id] = await QRCode.toDataURL(`${window.location.origin}/c/${est.slug}?t=${t.token}`, { width: 300, margin: 1 });
    }
    setQrs(map);
  }, [est.id, est.slug]);
  useEffect(() => { load(); }, [load]);

  async function create() {
    const n = Math.min(Math.max(parseInt(qty) || 0, 1), 100);
    const start = tables.reduce((m, t) => Math.max(m, t.number), 0);
    const rows = Array.from({ length: n }, (_, i) => ({ establishment_id: est.id, number: start + i + 1 }));
    const { error } = await supabase.from('tables').insert(rows);
    if (error) alert(error.message);
    load();
  }
  async function toggle(t: Table) {
    await supabase.from('tables').update({ active: !t.active }).eq('id', t.id); load();
  }
  async function renew(t: Table) {
    if (!confirm(`Gerar novo QR para a Mesa ${t.number}? O QR impresso atual deixará de funcionar.`)) return;
    await supabase.from('tables').update({ token: crypto.randomUUID() }).eq('id', t.id); load();
  }
  async function remove(t: Table) {
    if (!confirm(`Excluir a Mesa ${t.number} e o histórico de comandas dela?`)) return;
    const { error } = await supabase.from('tables').delete().eq('id', t.id);
    if (error) alert(error.message);
    load();
  }

  return (
    <div className="space-y-4">
      <div className="no-print card flex flex-wrap items-end gap-3">
        <div className="w-32"><label className="label">Quantas mesas</label>
          <input className="input" inputMode="numeric" value={qty} onChange={(e) => setQty(e.target.value)} /></div>
        <button className="btn-dark" onClick={create}>Adicionar mesas</button>
        <button className="btn-light ml-auto" onClick={() => window.print()}>🖨 Imprimir QR Codes</button>
      </div>
      {tables.length === 0 && <p className="text-muted">Nenhuma mesa cadastrada.</p>}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {tables.map((t) => (
          <div key={t.id} className={`card text-center ${t.active ? '' : 'opacity-50'}`}>
            <p className="text-sm text-muted">{est.name}</p>
            <p className="font-display text-2xl font-semibold">Mesa {t.number}</p>
            {qrs[t.id] && <img src={qrs[t.id]} alt={`QR Mesa ${t.number}`} className="mx-auto my-3 w-full max-w-[200px] rounded-xl bg-white p-2" />}
            <p className="text-xs text-muted">Escaneie para ver o cardápio e pedir</p>
            <div className="no-print mt-2 flex flex-wrap justify-center gap-1 text-sm">
              <button className="btn-light px-2 py-1" onClick={() => toggle(t)}>{t.active ? 'Desativar' : 'Ativar'}</button>
              <button className="btn-light px-2 py-1" onClick={() => renew(t)}>Novo QR</button>
              <button className="btn-light px-2 py-1 text-red-600" onClick={() => remove(t)}>×</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
