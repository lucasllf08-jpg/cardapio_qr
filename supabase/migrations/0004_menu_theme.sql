-- Novo visual padrão do cardápio do cliente (mesmo estilo do painel) + fonte Urbanist
-- Rode no Supabase: SQL Editor > New query > colar e executar

alter table establishments drop constraint if exists establishments_font_check;
alter table establishments add constraint establishments_font_check
  check (font in ('urbanist', 'inter', 'poppins', 'merriweather', 'nunito'));

-- Quem ainda usa o visual padrão antigo (nunca personalizou) recebe o novo padrão
update establishments
   set font = 'urbanist', primary_color = '#101010', secondary_color = '#f0280f'
 where primary_color = '#111827' and secondary_color = '#f59e0b' and font = 'inter';

alter table establishments alter column font set default 'urbanist';
alter table establishments alter column primary_color set default '#101010';
alter table establishments alter column secondary_color set default '#f0280f';
