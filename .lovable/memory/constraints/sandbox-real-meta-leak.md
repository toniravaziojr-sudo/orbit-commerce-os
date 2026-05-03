---
name: Sandbox Real Meta Leak — Reg #2.13 Fase C
description: Sandbox de teste do Turn Orchestrator NUNCA pode chamar a Meta Cloud API; guard rail no meta-whatsapp-send + dry_send default no ai-test-sandbox.
type: constraint
---

# Sandbox NUNCA chama Meta sem autorização explícita

## Incidente (02–03/05/2026)

Durante validação da Fase C (Turn Orchestrator), o `ai-test-sandbox` em modo burst gerava `customer_phone` derivado de timestamp (`sandbox_burst_<ts>`). O `meta-whatsapp-send` apenas removia não-dígitos (`phone.replace(/\D/g,"")`) e disparava o request real para a Meta Cloud API. Resultado: **5 mensagens** com `external_message_id` (wamid) emitidas para números arbitrários (todos prefixo `1777...`). Lista oficial:

| created_at (UTC) | wamid (parcial) | message_id |
|---|---|---|
| 2026-05-02 21:48:01 | wamid.HBgNMTc3Nzc1ODQ0NTI2MR…660E9B9B1ACC8461 | 6c85621f-… |
| 2026-05-03 03:10:33 | wamid.HBgNMTc3Nzc3NzgxMjQzNR…A0594C541B9B569C | f4e37801-… |
| 2026-05-03 03:11:29 | wamid.HBgNMTc3Nzc3Nzg1Mzc4Nh…095FC97DC3C14514 | a1af0864-… |
| 2026-05-03 03:11:38 | wamid.HBgNMTc3Nzc3Nzg4MzczNh…BEA0E56DD26C83B0 | 0ec49538-… |
| 2026-05-03 03:12:39 | wamid.HBgNMTc3Nzc3NzkwODk5Nx…13B0328BA6BCCFD7 | 31293739-… |

A divergência "4 vs 5" relatada antes vinha de uma query que listou apenas 4 (corte temporal de 6h). A lista oficial canônica acima é 5. Dados retidos por 7 dias para auditoria — não apagar.

## Regras invioláveis

1. **`meta-whatsapp-send` GUARD RAIL** (avaliado ANTES de qualquer formatação de telefone):
   - Detecta origem sandbox por: `conversation.metadata.is_sandbox === true`, `messages.metadata.is_sandbox === true`, `dry_send === true` em params/msg/convo, ou `phone` casando `/^(sandbox|test|fake|mock)|sandbox_burst|_test_|fake_/i`.
   - Se origem sandbox → bloqueia envio real **a menos que TODOS** estes requisitos sejam satisfeitos:
     - Header `x-allow-real-send: true`,
     - `recipient_override` não vazio,
     - `recipient_override` digits ∈ secret `TEST_WHATSAPP_RECIPIENT_ALLOWLIST`,
     - `metadata.real_send === true`,
     - `dry_send !== true`.
   - Bloqueio sem `force_failure` → `delivery_status='dry_run'`, `metadata.delivery_adapter='dry_run'`, `wamid=null`, `success:true`.
   - Bloqueio com `sandbox_force_send_failure=true` → `delivery_status='failed'`, `failure_reason='sandbox_simulated_send_failure'`, `success:false`.

2. **`TEST_WHATSAPP_RECIPIENT_ALLOWLIST`** — secret obrigatória. **Vazia hoje** = nenhum real_send sandbox autorizado. Mudar requer aprovação explícita.

3. **`ai-test-sandbox` action `burst`**: `dry_send` default = `true`. Conversa criada carrega `metadata.dry_send=true`, `metadata.real_send=false`, `metadata.delivery_adapter='dry_run'`.

4. **`complete_turn` só após envio aceito.** Em produção: `meta-whatsapp-send.success === true` (Cloud API retornou wamid). Em sandbox: dry_run aceito (`success:true, dry_run:true`). Falha → `fail_turn` com backoff. Retry usa o **mesmo** `bot_message_id` (índice único `messages_unique_bot_per_logical_turn` impede 2 respostas por turno lógico).

5. **`dry_run` ≠ envio real.** Status `dry_run` é terminal e sinaliza simulação. NUNCA contar como entrega.

6. **Produção real não é afetada.** Conversas WhatsApp reais não têm `is_sandbox=true`, não têm `dry_send`, e usam phone E.164 que não casa o regex sandbox → guard rail é inerte.

## Como aplicar

- Mexeu em `meta-whatsapp-send`? Releia o bloco `[SANDBOX GUARD RAIL]` (linhas ~140–249). Não remover nem afrouxar sem atualizar esta memória.
- Adicionou nova ferramenta de teste? Tem que passar por `ai-test-sandbox` (não chamar `meta-whatsapp-send` direto com phone fake).
- Mudou esquema de `ai_turn_buffers` ou ordem INSERT→SEND→COMPLETE? Atualizar `docs/especificacoes/whatsapp/turn-orchestrator.md` e `mem://constraints/turn-orchestrator-logical-turn-id`.
