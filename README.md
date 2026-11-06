# Cardápio QR

Cardápio digital por QR Code com pedidos por mesa, comanda paga no caixa e painel em tempo real.

## Como rodar
1. `npm install`
2. Crie um projeto no Supabase e execute `supabase/migrations/0001_init.sql` no SQL Editor.
3. Copie `.env.example` para `.env.local` e preencha URL e chave anon.
4. `npm run dev` e abra http://localhost:3000
5. Em `/login`, crie a conta e o estabelecimento (você vira dono). Depois: Cardápio → Mesas e QR → Aparência.

## Rotas
- `/c/[slug]?t=TOKEN` cardápio do cliente (o token vem no QR da mesa)
- `/painel` pedidos e chamados · `/painel/caixa` · `/painel/cardapio` · `/painel/mesas` · `/painel/aparencia`

## Observações
- Em Supabase > Authentication, desative "Confirm email" para testar rápido.
- Garçom e caixa: crie o usuário em Authentication e insira em `profiles` (id, establishment_id, role = 'waiter' | 'cashier'). Uma tela para isso é a próxima etapa.
- Deploy: importar o repositório na Vercel e cadastrar as duas variáveis de ambiente.
