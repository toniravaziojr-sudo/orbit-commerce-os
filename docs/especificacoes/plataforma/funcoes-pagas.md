# Registry de Funções Pagas — Comando Central

> **Camada:** Layer 2/3 — Especificação de Plataforma  
> **Status:** Ativo (Fase 0 — registry inicial, nenhuma função plugada no motor)  
> **Última atualização:** 2026-05-04  
> **Fonte de verdade para:** lista canônica de edge functions que consomem custo externo, classificação de cobrança e padrão futuro de plug no Motor Universal de Créditos.

---

## 1. Objetivo

Catalogar toda edge function que consome (ou pode consumir) custo externo pago. Cada entrada define como a função deverá interagir com o Motor de Créditos (`charge`, `reserve/capture`, `recordPlatformCost` ou `bloqueado até classificação`).

**Regra estrutural:** **nenhuma nova função paga pode ser criada sem entrada neste registry**. A ausência aqui é equivalente a função bloqueada para deploy. Mecanismo de enforcement (lint/CI) será definido na Fase 12 (anti-regressão).

## 2. Legenda

- **Categoria:** `ai_text` | `ai_image` | `ai_video` | `ai_audio` | `ai_embedding` | `fiscal` | `email` | `whatsapp` | `scrape`.
- **Origem:** `frontend` | `webhook` | `worker` | `cron` | `fila`.
- **tenant_id confiável:** `sim` (auth/contexto) | `parcial` (depende do job) | `não` (cron sem tenant).
- **Padrão futuro:** `charge` (débito direto) | `reserve+capture` (reserva → captura) | `recordPlatformCost` (custo absorvido) | `bloqueado` (precisa classificação antes de Fase 1).
- **Risco financeiro:** `baixo` | `médio` | `alto` | `crítico`.
- **Status:** todos hoje em `não plugado no motor`.

## 3. Registry inicial (~70 funções)

### 3.1 IA Texto/Chat

| Função | Provedor | Unidade | Origem | tenant_id | Padrão futuro | Risco | Observações |
|---|---|---|---|---|---|---|---|
| ai-support-chat | OpenAI/Gemini | token_in/out | frontend/webhook | sim | reserve+capture | alto | Streaming. Modo Vendas WhatsApp dispara várias chamadas. |
| ai-product-description | OpenAI/Gemini | token | frontend | sim | charge | médio | — |
| ai-business-snapshot-generator | OpenAI/Gemini | token | cron/worker | parcial | reserve+capture | médio | Verificar herança de tenant. |
| command-assistant-chat | Lovable/Gemini | token | frontend | sim | reserve+capture | médio | Streaming. |
| command-assistant-execute | Lovable/Gemini | token | frontend | sim | charge | médio | — |
| ads-chat / ads-chat-v2 | OpenAI/Gemini | token | frontend | sim | reserve+capture | médio | — |
| ai-landing-page-generate / ai-landing-page-generate-html / ai-landing-page-enhance-images | OpenAI/Gemini/Fal | token + image | frontend | sim | reserve+capture | alto | Multi-passo. |
| ai-essential-pages | OpenAI/Gemini | token | frontend | sim | reserve+capture | médio | — |
| ai-block-fill / ai-block-fill-visual | OpenAI/Gemini/Fal | token + image | frontend | sim | reserve+capture | médio | — |
| ai-page-architect | OpenAI/Gemini | token | frontend | sim | reserve+capture | médio | — |
| classify-content | OpenAI/Gemini | token | frontend/worker | sim | charge | baixo | — |
| infer-business-context | OpenAI/Gemini | token | frontend/worker | sim | charge | baixo | — |
| ai-import-page / ai-analyze-page | OpenAI/Gemini + Firecrawl | token + page | frontend | sim | reserve+capture | médio | Combina IA + scrape. |
| ai-language-intent-generator | OpenAI/Gemini | token | worker | parcial | reserve+capture | baixo | — |
| ai-snapshot-queue-worker | OpenAI/Gemini | token | worker/cron | parcial | reserve+capture | médio | Herda tenant do job. |
| ai-media-queue-process | OpenAI/Gemini/Fal | token + image/video | worker | parcial | reserve+capture | alto | Herda tenant do job. |
| ai-signal-capture / ai-signal-capture-batch / ai-signal-consolidate | OpenAI/Gemini | token | worker | parcial | charge | médio | — |
| ai-learning-aggregator | — (sem provider externo) | — | cron | **n/a** | **não aplicável** | nenhum | **F2.6:** auditada — pipeline puramente DB+regex local, sem chamada a OpenAI/Gemini/Anthropic/Lovable. Sem custo externo rastreável. |
| ai-brain-monthly-review-reminder | OpenAI/Gemini | token | cron | sim | charge | baixo | — |
| ai-critical-alerts-process | OpenAI/Gemini | token | cron | sim | charge | baixo | — |
| ai-config-bootstrap | OpenAI/Gemini | token | frontend | sim | charge | baixo | — |
| ai-generate-offers / ai-generate-related-products | OpenAI/Gemini | token | frontend | sim | charge | baixo | — |
| ai-memory-manager | OpenAI/Gemini | token | worker | sim | charge | baixo | — |
| chatgpt-chat | OpenAI | token | frontend | sim | reserve+capture | alto | Feature dedicada. |
| command-insights-generate | Gemini | token | cron + admin | **não** | recordPlatformCost | médio | **F2.6 ✅ plugada.** service_key=`command-insights-generate`, custo calculado em runtime via tokens reais (Gemini 2.5 Flash in/cached/out). |
| infer-business-context | OpenAI/Gemini | token | frontend | sim | charge | baixo | — |
| meli-generate-description | OpenAI/Gemini | token | frontend | sim | charge | baixo | — |
| generate-seo / generate-reviews / batch-kit-descriptions | OpenAI/Gemini | token | frontend | sim | charge | médio | — |

