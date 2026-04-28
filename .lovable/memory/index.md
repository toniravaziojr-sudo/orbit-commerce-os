# Project Memory

A memória deste projeto contém apenas:
1. **Lembretes de comportamento da IA** (governança).
2. **Cache rotativo dos 2 últimos assuntos tratados** (atual + anterior).

Regras de sistema, arquitetura, fluxos e especificações ficam exclusivamente nos docs (`docs/`). Toda regra técnica que aparecer na memória DEVE existir também nos docs formais — memória sem doc é proibida.

## Core (sempre aplicado)

1. **Seguir o Knowledge à risca** — Checklist de conformidade obrigatório em toda análise/correção/implementação.
2. **Comunicação simples e não técnica** — Linguagem de negócio em PT-BR. Detalhes técnicos só em bloco separado quando o usuário pedir.
3. **Documentar tudo nos docs** — Toda nova implementação/atualização vai para `docs/REGRAS-DO-SISTEMA.md`, `docs/especificacoes/`, `docs/especificacoes/transversais/mapa-ui.md`, `docs/tecnico/base-de-conhecimento-tecnico.md`. Memória NÃO é doc.
4. **Validação técnica obrigatória ao final** — Toda entrega termina com bloco `🔍 VALIDAÇÃO TÉCNICA EXECUTADA`.
5. **Testar no tenant `respeiteohomem` sempre que possível** — Ambiente de homologação informal.
6. **Ler os docs ANTES de propor** — Memória/contexto não substituem docs. Sempre ler Layer 2/3/4 do tema antes de propor ajuste ou ação.
7. **Memória limitada a governança + 2 últimos assuntos** — Rotação obrigatória; nunca guardar regra de sistema que não esteja nos docs.

