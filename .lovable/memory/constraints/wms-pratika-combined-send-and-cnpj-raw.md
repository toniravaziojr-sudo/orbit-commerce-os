---
name: WMS Pratika — envio combinado obrigatório + CNPJ cru (14 dígitos)
description: Pratika só considera o documento "recebido" quando NF (RecepcaoDocNfe) e rastreio (AtualizarCodRastreioNfe) chegam juntos, na mesma operação, sob o mesmo CNPJ de 14 dígitos puros (sem máscara). Envio isolado e CNPJ formatado fazem o documento sumir do painel da loja.
type: constraint
---

# WMS Pratika — envio combinado + CNPJ cru

Descoberto no teste E2E de 2026-06-05 com a NF 396 do Respeite o Homem:
a NF e o rastreio foram enviados separadamente, com CNPJ formatado
(`63.269.917/0001-06`), e a Pratika confirmou que **não recebeu** nem a
nota nem o rastreio no painel da loja, apesar de cada chamada SOAP
individual ter respondido `<Sucesso>true</Sucesso>`.

## Regras invioláveis

1. **Envio sempre combinado.** Os gatilhos reativos (autorização da NF e
   registro do rastreio) chamam **apenas** a ação `send_combined` em
   `wms-pratika-send`, passando `order_id` + `tenant_id`. Se um dos lados
   ainda não está pronto, a função responde `waiting` e não envia nada.
   Quando o segundo lado fica pronto, o gatilho desse evento dispara a
   operação completa (NF + rastreio na mesma invocação).

2. **CNPJ sempre 14 dígitos puros.** Antes de qualquer chamada SOAP
   (inclusive `test_connection`), o CNPJ é reduzido a
   `String(config.cnpj || '').replace(/\D/g, '')`. Se não tiver
   exatamente 14 dígitos, a operação aborta com log de erro e mensagem
   clara em PT-BR. Sem isso, a Pratika indexa o documento no "balde"
   errado e ele fica invisível para a loja real.

3. **Chave de acesso sempre 44 dígitos puros.** Persistida em formato
   canônico `NFe<44 dígitos>` (47 chars). Antes do envio do rastreio é
   obrigatório `replace(/\D/g, '')`. Vale também para a ação combinada.

4. **Envio isolado bloqueado por padrão.** As ações legadas `send_nfe` e
   `update_tracking` só executam com `force=true` explícito (reenvio
   administrativo). Toda chamada sem `force` é recusada com mensagem
   simétrica: *"Pratika exige NF + rastreio juntos. Use send_combined."*

5. **Idempotência em duas camadas.**
   - Combined: log `operation='combined'` com `reference_id=order_id`.
     Sucesso anterior → não reenvia.
   - Sub-etapas: logs `operation='nfe'` e `operation='tracking'` com
     `reference_id=invoice_id`. Se a primeira tentativa enviou só a NF
     e travou no rastreio, a próxima tentativa pula a NF e tenta só o
     rastreio, depois registra o combined success.

6. **Reconciliação combinada.** O cron de 30 min varre pedidos com NF
   autorizada + rastreio existente sem log `combined=success` e
   reenfileira a ação combinada.

## O que NUNCA pode acontecer

- Disparar `send_nfe` ou `update_tracking` direto dos gatilhos reativos.
  Os gatilhos chamam **apenas** `send_combined` com `order_id`.
- Mandar CNPJ com pontos, barra, traço ou espaços para a Pratika.
- Mandar chave de acesso com prefixo "NFe" ou outros caracteres.
- Marcar `success: true` só por HTTP 200 sem ler `<Sucesso>true</Sucesso>`
  no envelope SOAP.
- Reintroduzir botão de "Reenviar só NF" ou "Reenviar só etiqueta" na UI
  sem `force=true` e sem aviso claro de uso administrativo.
- Cron como caminho primário — sempre fallback.

## Gatilhos que chamam send_combined

- `fiscal-webhook` — quando a Sefaz autoriza a NF (`status='autorizado'`).
- `fiscal-check-status` — quando a polling confirma autorização.
- `shipping-create-shipment` — quando o despacho automático gera o rastreio.
- `shipping-register-manual` — quando o operador digita o rastreio.

## Arquivos

- `supabase/functions/wms-pratika-send/index.ts` — ação `send_combined`,
  sanitização universal de CNPJ, bloqueio defensivo das ações legadas.
- `supabase/functions/wms-pratika-reconcile/index.ts` — cron busca por
  `combined=success` ausente.
- `supabase/functions/fiscal-webhook/index.ts`,
  `supabase/functions/fiscal-check-status/index.ts`,
  `supabase/functions/shipping-create-shipment/index.ts`,
  `supabase/functions/shipping-register-manual/index.ts` — todos chamam
  `send_combined` com `order_id`.
- Doc formal: `docs/especificacoes/erp/logistica.md` §Integração WMS Pratika.
- Memórias relacionadas:
  - `mem://features/external-apps/wms-pratika-integration`
  - `mem://constraints/correios-default-nfe-plus-dc-and-pratika-key-sanitize`