### 3.2 IA Imagem

| Função | Provedor | Unidade | Origem | tenant_id | Padrão futuro | Risco |
|---|---|---|---|---|---|---|
| media-generate-image | Fal/OpenAI/Gemini | image | frontend/worker | sim | charge | médio |
| creative-image-generate | Fal/OpenAI/Gemini | image | frontend | sim | charge | médio |
| creative-generate / creative-process | Fal/OpenAI/Gemini | image | worker | sim | charge | médio |
| media-regenerate-variant / media-approve-variant | Fal | image | frontend | sim | charge | médio |
| ai-landing-page-enhance-images | Fal/OpenAI | image | worker | sim | charge | alto |
| ads-autopilot-creative-generate | Fal/OpenAI | image | cron/worker | sim | charge | alto |

### 3.3 IA Vídeo

| Função | Provedor | Unidade | Origem | tenant_id | Padrão futuro | Risco |
|---|---|---|---|---|---|---|
| media-generate-video | Fal (Kling/Veo/Wan) | second | frontend/worker | sim | **reserve+capture** | **crítico** |
| creative-video-generate | Fal | second | frontend | sim | **reserve+capture** | **crítico** |
| media-video-generate | Fal | second | worker | sim | **reserve+capture** | **crítico** |

**Regra:** vídeo IA exige reserva obrigatória de 110% da estimativa. Bloqueio duro. Maior risco financeiro do sistema.

### 3.4 IA Áudio / TTS

| Função | Provedor | Unidade | Origem | tenant_id | Padrão futuro | Risco |
|---|---|---|---|---|---|---|
| ai-support-transcribe | OpenAI Whisper | minute | frontend/webhook | sim | charge | baixo |
| voice-preset-audio | OpenAI TTS | char | frontend | sim | charge | baixo |

### 3.5 Embeddings

| Função | Provedor | Unidade | Origem | tenant_id | Padrão futuro | Risco |
|---|---|---|---|---|---|---|
| ai-generate-embedding | OpenAI | token | frontend/worker | sim | charge | médio |
| ai-kb-ingest | OpenAI | token | worker | sim | charge | médio |

### 3.6 Fiscal

| Função | Provedor | Unidade | Origem | tenant_id | Padrão futuro | Risco | Observações |
|---|---|---|---|---|---|---|---|
| fiscal-emit | Focus NFe | document | frontend/worker | sim | charge | alto | — |
| fiscal-submit | Focus NFe | document | worker | sim | charge | alto | — |
| fiscal-create-manual | Focus NFe | document | frontend | sim | charge | alto | — |
| fiscal-cancel | Focus NFe | document | frontend | sim | charge | médio | Cobrança definida no catálogo (não hardcoded). |
| fiscal-cce | Focus NFe | document | frontend | sim | charge | médio | Idem. |
| fiscal-inutilizar | Focus NFe | document | frontend | sim | charge | baixo | Idem. |
| fiscal-send-nfe-email | SendGrid | email | worker | sim | charge | baixo | Categoria email. |
| fiscal-check-status / fiscal-get-status / fiscal-sync-focus-nfe | Focus NFe | request | cron/worker | parcial | recordPlatformCost (sem cobrança Focus por consulta) | baixo | Confirmar com provedor. |

