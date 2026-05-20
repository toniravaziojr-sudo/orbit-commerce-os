---
name: Fiscal Severity Hierarchy
description: Hierarquia de severidade de alertas no editor Fiscal (PV/NF) — vermelho bloqueia emissão, amarelo é só aviso.
type: constraint
---

# Hierarquia de Severidade — Editor Fiscal (Pedido de Venda / Nota Fiscal)

**Regra firme (rev 2026-05-20):**

- **VERMELHO (variant="destructive"):** usado SOMENTE para pendências que **bloqueiam a emissão**. Inclui:
  - Item sem peso (gramas)
  - Item sem NCM (ou NCM != 8 dígitos)
  - Item sem origem
  - Item sem GTIN (ou "SEM GTIN")
  - Item sem descrição / CFOP inválido
  - Cliente sem CPF/CNPJ
  - Endereço incompleto (logradouro, número, CEP, município/UF)
  - Rejeição SEFAZ
  - Erros de validação retornados pelo `fiscal-prepare-invoice`

- **AMARELO / ÂMBAR (border-amber-*):** usado SOMENTE para **avisos não-bloqueantes** que valem revisar mas NÃO impedem emissão. Ex.:
  - Telefone/e-mail do destinatário ausente ou suspeito
  - Pequenas inconsistências cosméticas

## Por que existe
Antes da rev 2026-05-20, o editor mostrava pendências obrigatórias e avisos opcionais ambos em amarelo, gerando confusão visual e fazendo o lojista achar que tudo era "só recomendação". Causa raiz: variant uniforme + ausência de regra escrita.

## O que NUNCA fazer
- Pendência obrigatória em amarelo.
- Aviso opcional em vermelho (cria pânico desnecessário).
- Misturar mensagens dos dois grupos no mesmo Alert.
- Criar uma 3ª cor intermediária (laranja, etc.) — apenas 2 níveis.

## Onde a regra é aplicada hoje
- `src/components/fiscal/InvoiceEditor.tsx`
  - Banner de `pendenciaMotivos` → vermelho (destructive)
  - Banner de `itemsWithIssues` (NCM/GTIN/Origem/etc.) → vermelho (destructive)
  - Banner de `pendenciaAvisos` → amarelo (border-amber)
  - SEFAZ rejection / validationErrors → vermelho (destructive)
  - Vínculo com NF gerada → roxo (informativo neutro, separado dessa regra)

## Anti-regressão
Qualquer novo tipo de alerta adicionado ao editor (ou outras telas de Fiscal) DEVE classificar explicitamente: "bloqueia emissão?" → vermelho; "apenas alerta?" → amarelo. Em PR / commit que altere severidade desses banners, citar esta memória.
