---
name: Fiscal Emit — Persistir Autorizado Antes dos Side-Effects
description: fiscal-emit deve gravar status authorized + chave + focus_ref no banco ANTES de chamar link de remessa, e-mail e WMS. Falha em qualquer passo seguinte não pode reverter o estado fiscal.
type: constraint
---

# Regra

Quando `fiscal-emit` recebe `focusStatus='autorizado'` da Focus NFe, a sequência obrigatória é:

1. Montar `updateData` com `status='authorized'`, `chave_acesso`, `numero`, `serie`, `xml_url`, `danfe_url`, `authorized_at`, `fiscal_stage='emitida'`, `focus_ref`.
2. **Persistir esse update em `fiscal_invoices` PRIMEIRO**, com tratamento de erro próprio (log, mas não relança — a NF já está autorizada na SEFAZ).
3. **Só então** disparar side-effects: `linkNFeToShipment`, `fiscal-send-nfe-email`, `wms-pratika-send`.
4. Side-effects devem estar em `try/catch` individual. Falha neles loga e segue — **nunca** reverte o estado fiscal.

# Por quê

Antes da correção (v2026-06-11), `linkNFeToShipment` era awaited ANTES do UPDATE. Se ele lançasse exceção (ex.: erro ao criar shipment via `shipping-create-shipment`), o catch global capturava e o UPDATE com chave/status nunca rodava. Resultado:

- NF emitida e válida na SEFAZ.
- Banco mantinha `status='draft'`, `chave_acesso=NULL`, `focus_ref=NULL`, `fiscal_stage='pronta_emitir'`.
- Re-emissão era bloqueada com "A nota fiscal já foi autorizada", criando estado órfão permanente.
- Apenas o evento `authorized` em `fiscal_invoice_events` denunciava a inconsistência.

# Como aplicar

- Em qualquer função que persista resultado de autorização SEFAZ (`fiscal-emit`, `fiscal-submit`, `fiscal-check-status`, `fiscal-webhook`), a ordem é sempre: **gravar estado autoritativo → disparar efeitos colaterais**.
- Side-effects com retentativa própria (queue, WMS, e-mail) NÃO devem bloquear a persistência.
- Erro de persistência é crítico e deve ser logado em destaque (`FALHA CRÍTICA`), pois aí sim o estado fiscal vs SEFAZ diverge.

# Recovery de incidentes legados

NFs travadas antes desta correção podem ser recuperadas com:
1. Extrair `focus_response.chave_nfe`, `caminho_xml_nota_fiscal`, `caminho_danfe` do evento `authorized` em `fiscal_invoice_events`.
2. UPDATE manual em `fiscal_invoices` setando `status='authorized'`, `chave_acesso`, `focus_ref`, `authorized_at`, `fiscal_stage='emitida'`.
3. Se a NF for de teste, cancelar via `fiscal-cancel` em seguida.