## Memories
- [Observability Over Automation Rule](mem://constraints/observability-over-automation-rule) — Onda 2: fluxos sensíveis (WhatsApp inbound, pagamentos) priorizam visibilidade + ação manual em vez de reprocessamento automático
- [Platform Admin Auth + Observability RPC Standard](mem://constraints/platform-admin-auth-and-observability-rpc-standard) — Hook unificado via is_platform_admin(), RPCs de observabilidade em passe único, normalização de erro PostgREST, KPI "Indisponível" em vez de 0
- [WhatsApp Diagnóstico respeiteohomem](mem://constraints/whatsapp-respeiteohomem-connection-over-meta) — Não voltar a priorizar Meta/display name sem evidência nova; investigar conexão/pipeline primeiro
- [SECURITY DEFINER EXECUTE Revoke Default](mem://constraints/security-definer-execute-revoke-default) — Onda 4.1: ALTER DEFAULT PRIVILEGES travado, novas funções nascem privadas. Helpers RLS + get_public_marketing_config são exceções declaradas. Pattern 6 não substitui revogação de EXECUTE.
- [RLS Write Policy Permissive Prohibition](mem://constraints/rls-write-policy-permissive-prohibition) — Onda 4.2: Policies de escrita não podem ter USING/WITH CHECK true sem service_role ou validação de tenant/parent. Nome de policy deve refletir role real. INSERT em user_roles nunca pode ser self-assignment.
- [Storage Public Bucket Listing Prohibition](mem://constraints/storage-public-bucket-listing-prohibition) — Onda 4.3: Buckets públicos do Storage proibidos de ter SELECT amplo. URL pública não passa por RLS, mas LIST sim. Policy SELECT deve ser tenant-scoped via foldername ou restrita a service_role. COMMENT em storage.objects falha com 42501.
- [Security Linter Accepted Exceptions](mem://constraints/security-linter-accepted-exceptions) — Onda 4.4 (encerrada): 42 alertas restantes do linter são exceções arquiteturais conscientes (helpers RLS anon, RPCs com Tenant Identity Guard, pg_net em public, falso-positivo de extensão). HIBP ativado. NÃO tentar revogar sem consultar a whitelist.
- [Login Audit and Optional MFA](mem://auth/login-audit-and-mfa-optional-standard) — Onda 5: tabela auth_login_attempts populada por edge function log-login-attempt (fire-and-forget). Banner MFA opcional em /platform/* via supabase.auth.mfa nativo (TOTP). Toda alteração em login deve chamar logLoginAttempt.

- [Working Rules](mem://governance/working-rules) — Os 5 lembretes detalhados de comportamento
- [Documentation Governance](mem://governance/documentation-governance) — Regra de Ouro e hierarquia de 6 camadas de docs
- [Memory Protection Rules](mem://governance/memory-protection-rules) — Política de memória, escopo permitido e regras de rotação
- [Recent Topics](mem://governance/recent-topics) — Cache rotativo dos 2 últimos assuntos tratados (atual + anterior)
- [Working Rules](mem://governance/working-rules) — Os 5 lembretes detalhados de comportamento
- [WhatsApp Meta Recovery Protocol](mem://constraints/whatsapp-meta-recovery-protocol) — 4 verificações (token/número/WABA/webhook) + diagnose/recover/monitor + cron diário
- [WhatsApp Meta Webhook Fields Mandatory](mem://constraints/whatsapp-meta-webhook-fields-mandatory) — POST subscribed_apps SEMPRE com subscribed_fields. Sem isso recebimento quebra silenciosamente pós produção.
- [WhatsApp Meta Webhook Troubleshooting Runbook](mem://infrastructure/whatsapp-meta-webhook-troubleshooting-runbook) — Runbook de 6 camadas para diagnóstico "envio ok / recebimento não chega". Lista hipóteses já descartadas e aponta recipient allowlist como causa raiz mais comum pós teste→produção.
- [Meta WhatsApp Webhook Real Config Source of Truth](mem://constraints/meta-whatsapp-webhook-real-config-source-of-truth) — Token verify real fica em platform_credentials.META_WEBHOOK_VERIFY_TOKEN. URL/token/campo `messages` ficam em developers.facebook.com (não business.facebook.com). NUNCA inventar token. Diagnóstico inicial = checar logs do meta-whatsapp-webhook.
- [Order Creation After Gateway Only](mem://constraints/order-creation-after-gateway-only) — Pedido só pode ser criado após resposta do gateway. checkout-create-order rejeita sem payment_gateway_id. Vale para todos os provedores.
- [WhatsApp Cross-Business Administrative Binding](mem://constraints/whatsapp-cross-business-administrative-binding) — Subscribe técnico não comprova roteamento real; recepção real exige vínculo cross-business manual no painel Meta. Modelo oficial híbrido. Validação canônica = mensagem real + auditoria bruta.
- [WhatsApp Inbound Pipeline Anti-Silent v2](mem://constraints/whatsapp-inbound-pipeline-must-never-be-silent) — Pipeline de recepção WhatsApp tem 5 camadas anti-silêncio: trigger BEFORE INSERT garante status='received', webhook usa try/catch/finally universal com outcome pessimista, view whatsapp_inbound_orphans_v classifica órfãs, watcher abre incidentes em <5min, monitor diário valida assinatura Meta. Códigos canônicos de processed_by definidos.
- [Cron Service Role Key GUC Prohibition](mem://constraints/cron-service-role-key-guc-prohibition) — Proibido usar current_setting('app.settings.service_role_key') em pg_cron neste projeto; padrão obrigatório é anon key hardcoded no header.
- [OAuth Login Audit via onAuthStateChange](mem://constraints/oauth-login-audit-via-onauthstatechange) — Logins OAuth (Google/Apple/etc.) auditados exclusivamente no onAuthStateChange do useAuth, com filtro provider !== 'email' para evitar duplicidade.
- [OAuth Callback Visual Loader Required](mem://constraints/oauth-callback-visual-loader-required) — Toda tela emissora/receptora de redirect OAuth deve usar `isOAuthInProgress()` como gate de loader (sinal em localStorage TTL 60s), bloqueando render do form de login e de rotas protegidas até bootstrap completo. Proibido chamar `signInWithOAuth` fora do `useAuth`.
- [Inbound Email Charset & Iframe Sandbox](mem://constraints/inbound-email-charset-and-iframe-sandbox) — `support-email-inbound` decodifica via campo `charsets` do SendGrid (helper `decodeField`); `EmailViewer` usa sandbox `allow-same-origin allow-popups allow-popups-to-escape-sandbox` e injeta `<meta charset>` + `<base target="_blank">` via `prepareEmailHtml`.
