-- Cardápio Digital QR - migração inicial
-- Rode no Supabase: SQL Editor > New query > colar e executar

create extension if not exists pgcrypto;

-- ========== TABELAS ==========

create table establishments (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique check (slug ~ '^[a-z0-9-]+$'),
  logo_url text,
  cover_url text,
  primary_color text not null default '#111827',
  secondary_color text not null default '#f59e0b',
  font text not null default 'inter' check (font in ('inter','poppins','merriweather','nunito')),
  card_style text not null default 'list' check (card_style in ('list','grid')),
  description text,
  opening_hours text,
  address text,
  instagram text,
  whatsapp text,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  establishment_id uuid not null references establishments(id) on delete cascade,
  name text,
  role text not null check (role in ('owner','waiter','cashier')),
  created_at timestamptz not null default now()
);

create table tables (
  id uuid primary key default gen_random_uuid(),
  establishment_id uuid not null references establishments(id) on delete cascade,
  number int not null,
  token uuid not null unique default gen_random_uuid(),
  active boolean not null default true,
  unique (establishment_id, number)
);

create table categories (
  id uuid primary key default gen_random_uuid(),
  establishment_id uuid not null references establishments(id) on delete cascade,
  name text not null,
  position int not null default 0
);

create table products (
  id uuid primary key default gen_random_uuid(),
  establishment_id uuid not null references establishments(id) on delete cascade,
  category_id uuid not null references categories(id) on delete cascade,
  name text not null,
  description text,
  price numeric(10,2) not null check (price >= 0),
  photo_url text,
  available boolean not null default true,
  position int not null default 0
);

create table product_addons (
  id uuid primary key default gen_random_uuid(),
  establishment_id uuid not null references establishments(id) on delete cascade,
  product_id uuid not null references products(id) on delete cascade,
  name text not null,
  price numeric(10,2) not null default 0 check (price >= 0),
  available boolean not null default true
);

create table tabs (
  id uuid primary key default gen_random_uuid(),
  establishment_id uuid not null references establishments(id) on delete cascade,
  table_id uuid not null references tables(id) on delete cascade,
  status text not null default 'open' check (status in ('open','closed')),
  opened_at timestamptz not null default now(),
  closed_at timestamptz,
  closed_by uuid references profiles(id),
  total numeric(10,2)
);
-- Apenas uma comanda aberta por mesa
create unique index one_open_tab_per_table on tabs(table_id) where status = 'open';

create table orders (
  id uuid primary key default gen_random_uuid(),
  establishment_id uuid not null references establishments(id) on delete cascade,
  tab_id uuid not null references tabs(id) on delete cascade,
  status text not null default 'new' check (status in ('new','preparing','delivered','cancelled')),
  note text,
  created_at timestamptz not null default now()
);

create table order_items (
  id uuid primary key default gen_random_uuid(),
  establishment_id uuid not null references establishments(id) on delete cascade,
  order_id uuid not null references orders(id) on delete cascade,
  product_id uuid references products(id) on delete set null,
  name text not null,                       -- snapshot
  unit_price numeric(10,2) not null,        -- snapshot (já com adicionais)
  quantity int not null check (quantity > 0),
  note text,
  addons jsonb not null default '[]'
);

create table service_calls (
  id uuid primary key default gen_random_uuid(),
  establishment_id uuid not null references establishments(id) on delete cascade,
  table_id uuid not null references tables(id) on delete cascade,
  tab_id uuid references tabs(id) on delete set null,
  type text not null check (type in ('waiter','bill')),
  status text not null default 'pending' check (status in ('pending','done')),
  created_at timestamptz not null default now()
);

create index on products(establishment_id, category_id);
create index on orders(establishment_id, created_at desc);
create index on tabs(establishment_id, status);
create index on service_calls(establishment_id, status);

-- ========== SEGURANÇA (RLS) ==========

create or replace function current_establishment_id()
returns uuid language sql stable security definer set search_path = public as $$
  select establishment_id from profiles where id = auth.uid()
$$;

create or replace function current_role_name()
returns text language sql stable security definer set search_path = public as $$
  select role from profiles where id = auth.uid()
$$;

