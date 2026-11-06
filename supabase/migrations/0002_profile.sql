-- Perfil do usuário: foto de perfil e atualização segura dos próprios dados
-- Rode no Supabase: SQL Editor > New query > colar e executar

alter table profiles add column if not exists avatar_url text;

-- O usuário só altera nome e foto. Perfil (cargo) e estabelecimento não podem ser mudados por aqui.
create or replace function update_my_profile(p_name text, p_avatar_url text)
returns void language sql security definer set search_path = public as $$
  update profiles
     set name = nullif(left(trim(p_name), 80), ''),
         avatar_url = p_avatar_url
   where id = auth.uid()
$$;

revoke all on function update_my_profile from public;
grant execute on function update_my_profile to authenticated;
