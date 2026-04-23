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
- [WhatsApp Diagnóstico respeiteohomem](mem://constraints/whatsapp-respeiteohomem-connection-over-meta) — Não voltar a priorizar Meta/display name sem evidência nova; investigar conexão/pipeline primeiro

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
