---
name: Login Audit and Optional MFA
description: Onda 5 — auth_login_attempts table populated by log-login-attempt edge function (fire-and-forget), MFA opcional via banner em /platform/* usando supabase.auth.mfa nativo
type: feature
---

# Onda 5 — Auditoria de Login + MFA Opcional

## Frente 1 — Auditoria de Login
- Tabela `public.auth_login_attempts` (email, ip, user_agent, success, failure_reason, user_id, attempted_at)
- RLS: SELECT só para `is_platform_super_admin()` (helper SECURITY DEFINER)
- INSERT exclusivo via service_role (sem policy de insert para anon/authenticated)
- Edge function `log-login-attempt` (verify_jwt=false): captura IP de cf-connecting-ip / x-forwarded-for, sanitiza email/UA/reason
- Frontend: `useAuth.signIn` e `signInWithGoogle` chamam `logLoginAttempt` em fire-and-forget após signInWithPassword/OAuth. NUNCA bloqueia o login se a auditoria falhar.

## Frente 3 — MFA Opcional com Banner
- Componente `MFAEnrollmentBanner` injetado no AppShell, auto-esconde fora de `/platform/*`
- Usa `supabase.auth.mfa.listFactors/enroll/challenge/verify` nativo (TOTP)
- Banner dispensável por 24h via localStorage (`mfa_banner_dismissed_until`)
- Não bloqueia login — pura recomendação. Para tornar obrigatório no futuro, adicionar guard em PlatformAdminGate verificando AAL2.

## Anti-regressão
- Toda alteração em login (useAuth, OAuth, novos métodos) DEVE chamar `logLoginAttempt`
- Helper `is_platform_super_admin()` deve ser usado em todas as policies de leitura de tabelas de auditoria de plataforma
- Para endurecer (MFA obrigatório, OTP curto, rate-limit) ver Onda 5 frentes 2 e 4 (pausadas em 28/04/2026)
