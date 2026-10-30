# Treino

App pessoal de registro de treinos (PWA), feito para instalar no iPhone pela tela de início.

- Treinos com séries, carga, repetições, RPE, aquecimento / drop set / falha e supersets
- Coluna "Anterior" com o que você fez da última vez
- Marcação de série válida na rotina: as não válidas não contam em volume, séries e recordes
- Rotinas, biblioteca de ~120 exercícios + exercícios personalizados
- Recordes (1RM estimado, maior carga, melhor série), gráficos por exercício
- Peso perguntado ao iniciar cada treino → gráfico de peso corporal e medidas
- Calendário, volume semanal e séries por músculo
- Funciona offline; sincroniza com o Supabase quando há internet; backup em JSON

## Rodar no computador

```bash
npm install
npm run dev      # http://localhost:5173
npm test
```

Sem `.env` o app funciona só localmente (sem login e sem nuvem).

## 1. Criar o banco (Supabase, grátis)

1. Crie uma conta em https://supabase.com e um projeto novo (região São Paulo).
2. **SQL Editor → New query** → cole o conteúdo de `supabase/schema.sql` → **Run**.
3. **Authentication → Sign In / Providers → Email**: desligue *Confirm email* (assim a conta já entra direto).
4. **Project Settings → API**: copie *Project URL* e a chave *anon public*.
5. Copie `.env.example` para `.env` e cole os dois valores.

Depois de criar sua conta no app, volte em **Authentication → Sign In / Providers** e desligue
*Allow new users to sign up*, para ninguém mais conseguir criar conta.

> A chave *anon* é pública por natureza: quem protege os dados são as regras de
> acesso (RLS) do `schema.sql`, que só deixam cada usuário ver as próprias linhas.

## 2. Publicar (GitHub Pages, grátis)

1. Crie um repositório no GitHub e envie este projeto.
2. **Settings → Secrets and variables → Actions**: crie os secrets
   `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY`.
3. **Settings → Pages → Source: GitHub Actions**.
4. Cada push na branch `main` publica em `https://<usuario>.github.io/<repositorio>/`.

## 3. Instalar no iPhone

1. Abra o endereço no **Safari**.
2. Toque em **Compartilhar → Adicionar à Tela de Início**.
3. Abra pelo ícone e entre com seu e-mail e senha.

Atualizações aparecem sozinhas na próxima vez que o app for aberto com internet.

O app instalado tem armazenamento separado do Safari: o login é feito dentro do app.