### 3.7 E-mail (tenant)

| Função | Provedor | Unidade | Origem | tenant_id | Padrão futuro | Risco |
|---|---|---|---|---|---|---|
| email-send | SendGrid | email | frontend/worker | sim | charge | médio |
| email-dispatcher | SendGrid | email | worker | sim | charge | alto |
| email-campaign-broadcast | SendGrid | email | worker | sim | reserve+capture | alto |
| process-scheduled-emails | SendGrid | email | cron | sim | charge | médio |
| support-send-message | SendGrid | email | frontend | sim | charge | baixo |
| support-email-test | SendGrid | email | frontend | sim | charge | baixo |
| schedule-tutorial-email | SendGrid | email | cron | parcial | charge | baixo |

### 3.8 E-mail (plataforma — absorvido)

| Função | Provedor | Unidade | Padrão futuro | Justificativa |
|---|---|---|---|---|
| send-auth-email | SendGrid | email | recordPlatformCost | Onboarding/auth da plataforma. |
| resend-signup-email | SendGrid | email | recordPlatformCost | Reenvio de confirmação. |
| auth-email-hook | SendGrid | email | recordPlatformCost | Hook de Supabase Auth. |
| send-system-email | SendGrid | email | recordPlatformCost | E-mail de sistema. |
| mailbox-dns-verify | SendGrid | request | recordPlatformCost | Verificação técnica. |
| email-domain-upsert / email-domain-verify | SendGrid | request | recordPlatformCost | Setup de domínio. |
| sendgrid-inbound-setup | SendGrid | request | recordPlatformCost | Setup. |
| system-email-domain-upsert / system-email-domain-verify | SendGrid | request | recordPlatformCost | Setup. |

### 3.9 WhatsApp

| Função | Provedor | Unidade Fase 1 | Unidade Fase 2 | Origem | tenant_id | Padrão futuro | Risco |
|---|---|---|---|---|---|---|---|
| meta-whatsapp-send | Meta Cloud API | template (quando type=template) | conversation_24h | frontend/worker | sim | charge | alto |
| meta-whatsapp-test-send | Meta Cloud API | template | conversation_24h | frontend | sim | charge | baixo |
| meta-whatsapp-send-test-runner | Meta Cloud API | template | conversation_24h | cron | sim | charge | baixo |
| agenda-dispatch-reminders | Meta Cloud API | template | conversation_24h | cron | sim | charge | médio |
| ai-support-chat (replies WhatsApp) | Meta Cloud API | conversation_24h (Fase 2) | conversation_24h | webhook | sim | charge | alto |

**Fase 1:** apenas template enviado paga. Texto livre dentro de janela aberta = grátis.  
**Fase 2:** abertura de janela 24h por `(tenant_id, wa_id, category)` paga uma vez. Cobertura completa do modelo Meta.

### 3.10 Scrape / Importação

| Função | Provedor | Unidade | Origem | tenant_id | Padrão futuro | Risco |
|---|---|---|---|---|---|---|
| firecrawl-scrape | Firecrawl | page | frontend/worker | sim | charge | médio |
| ai-import-page | Firecrawl + IA | page + token | frontend | sim | reserve+capture | médio |
| ai-analyze-page | Firecrawl + IA | page + token | frontend | sim | reserve+capture | médio |
| scrape-update-products | Firecrawl | page | worker | sim | reserve+capture | alto |
| import-products / import-customers / import-orders / import-menus / import-store-categories / import-institutional-pages | Firecrawl (eventual) | page | worker | sim | reserve+capture | alto |

### 3.11 Crons / workers de plataforma (sem tenant)

