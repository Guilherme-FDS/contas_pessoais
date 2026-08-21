# Guia de configuração — Finanças da Família

Siga esses passos na ordem. Nenhum deles precisa de código, só cliques nos painéis do Supabase, GitHub e Vercel.

## 1. Criar o projeto no Supabase

1. Acesse [supabase.com](https://supabase.com) e crie uma conta (ou faça login).
2. Clique em **New Project**. Escolha um nome (ex: `financas-familia`), uma senha forte para o banco (guarde essa senha) e a região mais próxima (ex: São Paulo).
3. Aguarde o projeto ser provisionado (leva 1-2 minutos).

## 2. Rodar o schema do banco

1. No painel do projeto, vá em **SQL Editor** (menu lateral) > **New query**.
2. Abra o arquivo [`supabase/migrations/0001_init.sql`](supabase/migrations/0001_init.sql) deste projeto, copie todo o conteúdo e cole no editor.
3. Clique em **Run**. Isso cria as 4 tabelas (`contas_fixas`, `contas_variaveis`, `contas_futuras`, `investimentos`) já com as permissões corretas.

## 3. Criar os 2 usuários (você e sua esposa)

1. No painel, vá em **Authentication** > **Users**.
2. Clique em **Add user** > **Create new user**.
3. Preencha o e-mail e uma senha para você. Repita para a sua esposa.
4. Não existe cadastro público no app — só vocês dois conseguem entrar, com essas credenciais.

## 4. Pegar as chaves da API

1. Vá em **Project Settings** (ícone de engrenagem) > **API**.
2. Copie o **Project URL** e a chave **anon public**.
3. Na raiz deste projeto, copie o arquivo `.env.local.example` para `.env.local`:

   ```bash
   cp .env.local.example .env.local
   ```

4. Abra `.env.local` e cole os valores:

   ```
   NEXT_PUBLIC_SUPABASE_URL=https://SEU-PROJETO.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=sua-anon-key-aqui
   ```

## 5. Testar localmente

```bash
npm install
npm run dev
```

Acesse `http://localhost:3000`, entre com o login que você criou no passo 3, e teste adicionar um item em cada aba (Contas Fixas, Variáveis, Futuras, Investimentos).

## 6. Subir para o GitHub

```bash
git init
git add .
git commit -m "Primeira versão do app de finanças"
```

Crie um repositório novo no GitHub (pode ser privado — recomendado, já que é um app financeiro) e siga as instruções para conectar e dar push (`git remote add origin ...` e `git push`).

## 7. Deploy na Vercel

1. Acesse [vercel.com](https://vercel.com) e faça login com sua conta do GitHub.
2. Clique em **Add New** > **Project** e selecione o repositório que você acabou de criar.
3. Na tela de configuração, abra **Environment Variables** e adicione as mesmas duas variáveis do `.env.local`:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
4. Clique em **Deploy**.
5. Depois do primeiro deploy, todo `git push` na branch principal gera um novo deploy automático — igual ao fluxo que você já usava no Render.

## 8. Instalar como app no celular (PWA)

1. Acesse a URL da Vercel pelo navegador do celular (Chrome no Android, Safari no iPhone).
2. Android: toque no menu (⋮) > **Adicionar à tela inicial**.
3. iPhone: toque em Compartilhar > **Adicionar à Tela de Início**.

Os ícones enviados são placeholders (verde, com "F$"). Para trocar, basta substituir os arquivos `public/icons/icon-192.png` e `public/icons/icon-512.png` por imagens quadradas suas e fazer um novo commit/push.

## Observações importantes

- **Login individual, dados compartilhados**: qualquer um dos dois usuários vê e edita todos os dados — não há separação por pessoa.
- **Sem cadastro público**: se no futuro quiser adicionar mais alguém, crie o usuário manualmente pelo painel do Supabase (passo 3).
- **Backup**: o Supabase free tier já mantém backups automáticos recentes, mas para um app financeiro vale considerar exportar os dados periodicamente (Table Editor > Export CSV) se quiser um histórico próprio.
