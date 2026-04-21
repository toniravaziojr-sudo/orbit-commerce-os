# Fluxo de Recepção WhatsApp Meta (Layer 3)

**Versão:** v2.0 — 2026-04-21
**Status:** Modelo híbrido oficial + máquina de estados de 5 valores + validação canônica por mensagem real + detector refinado
**Módulos:** WhatsApp (recepção), IA Suporte, IA Agenda, Central de Comando, Hub de Integrações

## v2 — Padrão híbrido oficial (Fase 1)

### Modelo
- **Caminho feliz:** WABA criada no Embedded Signup → 100% automático.
- **Caminho residual:** WABA pré-existente / cross-business → exige autorização administrativa manual no painel Meta. **Não é automatizável** — Meta não expõe API pública para um terceiro se autoadicionar a um portfólio (regra de segurança da Meta).

### Máquina de estados (`whatsapp_configs.channel_state`)
| Estado | Quando |
|---|---|
| `disconnected` | Token quebrado/inválido |
| `technically_connected` | Técnico OK, sem inbound real ainda |
| `real_reception_pending` | Nunca validado OU validação canônica pendente (`last_inbound_validated_at IS NULL`) |
| `operational_validated` | Inbound real comprovado < 24h |
| `no_recent_evidence` | Já validado, silêncio 24-72h OU > 72h sem sinais (estado conservador) |
| `degraded_after_validation` | Já validado, silêncio > 72h + ≥ 1 sinal objetivo |

### 5 sinais objetivos (detector)
1. `last_error` com padrão crítico nas últimas 72h (`131031/131047/131051/190/200/(#10)/OAuthException/"Application does not have permission"/"subscription"`).
2. `last_diagnosed_at` < 24h e `diagnosis_status != 'healthy'`.
3. `previous_phone_number_id` ou `previous_waba_id` presente.
4. POST real recente da mesma WABA roteado para outro tenant (placeholder).
5. `validation_window_opened_at` < 24h sem `last_inbound_validated_at` posterior.

### Validação canônica
- "Validar agora" → `whatsapp-open-validation-window` abre janela de 10 min.
- Tenant envia mensagem real → webhook escreve `last_inbound_validated_at` + promove `operational_validated`.
- Janela expira **nunca-validado** → mantém pendente + sugere wizard (hipótese principal cross-business).
- Janela expira **já-validado** → mantém `no_recent_evidence`, sem promover hipótese cross-business.
- **Teste técnico do webhook NÃO comprova operação real.**

### Rollout informativo (7 dias)
- Detector marca `v2_ui_active_at = now() + 7 dias` na primeira passagem.
- Durante esse período UI v2 calcula tudo mas suprime amarelos no card e banner no Dashboard.

### Linguagem obrigatória
"Hipótese principal", "possível", "recomendamos validar". **Nunca** afirmar causa para tenant já validado.

### Componentes
- Edges: `meta-whatsapp-webhook` (promoção), `whatsapp-open-validation-window`, `whatsapp-cross-business-detector` (cron diário 06:30 UTC), `whatsapp-health-summary` (3 sinais + estado oficial).
- UI: `WhatsAppChannelStatusCard`, `CrossBusinessAuthorizationWizard`, `WhatsAppRealReceptionPendingBanner`.
- Credencial plataforma: `whatsapp_meta_partner_business_id` (admin preenche).

---

## v1 (legado, mantido para histórico)


## Fluxo principal

```
Cliente envia msg
   ↓
Meta Cloud API (v25.0)
   ↓
Webhook → meta-whatsapp-webhook  ← assinatura ativa do campo "messages" é OBRIGATÓRIA
   ↓
Auditoria: insert em whatsapp_inbound_messages (processed_at = NULL)
   ↓
Roteamento por tenant (phone_number_id) + tipo (admin → Agenda, cliente → Suporte)
   ↓
Cria conversa + dispara IA (ai-support-chat OU agenda-process-command)
   ↓
IA responde via meta-whatsapp-send
   ↓
processed_at = now() na linha de auditoria
```

## Fonte de verdade
1. Assinatura do **app Meta** para `whatsapp_business_account` apontando para o callback oficial `.../functions/v1/meta-whatsapp-webhook`.
2. Vínculo da WABA com o app em `subscribed_apps`.
3. Tabela `whatsapp_inbound_messages` (auditoria de tudo que entra).
4. `whatsapp_configs.connection_status` + `last_error`.

## Mecanismos de defesa (anti-regressão)

