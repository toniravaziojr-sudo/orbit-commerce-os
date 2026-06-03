# Pré-Flight Fiscal/Logístico — Portão Único de Validação

**Layer:** 2 (regra macro, contrato e fonte de verdade)
**Status:** vigente desde 2026-06-02

## Por que existe

Antes desta regra, cada emissão (NF, Declaração de Conteúdo, Remessa)
tinha sua própria lista de campos obrigatórios, aplicada **só no momento da
emissão final**. Resultado: Pedidos de Venda manuais ou duplicados nasciam
incompletos, seguiam silenciosamente pelo sistema, e a falha aparecia
apenas quando o operador tentava emitir a DC ou despachar a remessa —
muitas vezes com mensagens técnicas vindas direto dos Correios/SEFAZ.

A correção é **unificar as listas em um portão único** e **rodá-lo cedo**,
sempre que o Pedido de Venda for salvo e antes de qualquer chamada externa.

## O motor

Implementação: `supabase/functions/_shared/fiscal-shipping-preflight.ts`.

Expõe a função `runPreflight(input)` que recebe um conjunto de escopos a
validar (`nf`, `dc`, `shipment`, `emitente`) e devolve a lista de
pendências em PT-BR, separadas em **bloqueantes** (severity `block`) e
**avisos** (severity `warn`), além de uma mensagem consolidada pronta
para toast.

### Escopos e quem usa

| Escopo       | O que valida                                                                                                       | Consumido por                                              |
| ------------ | ------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------- |
| `nf`         | Destinatário + endereço completo + CPF/CNPJ válido + itens com NCM válido + descrição/quantidade/valor             | `fiscal-create-manual` (salvar PV), `fiscal-prepare-invoice` |
| `dc`         | Mesmo de NF + telefone com DDD + **peso unitário do produto** cadastrado                                           | `correios-content-declaration-issue`                       |
| `shipment`   | Mesmo de DC + peso total e dimensões da embalagem > 0 + transportadora + vínculo fiscal (NF autorizada **ou** DC)  | `shipping-create-shipment` (branch Correios)               |
| `emitente`   | Razão social + CNPJ + IE + telefone + endereço completo da loja (de `fiscal_settings`)                             | Qualquer um dos 3, sempre que houver chamada externa real  |

### Campos canônicos (fonte única)

**Destinatário** (do Pedido de Venda):
nome, CPF/CNPJ (11 ou 14 dígitos), telefone com DDD (10–13 dígitos),
CEP (8 dígitos), logradouro, número, bairro, município, UF, código IBGE
do município (só para NF).

**Item:** descrição, quantidade > 0, valor unitário >= 0, NCM (8 dígitos,
só para NF), peso unitário > 0 g (para DC/Remessa).

**Embalagem:** peso total > 0 g, altura/largura/profundidade > 0 cm,
transportadora informada.

**Emitente** (loja, de `fiscal_settings` ou `shipping_providers.settings`):
razão social, CNPJ, telefone, CEP, logradouro, número, bairro, município, UF.

## Pontos onde o motor é aplicado

1. **Salvar PV manual ou duplicado** — `fiscal-create-manual` roda o
   escopo `nf` antes de inserir o registro. Se bloquear, devolve 400 com
   código `PREFLIGHT_BLOCKED` e a lista de pendências em PT-BR.
2. **Emitir Declaração de Conteúdo** — `correios-content-declaration-issue`
   roda os escopos `dc` + `emitente`.
3. **Despachar remessa pelos Correios** — `shipping-create-shipment` roda
   os escopos `shipment` + `emitente` antes de chamar a API. Quando
   bloqueia, o erro é gravado em `shipments.metadata.error_message` e o
   rascunho vai para `delivery_status='failed'` (aba **Pendentes**).
4. **Cadastro do emitente** — qualquer chamada externa que dependa de
   dados da loja roda também o escopo `emitente` para evitar rejeição
   no servidor remoto.

## O que NUNCA pode acontecer

- Qualquer módulo recriar checagens isoladas dessas mesmas regras. Toda
  validação destes 4 escopos passa por `runPreflight`.
- Chamar Correios/SEFAZ sem rodar o motor. O erro técnico do provedor
  externo nunca pode chegar como toast cru ao operador.
- PV manual ou duplicado ser salvo com lacuna estrutural. O 400 é
  obrigatório.
- Mensagens de erro técnico em inglês (ex.: `weight_required`,
  `phone_invalid`) chegarem ao usuário. Toda mensagem é PT-BR.

## Anti-regressão

- Memória: `mem://constraints/preflight-fiscal-logistico-portao-unico`.
- Constraint cruzada: `mem://constraints/correios-cws-prepostagem-payload-and-error-parser`
  continua valendo para o parser de erro dos Correios — o motor é o
  **gate prévio**, o parser é a **defesa final**.
- Memória: `mem://constraints/pv-deve-herdar-contato-do-pedido` — 3 camadas
  (origem na criação automática, auto-cura na emissão da DC, gatilho de
  banco) garantem que o Pedido de Venda nunca nasça nem fique sem telefone
  e e-mail do destinatário quando o pedido original possui esses dados.

## Roadmap (depende de aprovação de UI/UX)

O motor já está pronto para alimentar 3 melhorias de UI que **dependem de
aprovação explícita do operador do produto**:

1. Painel de Pendências em tempo real no diálogo de PV (vermelho/amarelo).
2. Indicador "Loja pronta para emitir / Configuração pendente" no módulo
   Fiscal.
3. Mensagem amigável na aba **Pendentes** de Remessas substituindo o
   erro técnico atual.

Enquanto a UI não muda, o motor já protege todos os fluxos de gravação e
emissão a partir do backend.
