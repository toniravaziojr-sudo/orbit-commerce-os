---
name: WMS Pratika Integration
description: Integração SOAP com DDS Pratika. Disparo reativo de NF-e ao autorizar (não ao emitir) e de etiqueta ao registrar rastreio. Idempotência por log, reconciliação a cada 30 min e travas por configuração do tenant.
type: feature
---

# WMS Pratika — Integração reativa

## Regra de negócio

1. **Envio do XML da NF-e ao Pratika ocorre apenas quando a NF é AUTORIZADA pela Sefaz** — não quando é emitida. Vale tanto para o caminho síncrono (resposta direta do provedor fiscal) quanto para o assíncrono (webhook ou polling de status).
2. **Envio da etiqueta ao Pratika ocorre apenas quando o código de rastreio é registrado** — manual (digitado pelo operador) ou automático (Correios retornou o objeto). Sem rastreio não há envio.
3. Cada envio é **idempotente**: antes de disparar, o sistema verifica o log de operações do tenant e só dispara se não houver registro de sucesso anterior para a mesma referência (NF ou remessa).
4. As travas `auto_send_nfe` e `auto_send_label` da configuração do tenant cortam o disparo na origem — desligadas, o sistema não envia, mesmo com NF autorizada ou rastreio registrado.
5. **Reconciliação automática a cada 30 minutos** varre NFs autorizadas e remessas com rastreio das últimas 24h que não tenham log de sucesso no Pratika e reenfileira o envio. Cron é fallback, não fluxo primário.
6. O contrato SOAP segue o WSDL oficial da DDS Pratika: namespace `http://wmspratika.ddsinformatica.com.br/`, parâmetros `cnpj`, `xmlNfe`, `chaveAcesso`, `codRastreio`. Qualquer divergência de namespace ou nome de parâmetro derruba o envio com erro genérico do servidor — ver lição em `docs/tecnico/base-de-conhecimento-tecnico.md`.

## O que NUNCA pode acontecer

- Disparar envio ao Pratika no momento da emissão da NF (antes da autorização). NF rejeitada/denegada nunca pode chegar ao WMS.
- Disparar envio de etiqueta antes do rastreio existir.
- Bypassar a idempotência: re-envio só é aceito se não houver log de sucesso anterior para a mesma referência.
- Usar cron como caminho primário de envio. O cron é apenas rede de segurança para falhas pontuais nos gatilhos reativos.
- Alterar namespace ou nome de parâmetro SOAP sem confirmar contra o WSDL oficial da Pratika.
- Expor botão de "forçar reenvio" sem autorização explícita do usuário — o fluxo é automático.

## Arquivos e pontos de integração

- Edge function de envio: `supabase/functions/wms-pratika-send/` — gate de idempotência e de configuração.
- Hooks reativos de NF-e: `supabase/functions/fiscal-webhook/` e `supabase/functions/fiscal-check-status/` (chama o envio quando status → `autorizado`).
- Hooks reativos de etiqueta: `supabase/functions/shipping-register-manual/` e `supabase/functions/shipping-get-label/` (chama o envio quando rastreio passa a existir).
- Reconciliação: `supabase/functions/wms-pratika-reconcile/` + cron `wms-pratika-reconcile-every-30min`.
- Configuração e logs por tenant: `wms_pratika_configs`, `wms_pratika_logs`.
- UI de configuração: aba WMS Pratika em **Aplicativos Externos**.

## Doc formal

- `docs/especificacoes/erp/logistica.md` §"Integração WMS Pratika".
- `docs/especificacoes/erp/erp-fiscal.md` (referência cruzada).
- `docs/especificacoes/transversais/assuntos-em-andamento.md` §5.