| Função | Padrão futuro | Justificativa |
|---|---|---|
| **google-token-refresh** | **não aplicável** | **F2.9 (2026-05-11):** auditada — Google OAuth `oauth2.googleapis.com/token` (`grant_type=refresh_token`), gratuita. Sem cobrança monetária do provider; consome apenas quota OAuth. Ver §16 do doc F2. |
| **google-token-refresh-cron** | **não aplicável** | **F2.9 (2026-05-11):** auditada — refresh em batch via mesmo endpoint OAuth Google gratuito. Sem cobrança monetária do provider. Ver §16 do doc F2. |
| **meta-token-refresh** | **não aplicável** | **F2.8 (2026-05-11):** auditada — Meta Graph `/oauth/access_token` (`fb_exchange_token`), gratuita. Sem cobrança monetária do provider. Ver §15 do doc F2. |
| **meli-token-refresh** | **não aplicável** | **F2.8 (2026-05-11):** auditada — Mercado Livre `/oauth/token` (refresh_token), gratuita. Ver §15 do doc F2. |
| **tiktok-token-refresh-cron** | **não aplicável** | **F2.8 (2026-05-11):** auditada — TikTok Business + TikTok Shop refresh OAuth, gratuitos em ambos. Ver §15 do doc F2. |
| **shopee-token-refresh** | **não aplicável** | **F2.8 (2026-05-11):** auditada — Shopee `/api/v2/auth/access_token/get` (HMAC-SHA256), gratuita. Ver §15 do doc F2. |
| **meta-token-health-check** | **não aplicável** | **F2.7 (2026-05-08):** auditada — usa Meta Graph `/me?fields=id`, API gratuita, sem cobrança monetária do provider. Não registra em `platform_cost_ledger`. Ver §14 do doc F2. |
| audience-sync-weekly | tenant_inherited (job carrega tenant) | Verificar implementação. |
| sync-ads-dashboard | tenant_inherited | Verificar. |
| monitor-chargebacks | tenant_inherited | Verificar. |
| ads-autopilot-* | tenant_inherited | Verificar. |
| **meta-whatsapp-monitor-all** | **não aplicável (estado atual)** | **F2.10 (2026-05-11):** auditada — cron de monitoramento/auto-reparo administrativo Meta. Invoca `meta-whatsapp-diagnose` e `meta-whatsapp-recover`, que usam apenas endpoints administrativos gratuitos da Meta Graph (`/me`, `/{phone_number_id}`, `/subscribed_apps`, `/register`, `/deregister`, `/subscriptions`). **Não chama `/messages`. Não envia template. Não consome conversa cobrável.** Sem cobrança monetária do provider. **Regra preventiva:** qualquer ação futura adicionada a esta edge que invoque `/messages`, template pago, conversa cobrável Meta ou qualquer operação monetizável **deve reabrir auditoria F2 antes de merge**. Ver §17 do doc F2. |
| **whatsapp-token-healthcheck** | **não aplicável** | **F2.8 (2026-05-11):** auditada — Meta Graph `/me?access_token=...` para validar token diariamente, gratuita. Sem cobrança monetária do provider. Ver §15 do doc F2. |
| **whatsapp-orphan-watcher** | **não aplicável** | **F2.10 (2026-05-11):** auditada — cron 15 min, apenas leitura/escrita interna (Postgres) em `whatsapp_inbound_messages` e `whatsapp_health_incidents`. Sem chamada externa, sem envio. Ver §17 do doc F2. |
| **whatsapp-cross-business-detector** | **não aplicável** | **F2.10 (2026-05-11):** auditada — cron diário, classifica `channel_state` em `whatsapp_configs` com base em sinais internos. Sem chamada externa, sem envio. Ver §17 do doc F2. |
| **platform-costs-sync** (orquestrador) | **não aplicável** | **F2.7 (2026-05-08):** auditada — apenas consulta de saldos externos (hoje SendGrid `/v3/user/credits`), sem cobrança monetária. Custo real é registrado pelo edge que **emite** o evento cobrável (ex.: `send-system-email`), nunca pelo orquestrador de sync. Cada novo adapter deve ser auditado individualmente. Ver §14 do doc F2. |
| **health-check-run** | **não aplicável (estado atual das suítes)** | **F2.9 (2026-05-11):** auditada — orquestrador de observabilidade. Suítes atuais (`domains`, `checkout_tracking`, `coupons`, `payments` com `dry_run`) não chamam provider pago. Não registra em `platform_cost_ledger`. **Regra de governança:** qualquer nova suíte exige auditoria F2 antes de merge. Ver §16 do doc F2. |
| **health-monitor-admin** | **não aplicável** | **F2.10 (2026-05-11):** auditada — endpoint admin de leitura (`stats/checks/targets/violations`) sobre `system_health_checks`, `system_health_check_targets` e `storefront_runtime_violations`. Sem chamada externa, sem disparo de suíte. Herda regra §16.4: se ganhar ação que dispare `health-check-run` ou outra edge cobrável, exige reauditoria F2. Ver §17 do doc F2. |
| **meta-whatsapp-diagnose** | **não aplicável** | **F2.11 (2026-05-11):** auditada — diagnóstico read-only por tenant. Chama Meta Graph administrativa gratuita (`/me`, `/{phone_number_id}?fields=...health_status`, `/{app_id}/subscriptions`, `/{waba_id}/subscribed_apps`). **Não chama `/messages`, não envia mensagem, não consome template pago, não inicia conversa cobrável, não altera WABA/número.** Sem cobrança monetária do provider. Não registra em `platform_cost_ledger`. Riscos de log/PII (médio: `raw` em `last_health_payload`, `health_status.errors`) catalogados como backlog F2.11.1 sem correção nesta entrega. Ver §18 do doc F2. |
| **meta-whatsapp-recover** | **não aplicável (estado atual)** | **F2.11 (2026-05-11):** auditada — operação **administrativa sensível** de reparo. Chama Meta Graph administrativa gratuita (`POST /{waba_id}/subscribed_apps`, `POST /{phone_number_id}/deregister`, `POST /{phone_number_id}/register`). **Pode alterar estado administrativo da WABA/número** (re-inscrever webhook, re-registrar Cloud), mas **não chama `/messages`, não envia mensagem, não consome template pago, não inicia conversa cobrável**. Sem cobrança monetária do provider no estado atual. Não registra em `platform_cost_ledger`. **Regra preventiva:** qualquer ação adicional além de `subscribe_webhook` e `register_phone` — especialmente `/messages`, template pago, envio, conversa cobrável Meta ou qualquer operação monetizável — **exige reabrir auditoria F2 antes de merge**. Riscos de log/PII (médio-alto: `JSON.stringify` cru de `subData`/`regData` em `executed[].detail`; `register_pin` persistido em `whatsapp_configs`) catalogados como backlog F2.11.2 sem correção nesta entrega. Ver §18 do doc F2. |
| **whatsapp-health-summary** | **não aplicável** | **F2.11 (2026-05-11):** auditada — endpoint chamado pela Central de Comando, lê `whatsapp_inbound_messages`, `whatsapp_messages` e `whatsapp_health_incidents`. Sem chamada externa, sem envio. Sem cobrança monetária. Ver §18 do doc F2. |
| **whatsapp-open-validation-window** | **não aplicável** | **F2.11 (2026-05-11):** auditada — apenas marca janela interna de 10 min em `whatsapp_configs`. Sem chamada externa, sem envio, sem alteração de WABA/número. Ver §18 do doc F2. |
| **whatsapp-check-templates** | **não aplicável** | **F2.11 (2026-05-11):** auditada — cron horário, `GET /{waba_id}/message_templates` (Meta Graph administrativa gratuita) para conferir status de aprovação de templates pendentes. **Não envia template, não consome template pago, não chama `/messages`.** Sem cobrança monetária do provider. Submissão é gratuita; uso (envio) é cobrável e está coberto por `meta-whatsapp-send` (lote 3 do Motor v2). Ver §18 do doc F2. |

