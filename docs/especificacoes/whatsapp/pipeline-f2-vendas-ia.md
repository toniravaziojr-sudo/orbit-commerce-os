# Pipeline F2 — Vendas IA no WhatsApp (Layer 3)

> Documento Layer 3. Define o comportamento funcional da pipeline conversacional
> de vendas no canal WhatsApp quando `ai_support_config.sales_mode_enabled = true`.
> Não substitui Layer 2 (regras macro, segurança, contratos transversais).
> Não substitui Layer 4 (arquitetura ampla do agente IA).

## 1. Escopo

Cobre o ciclo de uma conversa de vendas atendida pelo agente, do "oi" do cliente
até o handoff/checkout, organizado em estados discretos com tools liberadas por
estado. Aplica-se a todo tenant com modo vendas ligado. Independe de tema visual
da loja, política de imagem e provedor WhatsApp.

## 2. Máquina de estados

| Estado            | Função                                                                 |
| ----------------- | ---------------------------------------------------------------------- |
| `greeting`        | Primeiro contato. Apenas saudação curta + pergunta aberta.             |
| `discovery`       | Qualificação enxuta. Máx. 1 pergunta por turno, máx. 2 turnos no total.|
| `recommendation`  | Apresenta até 3 opções reais do catálogo, alinhadas à dor declarada.   |
| `product_detail`  | Detalha um produto específico (preço, descrição, foto, variantes).     |
| `decision`        | Cliente sinalizou compra. Confirma escolha sem requalificar.           |
| `checkout_assist` | Coleta dados mínimos e gera link de pagamento.                         |
| `support`         | Tópico de pedido existente / pós-venda. Sai do funil de venda.         |
| `handoff`         | Escalada humana. Estado terminal.                                      |

## 3. Transições — ordem de prioridade

A função `decideNextState` (`supabase/functions/_shared/sales-pipeline/transitions.ts`)
avalia, **nessa ordem**:

1. Tool `request_human_handoff` foi chamada → `handoff` (forced).
2. Mensagem casa padrão de **suporte** (pedido existente, rastreio, troca) → `support` (forced).
3. Link de checkout já gerado ou pedido explicitamente → `checkout_assist`.
4. Carrinho ativo ou `add_to_cart` chamada → `checkout_assist`.
5. Sinal claro de **compra** ("quero levar", "fecha pedido") → `decision`.
6. Cliente cita produto pelo nome (match com catálogo) → `product_detail`.
7. `get_product_details` ou `get_product_variants` foram chamadas → `product_detail`.
8. `search_products` ou `recommend_related_products` foram chamadas → `recommendation`.
9. **Cliente em `greeting`/`discovery` declara dor ou objetivo** → `recommendation`
   (forced, razão `pain_or_objective_declared_advance_to_recommendation`).
10. Discovery atingiu 2 turnos consecutivos → `recommendation` (forced).
11. Saída natural de `greeting` com pergunta de necessidade → `discovery`.
12. Saudação pura mantém `greeting`.
13. Default: mantém estado atual (`no_change_keep_state`).

Anti-regressão: `advanceTo` só permite avanço se `STATE_RANK[target] >= STATE_RANK[current]`,
exceto quando a transição é `forced`.

### 3.1 Detector de dor/objetivo

Heurística determinística (não usa modelo) em `transitions.ts`:

- Família de produto + qualquer continuação: "shampoo / creme / loção / balm /
  sérum / tônico / máscara / gel / sabonete / kit / combo".
- Dores: "calvície, queda, caindo, falha na coroa, coroa rala, caspa, seborréia,
  oleosidade, cabelo oleoso, couro cabeludo".
- Objetivos: "prevenir, prevenção, preventivo, tratar, tratamento, fortalecer,
  crescimento, pós-banho".

Quando casa, a transição **força** `recommendation` no mesmo turno e a tool
`search_products` é exposta.

## 4. Tool `search_products` — contrato

Implementação em `supabase/functions/ai-support-chat/index.ts`.

### 4.1 Input

| Param          | Tipo     | Default  | Descrição                                                                 |
| -------------- | -------- | -------- | ------------------------------------------------------------------------- |
| `query`        | string   | (req.)   | Família/nome do produto. Ex.: "shampoo", "Calvície Zero".                |
| `pain_hint`    | string   | `""`     | Dor/objetivo do cliente em linguagem natural. Aciona match por categoria. |
| `include_kits` | boolean  | `false`  | Só `true` em upsell ou pedido explícito de kit/combo.                     |
| `limit`        | number   | `5`      | Máximo de resultados na resposta.                                         |

### 4.2 Pipeline interno

1. **Normalização** da `query` (NFC, remove preço/travessões).
2. **Resolução pain → categoria**: léxico determinístico mapeia a frase do
   cliente para padrões de nome de categoria (`%calv%`, `%preven%`, `%caspa%`,
   `%oleos%`, `%pos%banho%`). Faz join com `categories` + `product_categories`
   para obter o conjunto de `product_id` da árvore compatível.
3. **Pool generoso**: busca até `limit × 6` produtos por:
   - ILIKE no `name` com a `query`.
   - União com os IDs do conjunto pain (se houver).
   - Fallback por tokens (3+ chars).
   - Último recurso: RPC `search_products_fuzzy`.
4. **Enriquecimento**: imagem primária, flag `is_kit`
   (fonte de verdade = `product_components`; backup ultra-conservador =
   prefixo `kit ` ou `combo ` no nome), `match_reason`
   (`pain_match` se o id está no conjunto pain, senão `name_match`).
