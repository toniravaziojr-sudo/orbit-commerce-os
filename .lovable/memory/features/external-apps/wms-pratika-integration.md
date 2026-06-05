---
name: WMS Pratika Integration
description: Integração SOAP com DDS Pratika. Envio reativo COMBINADO — NF e rastreio sempre juntos, sob CNPJ de 14 dígitos puros. Gatilhos chamam send_combined; ações isoladas só para reenvio admin com force=true.
type: feature
---

# WMS Pratika — Integração reativa combinada

## Regra de negócio (atualizada 2026-06-05)

1. **Envio combinado obrigatório.** Pratika só considera o documento
   "recebido" quando NF e rastreio chegam **juntos**, sob o **mesmo CNPJ
   de 14 dígitos puros**. Os gatilhos reativos chamam apenas a ação
   `send_combined` (NF + rastreio na mesma invocação).
2. **Gatilhos disparam nos dois eventos:** autorização da NF (webhook /
   polling) e registro do rastreio (manual ou automático). Quando só um
   lado está pronto, a função responde `waiting` e não envia nada.
   Quando o segundo lado fica pronto, o gatilho desse evento dispara a
   operação completa.
3. **CNPJ e chave sempre sanitizados.** CNPJ → 14 dígitos. Chave →
   44 dígitos. Sem isso, Pratika devolve sucesso silencioso mas grava no
   "balde" errado e o documento fica invisível para a loja.
4. **Idempotência em duas camadas:** log combinado por `order_id`
   (sucesso anterior → não reenvia) + logs por sub-etapa (nfe / tracking)
   para permitir retomada após falha parcial.
5. **Travas do tenant** (`auto_send_nfe`, `auto_send_label`) cortam o
   disparo na origem. Desligadas → sistema não envia.
6. **Reconciliação automática a cada 30 min** varre pedidos com NF
   autorizada + rastreio sem log `combined=success` e reenfileira.
   Cron é fallback, não fluxo primário.
7. **Contrato SOAP segue o WSDL oficial:** namespace
   `http://wmspratika.ddsinformatica.com.br/`, operações
   `RecepcaoDocNfe(cnpj, xmlNfe)` e `AtualizarCodRastreioNfe(chaveAcesso,
   codRastreio)`. Sucesso real exige HTTP 2xx + `<Sucesso>true</Sucesso>`
   no envelope SOAP, nunca só HTTP 200.

## O que NUNCA pode acontecer

- Disparar `send_nfe` ou `update_tracking` isolados a partir dos
  gatilhos reativos. Os gatilhos chamam **apenas** `send_combined`.
- Enviar CNPJ formatado (pontos, barra, traço, espaços) à Pratika.
- Enviar chave de acesso com prefixo "NFe" ou outros caracteres não
  numéricos.
- Marcar `success: true` apenas com HTTP 200 — precisa ler o envelope.
- Usar cron como caminho primário.
- Reintroduzir botão "Reenviar só NF" ou "Reenviar só etiqueta" sem
  `force=true` e sem aviso de uso administrativo.

## Arquivos e pontos de integração

- Edge function central: `supabase/functions/wms-pratika-send/` — ações
  `send_combined` (oficial), `test_connection`, `send_nfe` / `update_tracking`
  (admin com force).
- Gatilhos reativos: `fiscal-webhook`, `fiscal-check-status`,
  `shipping-create-shipment`, `shipping-register-manual`.
- Reconciliação: `supabase/functions/wms-pratika-reconcile/` + cron
  `wms-pratika-reconcile-every-30min`.
- Configuração e logs por tenant: `wms_pratika_configs`, `wms_pratika_logs`.
- UI de configuração: aba WMS Pratika em **Aplicativos Externos**.

## Doc formal

- `docs/especificacoes/erp/logistica.md` §"Integração WMS Pratika".
- `mem://constraints/wms-pratika-combined-send-and-cnpj-raw` —
  anti-regressão.