**Todos os crons acima precisam de classificação 1×1 antes de Fase 7.** Função sem classificação fica bloqueada para deploy.

> **Regra de separação obrigatória (F2.11):** WhatsApp/Meta administrativo, diagnóstico, recover e leitura de status **≠** envio cobrável. O custo cobrável Meta/WhatsApp é registrado **exclusivamente** no edge que efetivamente envia mensagem/template/conversa (atualmente `meta-whatsapp-send`, lote 3 do Motor v2). Diagnóstico, recover administrativo, leitura de status, abertura de janela de validação e polling de aprovação de template **não entram em `platform_cost_ledger`** quando não chamam `/messages`, não enviam mensagem, não consomem template pago e não iniciam conversa cobrável.

## 4. Regra anti-regressão

1. **Nenhuma nova função paga** pode ser criada sem entrada neste registry.
2. PR que adicione import de `fal-client.ts`, `openai`, `firecrawl`, `focus-nfe-client.ts`, SendGrid ou Meta WhatsApp **deve** atualizar este documento.
3. Mecanismo de enforcement (lint/CI/checklist obrigatório de PR) será especificado na Fase 12.
4. Função sem padrão futuro definido (`bloqueado`) **não pode** ser plugada no motor — exige decisão de produto antes.

## 5. Documentos relacionados

