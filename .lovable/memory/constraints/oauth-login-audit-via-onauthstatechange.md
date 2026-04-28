---
name: oauth-login-audit-via-onauthstatechange
description: Auditoria de login OAuth (Google, Apple, etc.) deve acontecer no onAuthStateChange do useAuth, nunca em código de tela
type: constraint
---

# Auditoria de login OAuth — handler centralizado

Logins por OAuth (Google e quaisquer outros providers) só completam **depois do redirect**, no evento `SIGNED_IN` do `supabase.auth.onAuthStateChange`. A tela que dispara `signInWithOAuth` não tem como saber se deu certo.

**Regra:** O registro em `auth_login_attempts` para OAuth acontece **exclusivamente** no `onAuthStateChange` dentro de `src/hooks/useAuth.tsx`, com filtro:

```ts
if (event === 'SIGNED_IN' && newSession?.user) {
  const provider = (newSession.user.app_metadata as any)?.provider;
  if (provider && provider !== 'email') {
    supabase.functions.invoke('log-login-attempt', { body: { ... success: true ... } }).catch(() => {});
  }
}
```

**Why:** Caso real Onda 5 F1 — `auth_login_attempts` registrava só e-mail/senha porque o OAuth era disparado direto da tela `/auth` (`lovable.auth.signInWithOAuth`) sem passar por `useAuth.signInWithGoogle`. Logins Google ficaram invisíveis para auditoria por ~2 meses.

**How to apply:**
- **Proibido** adicionar log de login OAuth em código de tela. Sempre no `useAuth`, fonte única.
- Filtro `provider !== 'email'` é mandatório — login por e-mail/senha já é logado em `signIn()` (caminho separado), incluir `email` causaria duplicidade.
- Qualquer novo provider OAuth (Apple, Facebook, GitHub, etc.) **já fica auditado automaticamente** sem alterar nenhuma tela.
- Fire-and-forget obrigatório: nunca bloquear o login se a auditoria falhar.
