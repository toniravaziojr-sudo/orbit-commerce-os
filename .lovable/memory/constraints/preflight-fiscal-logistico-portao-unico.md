---
name: Pré-flight fiscal/logístico — portão único obrigatório
description: Toda validação de campos obrigatórios para NF, Declaração de Conteúdo e Remessa passa pelo motor único `_shared/fiscal-shipping-preflight.ts`. Proibido módulo criar checagem isolada das mesmas regras. Aplicado em fiscal-create-manual, correios-content-declaration-issue e shipping-create-shipment antes de qualquer chamada externa.
type: constraint
---

# Pré-flight fiscal/logístico unificado

## Regra

1. A função `runPreflight()` em `supabase/functions/_shared/fiscal-shipping-preflight.ts` é a **fonte única** das regras de campos obrigatórios para os 4 escopos: `nf`, `dc`, `shipment`, `emitente`.
2. Toda edge function que grava PV ou que faz chamada externa para SEFAZ/Correios DEVE rodar `runPreflight()` com os escopos relevantes antes de prosseguir. Mapeamento atual:
   - `fiscal-create-manual` (modo `pedido_venda`): escopo `nf` antes de inserir o registro. Bloqueia com HTTP 400 e código `PREFLIGHT_BLOCKED`.
   - `correios-content-declaration-issue`: escopos `dc` + `emitente`.
   - `shipping-create-shipment` (branch Correios): escopos `shipment` + `emitente` antes da chamada `/prepostagem/v1/prepostagens`. Quando bloqueia, marca `shipments.delivery_status='failed'` e grava `metadata.error_message` em PT-BR — rascunho cai na aba "Pendentes".
3. Mensagens de erro são SEMPRE em PT-BR, voltadas ao operador (sem nome de campo técnico, sem `weight_required`/`phone_invalid` etc.). O motor já consolida em `result.message`.
4. Campos canônicos (fonte: este motor):
   - **Destinatário:** nome, CPF/CNPJ (11 ou 14), telefone com DDD (10–13 dígitos), CEP 8 dígitos, logradouro, número, bairro, município, UF; código IBGE só para NF.
   - **Item:** descrição, quantidade > 0, valor unitário ≥ 0, NCM 8 dígitos (NF), peso unitário > 0 g (DC/Shipment).
   - **Embalagem:** peso total > 0 g, altura/largura/profundidade > 0 cm, transportadora.
   - **Emitente:** razão social, CNPJ, telefone, CEP, logradouro, número, bairro, município, UF.
5. Vínculo fiscal obrigatório para Remessa Correios: `hasNfe=true` OU `hasDC=true`. Sem nenhum, bloqueia com mensagem PT-BR padrão.

## O que NUNCA pode acontecer

- Outro módulo recriar checagens isoladas das mesmas regras. Tudo passa pelo motor.
- Chamar Correios/SEFAZ sem rodar o motor antes — o parser de erro do provedor (mem `correios-cws-prepostagem-payload-and-error-parser`) é defesa final, não substituto do gate.
- PV manual/duplicado ser salvo com lacuna estrutural sem 400.
- Mensagens em inglês/técnicas chegando ao usuário.
- Mudar UI (painel de pendências em tempo real, indicador da loja, texto da aba Pendentes) sem aprovação explícita do usuário do produto.

## Arquivos

- Motor: `supabase/functions/_shared/fiscal-shipping-preflight.ts`.
- Consumidores atuais: `supabase/functions/fiscal-create-manual/index.ts`, `supabase/functions/shipping-create-shipment/index.ts`.
- Doc formal: `docs/especificacoes/fiscal/preflight-fiscal-logistico.md` (Layer 2).
- Relacionado: `mem://features/fiscal/mandatory-data-enforcement-standard`, `mem://constraints/correios-cws-prepostagem-payload-and-error-parser`, `mem://constraints/shipment-mirrors-pedido-venda-em-aberto`.
