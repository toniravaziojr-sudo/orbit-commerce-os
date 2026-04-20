---
name: WhatsApp Meta Recovery Protocol
description: Protocolo de diagnóstico, auto-reparo e ciclo de vida do PIN WhatsApp Cloud API. Meta é fonte de verdade do estado do número (não o banco). PIN salvo = consentimento para auto-registro. Templates devem usar mensagem RAW com {{vars}} (não pré-renderizada). Webhook precisa de assinatura explícita por campo.
type: constraint
---
Toda integração WhatsApp Meta (Cloud API) deve ser monitorada pelos 5 pontos críticos onde o número trava:

1. **Token Meta** (`/me`): código 190 = sessão revogada → exige reconexão manual.
2. **Status do número** (`/{phone_id}?fields=status,health_status,code_verification_status`): `PENDING` ou `code_verification_status != VERIFIED` ou erro 141000 = número não registrado na Cloud → precisa `/register` com PIN.
3. **Saúde da WABA** (`health_status.entities[WABA]`): `BLOCKED` com erro 141006 = falta forma de pagamento ativa no Business Manager.
4. **Webhook na WABA** (`/{waba_id}/subscribed_apps`): array vazio ou subscrição parcial = não recebe mensagens (inbound silenciosamente quebrado). Subscribe explícito DEVE incluir `subscribed_fields=messages,message_status_update,message_template_status_update,messaging_handovers`. Sem `messages`, inbound nunca chega — não basta o app aparecer em subscribed_apps.
5. **Templates de notificação transacional**: Meta valida número de parâmetros enviados contra placeholders aprovados (`{{1}}`, `{{2}}`...). Mismatch = erro `#132000`. Telefones inválidos ou auto-envio = erro `#100`.

**Regra de ouro — Fonte de verdade do estado do número:**
A Meta é a única fonte de verdade. `whatsapp_configs.connection_status` é cache local e PODE divergir da Meta (cenário "drift"). Antes de tomar decisão sobre registro, sempre validar via Graph API — `status === "CONNECTED"` E `code_verification_status === "VERIFIED"`. Se qualquer um falhar, número precisa de registro independente do que o banco diz.

**Regra de ouro — Templates transacionais (run-notifications):**
NUNCA passar a mensagem já renderizada para `sendWhatsAppViaMetaTemplate`. SEMPRE buscar `notification_rules.whatsapp_message` (RAW, com `{{var_name}}`), porque é dele que o sistema extrai a ordem e quantidade de variáveis posicionais para casar com o template aprovado na Meta. Mensagem renderizada → 0 variáveis extraídas → erro #132000. A regra cadastrada DEVE ter exatamente o mesmo número de placeholders que o template aprovado na Meta — auditar via `GET /{waba_id}/message_templates?fields=name,components` e contar `{{N}}` no `BODY.text`.

**Ciclo de vida obrigatório do PIN:**
- O PIN de 6 dígitos é exigido pela Meta no `/register` do número e fica amarrado ao número para sempre.
- **Onboarding:** ao concluir Embedded Signup, o sistema DEVE abrir um modal pedindo o PIN inicial. Sem PIN salvo, qualquer queda futura do número (billing, manutenção Meta, política) trava o auto-reparo.
- **Operação contínua:** botão "Gerenciar PIN" SEMPRE visível na tela de WhatsApp do tenant — permite definir (se nunca foi salvo) ou atualizar (preventivo). Não exige problema ativo.
- **Salvar PIN sempre valida estado real:** `meta-whatsapp-set-pin` faz uma probe na Graph API após salvar; se Meta indicar número não-verificado, dispara `register_phone` automaticamente, mesmo que `connection_status` no banco esteja "connected" (drift). Isso elimina o cenário "salvar PIN não fez nada".
- **Reparo reativo:** se o `WhatsAppDiagnosticCard` detectar `NUMBER_NOT_REGISTERED` (141000) e PIN já estiver salvo → reparo 100% automático. Se PIN não estiver salvo → mostra `NUMBER_NEEDS_PIN` e pede entrada do usuário.
- **Reset:** se o usuário esqueceu o PIN antigo, a Meta NÃO permite recuperar; só reset via Gerenciador do WhatsApp (Confirmação em duas etapas → Redefinir). O sistema apenas sobrescreve o valor salvo localmente.

**Auto-reparo no cron (HORÁRIO, não diário):**
`meta-whatsapp-monitor-hourly` (todo minuto 7 de cada hora) executa automaticamente:
- `subscribe_webhook` — sempre (sem efeito colateral); garante todos os 4 fields ativos.
- `register_phone` — APENAS se `register_pin` estiver salvo no banco (PIN salvo = consentimento explícito do usuário durante onboarding/PIN manager; auditoria preservada via `audit_log` da gravação original do PIN).