- `docs/especificacoes/plataforma/motor-creditos.md`
- `docs/especificacoes/plataforma/catalogo-precos-creditos.md`
- `docs/especificacoes/plataforma/workers-crons-pagos.md`

---

## Fase 3 — Primeiro plug em shadow mode (youtube-upload)

**Status:** Ativo desde 2026-05-04. Piloto: Respeite o Homem (`d1a4d0ed-8842-495e-b741-540a9a345b25`).

### Decisões aprovadas

- `youtube-upload` continua usando RPCs v1 (`check_credit_balance`, `reserve_credits`, `consume_credits`) como **única** fonte de cobrança real.
- Motor v2 roda em **modo paralelo** (shadow), apenas calculando créditos via `estimate_credits_internal` e gravando em `service_usage_events` com `status='shadow'`.
- v2 **não** altera `credit_wallet` e **não** insere linhas financeiras em `credit_ledger`.
- Falha do v2 nunca propaga para o usuário (try/catch silencioso, log `WARN`).

### Service pricing

- `service_key`: `platform.youtube_upload`
- `category`: `platform_internal` (nova categoria, monetização interna sem custo externo direto)
- `provider`: `youtube`, `unit`: `upload`, `display_name`: `YouTube Upload`
- `metadata.pricing_model`: `fixed_credits` — base 16, +1 thumbnail, +2 captions (espelha v1)
- `metadata.placeholder=true`, `metadata.approved_for_live=false`, `metadata.shadow_only=true`
- `cost_usd=0.005` é apenas placeholder técnico; não representa venda em créditos para este caso (cálculo usa `fixed_credits`).

### Ativação por tenant

`tenant_credit_motor_config` ganhou as colunas `shadow_service_keys` e `live_service_keys` (text[]).
A ativação shadow é **por service_key**, não por categoria, sempre que tecnicamente possível.

```text
motor_v2_enabled       = false
shadow_categories      = []
live_categories        = []
shadow_service_keys    = ['platform.youtube_upload']
live_service_keys      = []
```

### Critérios de divergência

- `delta_abs = |v2_credits − v1_credits|`
- `delta_pct = delta_abs / v1_credits × 100`
- `≤ 1%` ideal; `> 5%` marca `metadata.divergence_alert=true`. Erro v2 marca `metadata.shadow_error=true`.
- Divergência **não bloqueia** o usuário.

### Idempotência shadow

Chave determinística: `youtube-upload-shadow-v2:{tenant_id}:{video_id ou job_id}`. Retry não duplica evento (verificação prévia em `service_usage_events`).

### Rollback

Remover `platform.youtube_upload` de `shadow_service_keys` no tenant. v1 continua intacto. Eventos shadow são preservados para auditoria.

### Janela de avaliação

7 dias antes de avaliar GO/NO-GO para live. Critério provisório de live: 0 erros v2 + |delta_pct médio| ≤ 1% em ≥50 eventos.

---

## Fase 3B (2026-05) — Atualização de status

| Função | Categoria | Status atual | Escopo |
|---|---|---|---|
| `creative-image-generate` | ai_image | **shadow v2 piloto** | Apenas Fal.AI / gpt-image-1.5. Gemini/Nano Banana → skip (`pricing_not_ready`). OpenAI legacy → skip (`legacy_provider_not_in_pilot`). |
| `media-generate-image` | ai_image | aguardando | Não plugado nesta fase. |
| `creative-generate` | ai_image | aguardando | Não plugado nesta fase. |
| `ads-autopilot-creative-generate` | ai_image | aguardando | Não plugado nesta fase. |
| `ai-landing-page-enhance-images` | ai_image | aguardando | Não plugado nesta fase. |
| `youtube-upload` | youtube_publish | shadow v2 — pausado | Sem OAuth ativo em nenhum tenant. |

**Regra:** outras funções pagas de IA Imagem só serão plugadas após validação do piloto e autorização explícita.

---

### Validação Fase 3B IA Imagem

`creative-image-generate` foi validado em shadow no tenant `Respeite o Homem`. Documento de referência e regra anti-regressão: [`motor-creditos-fase-3b-shadow.md`](./motor-creditos-fase-3b-shadow.md).
