-- Relatórios: vendas por dia e produtos mais vendidos (somente dono)
-- Rode no Supabase: SQL Editor > New query > colar e executar

create index if not exists tabs_closed_idx on tabs (establishment_id, closed_at) where status = 'closed';

-- Vendas (comandas fechadas) por dia, incluindo dias sem venda. p_tz = fuso do navegador.
create or replace function report_sales_by_day(p_days int, p_tz text default 'America/Sao_Paulo')
returns table (day date, total_amount numeric, tabs_count bigint)
language plpgsql stable security definer set search_path = public as $$
declare
  v_est uuid := current_establishment_id();
  v_today date := (now() at time zone p_tz)::date;
  v_n int := least(greatest(p_days, 1), 90);
begin
  if v_est is null or current_role_name() <> 'owner' then raise exception 'forbidden'; end if;
  return query
    with days as (
      select generate_series((v_today - (v_n - 1))::timestamp, v_today::timestamp, interval '1 day')::date as d
    ), s as (
      select (t.closed_at at time zone p_tz)::date as d, sum(t.total) as amount, count(*) as n
      from tabs t
      where t.establishment_id = v_est and t.status = 'closed'
        and t.closed_at >= ((v_today - (v_n - 1))::timestamp at time zone p_tz)
      group by 1
    )
    select days.d, coalesce(s.amount, 0), coalesce(s.n, 0)::bigint
    from days left join s on s.d = days.d
    order by days.d;
end $$;

-- Itens mais vendidos desde p_from (pedidos cancelados não contam)
create or replace function report_top_products(p_from timestamptz, p_limit int default 8)
returns table (item_name text, qty bigint, revenue numeric)
language plpgsql stable security definer set search_path = public as $$
declare v_est uuid := current_establishment_id();
begin
  if v_est is null or current_role_name() <> 'owner' then raise exception 'forbidden'; end if;
  return query
    select oi.name, sum(oi.quantity)::bigint, sum(oi.unit_price * oi.quantity)
    from order_items oi join orders o on o.id = oi.order_id
    where oi.establishment_id = v_est and o.status <> 'cancelled' and o.created_at >= p_from
    group by oi.name
    order by 2 desc, 3 desc
    limit least(greatest(p_limit, 1), 50);
end $$;

revoke all on function report_sales_by_day, report_top_products from public;
grant execute on function report_sales_by_day, report_top_products to authenticated;