| Defesa | Onde | Frequência | O que faz |
|---|---|---|---|
| Healthcheck token Meta | `whatsapp-token-healthcheck` | diário | Detecta token invalidado (erro 190) |
| Diagnóstico completo | `meta-whatsapp-diagnose` | sob demanda + monitor | Valida token, número, callback real do app Meta e vínculo da WABA |
| Monitor + auto-reparo | `meta-whatsapp-monitor-all` | diário (03:17 UTC) | Re-posta `subscribed_fields=[messages,...]` quando necessário; auto-registra número se PIN salvo |
| Vigia de órfãs | `whatsapp-orphan-watcher` | a cada 15 min | Detecta `whatsapp_inbound_messages` com `processed_at IS NULL` há ≥5 min e abre incidente em `whatsapp_health_incidents` |
| Card de saúde | `WhatsAppHealthCard` na Central | tempo real (60s polling) | Mostra última msg recebida, última resposta IA, **vínculo técnico**, **operação real**, órfãs 24h, incidentes abertos |
| Janela de observação pós-migração | trigger `whatsapp_configs_track_migration` | automático no UPDATE | Quando `phone_number_id` ou `waba_id` mudam, abre `migration_observation_until = now()+24h` e zera `last_inbound_at` — impede que o canal volte a "saudável" sem evidência operacional do novo número |

## Status em camadas (regra obrigatória)
A leitura do canal WhatsApp NUNCA é binária ("conectado/desconectado"). É sempre composta por DUAS camadas que precisam aparecer juntas em toda UI e em todo alerta:

**Camada 1 — Vínculo técnico (`link_status`)**
- `connected` — token Meta válido + WABA inscrita + webhook do app apontando para o receptor oficial com o campo `messages` ativo.
- `incomplete` — vínculo existe mas falta confirmação de assinatura ativa (`webhook_subscribed_at` ausente).
- `broken` — token revogado, conta desconectada ou diagnóstico crítico ativo.

**Camada 2 — Operação real (`operational_status`)**
- `healthy` — recebeu inbound nas últimas 12h.
- `degraded` — última inbound entre 12h e 24h.
- `no_delivery` — sem inbound há mais de 24h, ou nunca recebeu fora da janela de observação, ou vínculo quebrado.
- `observation` — está dentro da janela `migration_observation_until` (24h após troca de WABA/Phone ID ou primeira conexão) e ainda não chegou nada.
- `unknown` — sem dados suficientes.

**Regra estrutural:** o canal só aparece como "saudável" quando `link_status = connected` E `operational_status = healthy`. Vínculo correto sem operação comprovada exibe "Aguardando comprovação operacional" — nunca "OK".

## Troca de WABA / Phone Number ID (cenário sensível)
Sempre que `whatsapp_configs.phone_number_id` ou `waba_id` mudam:
1. Trigger captura o valor anterior em `previous_phone_number_id` / `previous_waba_id`.
2. `linked_at` é resetado para `now()`.
3. `migration_observation_until = now() + 24h`.
4. `last_inbound_at` volta para `NULL` (a evidência anterior pertencia ao número antigo).
5. Card de saúde, hub de integrações e painel principal passam a mostrar **"Vínculo trocado, em observação"** até a primeira inbound real chegar OU a janela vencer com diagnóstico OK.
6. Quando o webhook recebe a primeira mensagem do novo número, `last_inbound_at` é gravado e `migration_observation_until` é zerado — o canal só então pode voltar a "saudável".

**Proibido:** marcar troca de WABA como sucesso completo só porque os identificadores foram salvos. Identificador salvo ≠ recepção funcionando.

## Regras invioláveis
- Mensagem na auditoria sem processamento por mais de 5 min = **incidente crítico**, sempre.
- Não basta checar `subscribed_apps`: o **callback do app Meta** precisa apontar para o receptor oficial.
- Sem reprocessamento automático de órfãs — só visibilidade. Reprocessamento exige decisão humana.
- Versão Meta: **v25.0** (validada). Não trocar sem testar recepção end-to-end.
- **Toda leitura pública do canal usa as duas camadas (vínculo + operação).** Telas que ainda exibirem só "conectado/desconectado" são bug.
- **Toda troca de WABA abre janela de observação obrigatória.** Não existe atalho.

## Tabelas-chave
- `whatsapp_inbound_messages` — auditoria bruta de tudo que entra
- `whatsapp_configs` — credenciais + estado de assinatura por tenant
  - Colunas de migração: `previous_phone_number_id`, `previous_waba_id`, `linked_at`, `migration_observation_until`, `last_inbound_at`
- `whatsapp_health_incidents` — incidentes abertos/resolvidos do pipeline

## Crons ativos
- `whatsapp-orphan-watcher-15min` — `*/15 * * * *`
- `meta-whatsapp-monitor-all-daily` — `17 3 * * *`
