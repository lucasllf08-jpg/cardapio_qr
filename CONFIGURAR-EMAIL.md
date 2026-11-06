# Configurar e-mails do sistema (confirmação de cadastro e recuperação de senha)

## Por que é necessário
O e-mail padrão do Supabase só entrega para membros da sua equipe e serve apenas para testes.
Para clientes reais receberem os e-mails, é preciso um SMTP próprio. Por isso vale criar um e-mail para o sistema.

## 1. Criar o e-mail do sistema (Gmail, o caminho mais simples)
1. Crie uma conta Gmail só para o sistema (ex.: nomedoprojeto.sistema@gmail.com).
2. Ative a **verificação em duas etapas** (Conta Google > Segurança).
3. Em Conta Google > Segurança > **Senhas de app**, gere uma senha para "Supabase". Ela tem 16 letras. Guarde.

Limite do Gmail: cerca de 500 e-mails por dia, suficiente para começar.
Quando crescer, o ideal é um domínio próprio com um serviço como Brevo ou Resend.

## 2. Ligar o SMTP no Supabase
Authentication > Emails > SMTP Settings > **Enable custom SMTP**:
- Sender email: o Gmail criado
- Sender name: Cardápio Digital (ou o nome do projeto)
- Host: smtp.gmail.com
- Port: 465
- Username: o Gmail completo
- Password: a senha de app (16 letras, sem espaços)
Salve. Se algo estiver errado, o Supabase avisa na hora.

## 3. Exigir confirmação de e-mail no cadastro
Authentication > Sign In / Providers > Email > ligue **Confirm email** e salve.

## 4. Endereços permitidos
Authentication > URL Configuration:
- Site URL: https://SEU-SITE.vercel.app
- Redirect URLs (adicione os dois):
  - https://SEU-SITE.vercel.app/**
  - http://localhost:3000/**

## 5. E-mails em português (opcional, recomendado)
Authentication > Emails > Templates (só libera depois de ligar o SMTP):
- **Confirm sign up**: assunto "Confirme seu e-mail", corpo = conteúdo de supabase/email-templates/confirmar-cadastro.html
- **Reset password**: assunto "Crie uma nova senha", corpo = conteúdo de supabase/email-templates/redefinir-senha.html

## 6. Limite de envios
Authentication > Rate Limits: ajuste o limite de e-mails por hora se esperar muitos cadastros.

## 7. Testar
1. Crie uma conta com um e-mail que NÃO é seu da equipe: deve chegar o link de confirmação.
2. Clique no link: você volta ao sistema e vai para o cadastro do estabelecimento.
3. Saia, clique em "Esqueci minha senha", receba o link e defina uma nova senha.

## Problemas comuns
- "Email address not authorized": o SMTP próprio não está ativo.
- Não chega: veja o spam e confirme usuário e senha de app no SMTP Settings.
- O link abre localhost: o Site URL está errado.
- "Link inválido ou expirado": o link já foi usado ou passou do prazo. Peça outro.
