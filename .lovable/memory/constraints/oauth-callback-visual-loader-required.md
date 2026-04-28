---
name: oauth-callback-visual-loader-required
description: Login OAuth (Google/Apple/etc.) deve usar useAuth como fonte única + bandeira oauth_in_progress + gate combinado nos receptores
type: constraint
---

# OAuth — Loader visual obrigatório no callback (anti-flicker)

Após callback OAuth (Google e qualquer outro provider), a tela receptora (`/auth`, rotas protegidas, etc.) **não pode renderizar conteúdo normal** entre o retorno do provider e o redirect final pós-bootstrap. Isso causa flash da tela de login vazia (~1-2s).

## Contrato obrigatório

1. **Fonte única em `useAuth`**: toda chamada OAuth passa por `useAuth.signInWithGoogle(intent)` (ou método análogo). **Proibido** chamar `lovable.auth.signInWithOAuth` direto em código de tela.
2. **Bandeira estável `oauth_in_progress`**: `localStorage` com timestamp + timeout de 60s (anti-abandono). Setada **antes** do redirect, dentro do `useAuth`. Limpa em **todos** os pontos de conclusão do bootstrap (sucesso, erro, sem sessão) e em `signOut`.
3. **Gate combinado nos receptores**: `Auth.tsx` e `ProtectedRoute.tsx` usam `(latch desligado) OR isOAuthInProgress()` para mostrar o spinner. Latches anti-remontagem (Google Tradutor) não podem atropelar OAuth em curso.

## Why

Caso real 2026-04-28 (`respeiteohomem`): usuário viu tela de login piscando após login Google. Causa: latch `auth_page_rendered` desligava o spinner antes do `loadUserData` terminar. Solução aplicou padrões já consolidados da base técnica (§4.5 lado emissor+receptor; §10.6 estado estável fora do render).

## How to apply

- Helpers exportados de `src/hooks/useAuth.tsx`: `markOAuthInProgress`, `clearOAuthInProgress`, `isOAuthInProgress`.
- Adicionar novo provider: criar `signInWithApple`/etc. no mesmo hook reaproveitando os 3 helpers. Nunca duplicar.
- Toda nova rota receptora de OAuth deve incluir `|| isOAuthInProgress()` no gate de loader inicial.
- Doc oficial: `docs/tecnico/base-de-conhecimento-tecnico.md` — seção "2026-04-28 — Auth: flicker da tela de login no callback OAuth Google".
- Spec funcional: `docs/especificacoes/sistema/usuarios-permissoes.md` — seção "Fluxo de Login Google — contrato visual".
