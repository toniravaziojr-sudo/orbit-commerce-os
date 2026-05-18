---
name: Endereço Componente Único Guiado
description: Toda coleta de endereço (checkout, novo pedido manual, cadastro de cliente, editor fiscal) usa o componente único `src/components/shared/AddressFields.tsx`. UF é dropdown fechado das 27 UFs oficiais (`src/lib/brazilianStates.ts`). Cidade é Combobox alimentado pela API IBGE Localidades filtrada pela UF (`useIbgeMunicipios`). Texto livre para UF ou Cidade é proibido em qualquer tela nova.
type: constraint
---

**Regra:** Não construir novos formulários de endereço com `<Input>` de texto livre para UF ou Cidade. Sempre reusar `AddressFields`.

**Comportamento obrigatório:**
1. CEP dispara busca automática ao sair do campo (8 dígitos).
2. Após CEP, foco salta para Número.
3. Rua/Bairro/Número/Complemento ficam desabilitados até UF válida.
4. Trocar UF reseta Cidade e código IBGE.
5. Cidade carrega código IBGE oficial (7 dígitos) ao ser selecionada.

**Por quê:**
O incidente 2026-05-18 (Pedido 1-215, tenant Respeite o Homem) gerou pendência fiscal porque o checkout aceitava UF de texto livre — o cliente digitou `SO` e o sistema persistiu. O motor fiscal já prefere o IBGE retornado pelo ViaCEP, mas a UF errada gerava aviso amarelo "UF do CEP diferente da UF do pedido" e poluía o fluxo. Com dropdowns fechados ancorados em fonte oficial (27 UFs + IBGE Localidades), é fisicamente impossível enviar UF inválida ou cidade fora do estado.

**Telas que adotam:**
- `src/components/storefront/checkout/wizard/Step2Address.tsx`
- `src/pages/OrderNew.tsx`
- `src/components/customers/CustomerForm.tsx`
- `src/components/fiscal/InvoiceEditor.tsx` (já tinha UF dropdown + IBGE)

**Aplicação:**
1. Qualquer tela nova que peça endereço (admin, storefront, painel cliente, edge wizard) deve importar `AddressFields`. Nenhum `<Input maxLength={2}>` para UF é aceito em PR.
2. Mudanças no motor fiscal de lookup IBGE não dispensam essa regra — defesa em profundidade.
3. Documentado em `docs/especificacoes/storefront/checkout.md` (Seção 16, hotfix 2026-05-18i).