5. **Particionamento e limit**:
   - Separa em `singles` (`is_kit=false`) e `kits` (`is_kit=true`).
   - Ordena cada lado por `match_reason="pain_match"` primeiro.
   - Devolve `singles.slice(0, limit)`. Só completa com kits se
     `include_kits=true` e ainda houver folga até `limit`.

### 4.3 Output (por item)

```ts
{
  id, name, slug, price, compare_at_price, stock,
  image, image_alt,
  is_kit, has_variants, manage_stock, allow_backorder,
  match_reason: "pain_match" | "name_match"
}
```

### 4.4 Tolerância a falha

Toda a etapa pain→categoria está sob `try/catch`. Se as tabelas de categoria
não puderem ser lidas, a tool segue sem o boost (recomendação volta a ser por
nome) e a falha é registrada via `console.warn` — não derruba a conversa.

## 5. Política produto único × kit

| Situação                                                          | O que sai      |
| ----------------------------------------------------------------- | -------------- |
| Primeira oferta após "queria um X"                                | Apenas únicos. |
| Cliente declarou dor                                              | Únicos com `pain_match` primeiro. |
| Cliente já escolheu produto base e a IA oferece upsell            | `include_kits=true`. |
| Cliente disse "kit", "combo", "leva mais", "pack", "promoção"     | `include_kits=true`. |
| Qualquer outra situação                                           | `include_kits=false`. |

A regra é imposta no servidor (particionamento + limit), não só no prompt.

## 6. Léxico dor → categoria

Definido em duas camadas alinhadas:

| Termo do cliente                                              | `pain_hint`     | Padrões de categoria          |
| ------------------------------------------------------------- | --------------- | ----------------------------- |
| calvície, queda, caindo, falha na coroa, coroa rala, ralo     | "calvície"      | `%calv%`, `%queda%`, `%tratamento%` |
| prevenir, prevenção, preventivo, fortalecer, crescimento      | "prevenção"     | `%preven%`, `%fortalec%`, `%crescimento%` |
| caspa, seborréia                                              | "caspa"         | `%caspa%`, `%seborr%`, `%anticaspa%` |
| oleosidade, cabelo oleoso, couro cabeludo                     | "oleosidade"    | `%oleos%`, `%couro%`          |
| pós-banho                                                     | "pós-banho"     | `%pos%banho%`, `%p[óo]s%banho%` |

Ampliação de léxico = edição apenas dos arquivos de prompt (`discovery.ts`,
`recommendation.ts`) e do mapa em `index.ts` (`painLexicon`). Não exige
migração nem mudança de schema.

## 7. Anti-padrões (proibidos)

- **Linguagem de sistema**: "encontrei esses produtos reais", "consultei o
  catálogo", "deixa eu ver", "vou buscar", "pelos dados que tenho", "segundo
  o sistema".
- **Pacote na 1ª oferta**: mostrar 6x/12x antes do cliente escolher o produto base.
- **Repetir pergunta de descoberta** depois que o cliente já declarou a dor.
- **Recomendar por proximidade textual** quando há dor declarada e árvore
  de categoria disponível no tenant.
- **Inventar produto** que não veio do `search_products`.

## 8. Observabilidade

Cada turno grava em `ai_support_turn_log`:

- `sales_state_before` / `sales_state_after`
- `pre_transition_reason` / `state_transition_reason`
- `pipeline_state_pre_routing` / `pipeline_state_after`
- `tools_available` / `tools_called`
- `metadata.discovery_turns_so_far`
- `metadata.prompt_module_used`
- `model_used`, `response_length`, `duration_ms`

Quando a transição vier por dor declarada, o motivo será literalmente
`pain_or_objective_declared_advance_to_recommendation`. Quando vier por limite
genérico, `discovery_limit_reached_advance_to_recommendation`. Os dois são
logs distintos para diagnóstico.

## 9. Travas estruturais (não negociar localmente)

- Não alterar máquina de estados sem revisão deste doc.
- Não mover regra de produto vs kit para o prompt — fica no servidor.
- Não condicionar oferta a popularidade/estoque sem que isso esteja explícito
  na regra deste doc.
- Não acrescentar dependência de imagem/checkout/cupom dentro de `recommendation`.

## 10. Pontos de extensão futuros (F3)

- Promover detector de dor para classifier multi-label.
- Mapear dor → atributos do produto (não só categoria), usando `tags` do
  catálogo.
- Personalização por cliente (histórico de compra) sobre o ranking de
  `pain_match` × `name_match`.
- Tool dedicada `recommend_by_objective` para compor jornada completa
  (shampoo + balm + loção da mesma linha).

## 11. Arquivos relevantes

- `supabase/functions/ai-support-chat/index.ts` — schema da tool `search_products`,
  implementação do `case "search_products"`, montagem do `decideNextState`.
- `supabase/functions/_shared/sales-pipeline/transitions.ts` — máquina de
  transição, detector de dor.
- `supabase/functions/_shared/sales-pipeline/states.ts` — enum + ranking.
- `supabase/functions/_shared/sales-pipeline/tool-filter.ts` — quais tools
  cada estado expõe.
- `supabase/functions/_shared/sales-pipeline/prompt-router.ts` — montagem
  do system prompt (base + estado + overlay do tenant + guardrails).
- `supabase/functions/_shared/sales-pipeline/prompts/*.ts` — prompts por
  estado, com `discovery.ts` e `recommendation.ts` ensinando o uso correto
  de `pain_hint` e `include_kits`.

## 12. Histórico

| Data       | Versão | Mudança                                                                 |
| ---------- | ------ | ----------------------------------------------------------------------- |
| 2026-04-23 | 1.0.0  | Documento criado. Camada 1 (particionamento + roteador por dor) e camada 2 (árvore de categoria do tenant) ativas em `ai-support-chat`. |