alter table establishments  enable row level security;
alter table profiles        enable row level security;
alter table tables          enable row level security;
alter table categories      enable row level security;
alter table products        enable row level security;
alter table product_addons  enable row level security;
alter table tabs            enable row level security;
alter table orders          enable row level security;
alter table order_items     enable row level security;
alter table service_calls   enable row level security;

-- Leitura pública do cardápio
create policy "public read establishments" on establishments for select using (active);
create policy "public read categories" on categories for select using (true);
create policy "public read products" on products for select using (available);
create policy "public read addons" on product_addons for select using (available);

-- Equipe: acesso total ao próprio estabelecimento
create policy "staff establishments" on establishments for update
  using (id = current_establishment_id() and current_role_name() = 'owner')
  with check (id = current_establishment_id());

create policy "staff profiles read" on profiles for select
  using (establishment_id = current_establishment_id());

create policy "staff tables" on tables for all
  using (establishment_id = current_establishment_id())
  with check (establishment_id = current_establishment_id());

create policy "staff categories" on categories for all
  using (establishment_id = current_establishment_id())
  with check (establishment_id = current_establishment_id());

create policy "staff products" on products for all
  using (establishment_id = current_establishment_id())
  with check (establishment_id = current_establishment_id());

create policy "staff addons" on product_addons for all
  using (establishment_id = current_establishment_id())
  with check (establishment_id = current_establishment_id());

create policy "staff tabs" on tabs for select
  using (establishment_id = current_establishment_id());

create policy "staff orders read" on orders for select
  using (establishment_id = current_establishment_id());
create policy "staff orders update" on orders for update
  using (establishment_id = current_establishment_id())
  with check (establishment_id = current_establishment_id());

create policy "staff order_items" on order_items for select
  using (establishment_id = current_establishment_id());

create policy "staff service_calls read" on service_calls for select
  using (establishment_id = current_establishment_id());
create policy "staff service_calls update" on service_calls for update
  using (establishment_id = current_establishment_id())
  with check (establishment_id = current_establishment_id());

-- Clientes não gravam direto: só pelas funções abaixo.

-- ========== FUNÇÕES ==========

-- Cliente: busca a mesa pelo token (para exibir "Mesa X" e o estabelecimento)
create or replace function get_table_by_token(p_token uuid)
returns table (table_id uuid, number int, establishment_id uuid, slug text)
language sql security definer set search_path = public as $$
  select t.id, t.number, t.establishment_id, e.slug
  from tables t join establishments e on e.id = t.establishment_id
  where t.token = p_token and t.active and e.active
$$;

