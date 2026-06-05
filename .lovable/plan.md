# Plano — Integração Pratika 100% à prova de falhas (ENCERRADO)

## Status: Corrigido e validado em produção (E2E 2026-06-05)

### Resultado do teste E2E (Respeite o Homem)
- PV duplicado → NF #396 autorizada na Sefaz.
- Etiqueta Correios AP043141782BR emitida com payload NF+DC.
- Envio combinado para Pratika confirmado (log `combined=success`, NF e rastreio juntos, CNPJ 14 dígitos, chave 44 dígitos, envelope SOAP com `<Sucesso>true</Sucesso>`).
- Aguardando apenas confirmação visual da equipe Pratika no painel da loja.

### Achados estruturais corrigidos no caminho
1. **Coexistência PV × NF:** índice único agregado bloqueava criação da NF quando já havia PV do mesmo pedido. Substituído por dois índices parciais separados (um por estágio fiscal). Documentado em `docs/especificacoes/erp/erp-fiscal.md` §Regras item 4 e em `mem://constraints/fiscal-pv-and-nf-coexistence-partial-indexes`.
2. **Rejeição Sefaz NA01 em kits desmembrados:** rateio direto causava drift de centavos no `valor_total` do componente. Corrigido para sempre recalcular `valor_total = round2(qtd × valor_unitario)` e absorver o resíduo no `valor_unitario` do último componente. Documentado em `docs/especificacoes/erp/erp-fiscal.md` §Desmembramento item 6 e em `mem://constraints/fiscal-kit-unbundling-at-nf-time`.
3. **Geração de remessa:** corrigido nome de campo de transporte (`shipping_method_name` / `shipping_service_name`).

### Documentação atualizada nesta entrega
- `docs/especificacoes/erp/erp-fiscal.md` (índices parciais + regra NA01).
- `.lovable/memory/constraints/fiscal-kit-unbundling-at-nf-time.md` (NA01).
- `.lovable/memory/constraints/fiscal-pv-and-nf-coexistence-partial-indexes.md` (novo).
- `.lovable/memory/index.md` (índice).
- `.lovable/memory/features/external-apps/wms-pratika-integration.md` e `.lovable/memory/constraints/wms-pratika-combined-send-and-cnpj-raw.md` (já atualizadas anteriormente).
- `docs/especificacoes/erp/logistica.md` §Integração WMS Pratika (já atualizada anteriormente).