Janela máxima de downtime do inbound: 1h (antes era 24h, alterado em abr/2026 após incidente respeiteohomem).

**Audit loop obrigatório (inbound):**
`meta-whatsapp-webhook` deve gravar `processed_at` E `processed_by` (`ai`, `agenda`, `human`) em `whatsapp_inbound_messages` ao despachar a mensagem. Sem esse passo, é impossível diagnosticar se inbound chega mas não é processado vs. se não chega mesmo. Inbound zero por >24h sem `processed_at` = sinal claro de webhook quebrado. Inbound com `processed_at` zero = problema no roteador IA/Agenda.

**Infra obrigatória:**
- Edge `meta-whatsapp-diagnose`: roda os 5 checks, retorna `issues[]` com `action_type: auto|user|support`.
- Edge `meta-whatsapp-recover`: executa `subscribe_webhook` (seguro) e `register_phone` (exige PIN).
- Edge `meta-whatsapp-set-pin`: salva/atualiza PIN e probeia Meta para detectar drift; força registro quando necessário.
- Edge `meta-whatsapp-monitor-all` + cron HORÁRIO (`7 * * * *`): roda diagnose em todos os tenants; auto-repara webhook sempre, registro só se PIN salvo.
- Edge `meta-whatsapp-webhook`: grava `processed_at`/`processed_by` para audit loop.
- Edge `run-notifications`: usa `whatsapp_message` RAW para templates (não a mensagem renderizada).
- Coluna `register_pin` em `whatsapp_configs` para recovery sem nova interação.
- Componente `WhatsAppDiagnosticCard` na tela de WhatsApp do tenant com botão "Diagnosticar agora" e "Reparar automaticamente".
- Componente `WhatsAppPinManager` SEMPRE visível ao lado do número conectado, mesmo em estado saudável (preventivo).
- Componente `WhatsAppOnboardingPinDialog` aciona modal automático após Embedded Signup quando `register_pin` está null.

**Proibido:**
- Tratar `connection_status` do banco como verdade absoluta antes de validar com a Meta.
- Tratar `PENDING` como erro de configuração nossa antes de rodar `health_status`.
- Mostrar mensagem genérica "desconectado" quando há causa identificável (billing/token/webhook/template).
- Executar `register_phone` automaticamente sem PIN salvo (PIN salvo = consentimento; sem PIN = exigir input).
- Concluir Embedded Signup sem oferecer modal de PIN (deixa tenant exposto a downtime futuro sem reparo automático).
- Esconder o botão "Gerenciar PIN" só porque o número está saudável.
- Reportar "PIN salvo" como sucesso final sem validar estado real do número na Meta.
- Passar mensagem renderizada (sem `{{vars}}`) para `sendWhatsAppViaMetaTemplate` (causa #132000).
- Cadastrar regra de notificação WhatsApp com número de variáveis diferente do template aprovado na Meta.
- Tentar enviar template para o próprio número conectado (Meta retorna #100).
- Confiar em `subscribed_apps` (lista app inscrito) sem validar `subscribed_fields=messages` (campo específico). Subscribe parcial = inbound morto.
- Cron diário para monitor (downtime de até 24h é inaceitável; usar horário).

**Causas comuns observadas:**
- Cartão removido/recusado no Business Manager → WABA bloqueada → número desativado.
- Reconexão Meta sem re-assinatura de webhook → recebimento quebra silenciosamente.
- Troca de senha/logout do Facebook → token código 190 → register falha em silêncio e número fica PENDING.
- Tenant antigo conectado antes do dialog de onboarding → fica sem PIN salvo → primeira queda exige intervenção manual (mitigação: banner + botão "Gerenciar PIN" sempre disponível).
- **Drift banco↔Meta:** banco diz `connected` enquanto Meta diz `BLOCKED/PENDING` (observado no tenant `respeiteohomem`, abr/2026). Causa: registro automático no callback do Embedded Signup falhou silenciosamente. Solução implementada: probe obrigatória da Meta dentro do `set-pin` + auto-registro no `monitor-all` quando PIN salvo.
- **Template parameter mismatch (#132000):** observado em respeiteohomem abr/2026 — sistema enviava mensagem pré-renderizada em vez do template raw, gerando 0 parâmetros para template que esperava 5. Solução: `run-notifications` agora busca `whatsapp_message` raw da rule e extrai vars via regex `\{\{(\w+)\}\}` na ordem original.
- **Inbound silenciosamente morto:** `subscribed_apps` lista o app, mas `subscribed_fields` não inclui `messages` (caso "half-subscribed" observado em abr/2026). Solução: monitor horário re-subscreve sempre todos os 4 fields explicitamente.
- **Auto-envio (#100):** template enviado para o próprio `phone_number` conectado é rejeitado como "Invalid parameter" pela Meta. Não é bug — usar outro número para testes.