-- Cliente: envia pedido. p_items = [{"product_id": "...", "quantity": 2, "note": "", "addon_ids": ["..."]}]
create or replace function place_order(p_token uuid, p_items jsonb, p_note text default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_table tables%rowtype;
  v_tab_id uuid;
  v_order_id uuid;
  v_item jsonb;
  v_prod products%rowtype;
  v_qty int;
  v_addons jsonb;
  v_addons_total numeric;
begin
  select * into v_table from tables where token = p_token and active;
  if not found then raise exception 'invalid_table_token'; end if;

  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'empty_order';
  end if;
  if jsonb_array_length(p_items) > 50 then raise exception 'too_many_items'; end if;

  -- comanda aberta (cria se não existir)
  insert into tabs (establishment_id, table_id) values (v_table.establishment_id, v_table.id)
    on conflict (table_id) where status = 'open' do nothing;
  select id into v_tab_id from tabs where table_id = v_table.id and status = 'open';

  insert into orders (establishment_id, tab_id, note)
    values (v_table.establishment_id, v_tab_id, left(p_note, 300))
    returning id into v_order_id;

  for v_item in select * from jsonb_array_elements(p_items) loop
    v_qty := coalesce((v_item->>'quantity')::int, 0);
    if v_qty < 1 or v_qty > 99 then raise exception 'invalid_quantity'; end if;

    select * into v_prod from products
      where id = (v_item->>'product_id')::uuid
        and establishment_id = v_table.establishment_id
        and available;
    if not found then raise exception 'product_unavailable'; end if;

    select coalesce(jsonb_agg(jsonb_build_object('id', a.id, 'name', a.name, 'price', a.price)), '[]'::jsonb),
           coalesce(sum(a.price), 0)
      into v_addons, v_addons_total
      from product_addons a
      where a.product_id = v_prod.id and a.available
        and a.id in (select (x)::uuid from jsonb_array_elements_text(coalesce(v_item->'addon_ids', '[]'::jsonb)) x);

    insert into order_items (establishment_id, order_id, product_id, name, unit_price, quantity, note, addons)
      values (v_table.establishment_id, v_order_id, v_prod.id, v_prod.name,
              v_prod.price + v_addons_total, v_qty, left(v_item->>'note', 200), v_addons);
  end loop;

  return v_order_id;
end $$;

-- Cliente: chamar garçom / pedir a conta
create or replace function call_service(p_token uuid, p_type text)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_table tables%rowtype;
  v_tab_id uuid;
  v_id uuid;
begin
  if p_type not in ('waiter','bill') then raise exception 'invalid_type'; end if;
  select * into v_table from tables where token = p_token and active;
  if not found then raise exception 'invalid_table_token'; end if;

  -- evita spam: já existe chamado pendente do mesmo tipo
  select id into v_id from service_calls
    where table_id = v_table.id and type = p_type and status = 'pending';
  if found then return v_id; end if;

  select id into v_tab_id from tabs where table_id = v_table.id and status = 'open';

  insert into service_calls (establishment_id, table_id, tab_id, type)
    values (v_table.establishment_id, v_table.id, v_tab_id, p_type)
    returning id into v_id;
  return v_id;
end $$;

-- Equipe: total atual de uma comanda (ignora itens cancelados)
create or replace function tab_total(p_tab_id uuid)
returns numeric language sql stable security definer set search_path = public as $$
  select coalesce(sum(oi.unit_price * oi.quantity), 0)
  from order_items oi join orders o on o.id = oi.order_id
  join tabs t on t.id = o.tab_id
  where t.id = p_tab_id and o.status <> 'cancelled'
    and t.establishment_id = current_establishment_id()
$$;

-- Caixa/dono: fecha a comanda
create or replace function close_tab(p_tab_id uuid)
returns numeric language plpgsql security definer set search_path = public as $$
declare v_total numeric;
begin
  if current_role_name() not in ('owner','cashier') then raise exception 'forbidden'; end if;
  if not exists (select 1 from tabs where id = p_tab_id and status = 'open'
                 and establishment_id = current_establishment_id()) then
    raise exception 'tab_not_found';
  end if;
  v_total := tab_total(p_tab_id);
  update tabs set status = 'closed', closed_at = now(), closed_by = auth.uid(), total = v_total
    where id = p_tab_id;
  update service_calls set status = 'done' where tab_id = p_tab_id and status = 'pending';
  return v_total;
end $$;

-- Cadastro: usuário logado cria o estabelecimento e vira dono
create or replace function create_establishment(p_name text, p_slug text)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  if auth.uid() is null then raise exception 'not_authenticated'; end if;
  if exists (select 1 from profiles where id = auth.uid()) then raise exception 'already_has_establishment'; end if;
  insert into establishments (name, slug) values (p_name, lower(p_slug)) returning id into v_id;
  insert into profiles (id, establishment_id, role) values (auth.uid(), v_id, 'owner');
  return v_id;
end $$;

-- Permissões das funções
revoke all on function place_order, call_service, get_table_by_token, tab_total, close_tab, create_establishment from public;
grant execute on function place_order, call_service, get_table_by_token to anon, authenticated;
grant execute on function tab_total, close_tab, create_establishment to authenticated;

-- ========== TEMPO REAL ==========
alter publication supabase_realtime add table orders, service_calls;

-- ========== STORAGE (fotos) ==========
insert into storage.buckets (id, name, public) values ('media', 'media', true)
  on conflict do nothing;
create policy "public read media" on storage.objects for select using (bucket_id = 'media');
create policy "staff upload media" on storage.objects for insert to authenticated
  with check (bucket_id = 'media' and (storage.foldername(name))[1] = current_establishment_id()::text);
create policy "staff update media" on storage.objects for update to authenticated
  using (bucket_id = 'media' and (storage.foldername(name))[1] = current_establishment_id()::text);
create policy "staff delete media" on storage.objects for delete to authenticated
  using (bucket_id = 'media' and (storage.foldername(name))[1] = current_establishment_id()::text);
