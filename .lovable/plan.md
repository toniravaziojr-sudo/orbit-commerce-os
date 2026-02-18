

# Implementação v5.9.8: 4 Correções no Ads Chat + Preview de Imagem

## Correção 1: Matching de Produto por Nome Exato

**Arquivo**: `supabase/functions/ads-chat/index.ts` (linhas 1991 e 2034)

O `.includes()` atual causa ambiguidade entre variantes como "Kit Banho Calvície Zero", "Kit Banho Calvície Zero (2x) Noite", etc.

Novo algoritmo de 3 níveis (aplicado em `generateCreativeImage` e `createMetaCampaign`):

```text
1. Match exato (case-insensitive, trimmed)
2. Starts with (pega produto base sem variantes)
3. Includes com preferência pelo nome mais curto (fallback seguro)
4. Último fallback: primeiro produto da lista
```

---

## Correção 2: Autonomia da IA (Regra de "continuar")

**Arquivo**: `supabase/functions/ads-chat/index.ts` (linhas 2904-2907 e 2918-2919)

**Regra atual** (errada): A IA sempre pede ao lojista para dizer "continuar" entre rodadas.

**Nova regra**: A IA usa os rounds internos (1-5) automaticamente para completar todo o plano. A pausa para pedir "continuar" so deve existir se o proprio lojista solicitar acompanhamento passo-a-passo (ex: "me avise quando terminar cada etapa"). Fora isso, execucao autonoma e continua.

Mudancas no prompt:
- Linhas 2904-2907: Trocar "Aguarde confirmação e informe ao lojista" por "Use o round seguinte AUTOMATICAMENTE"
- Linhas 2918-2919: Trocar "Envie continuar para eu criar as proximas 2" por instrucao de continuar automaticamente, so pausar se o lojista pediu

---

## Correção 3: Preview de Imagem no Card de Ação

**Arquivo**: `src/components/ads/ActionDetailDialog.tsx`

Quando o card de acao tem `creative_job_id` mas nao `asset_url`, o componente mostra apenas texto "Criativos sendo processados". A correcao adiciona uma query ao banco para buscar o resultado do job (`creative_jobs.output_urls`) e exibir as imagens se ja estiverem prontas.

Mudancas:
- Adicionar import de `useQuery` e `supabase`
- Criar query que busca `creative_jobs` pelo `job_id` quando o dialog abre com acao `generate_creative`
- No `CreativePreview`, se houver `output_urls` do job, exibir as imagens em grid
- Se o job ainda estiver `running`, manter o texto de "processando"

---

## Correção 4: Instrução de Nome Exato no Prompt

**Arquivo**: `supabase/functions/ads-chat/index.ts`

Adicionar instrucao no system prompt: "Ao chamar generate_creative_image ou create_meta_campaign, use o nome EXATO do produto conforme listado no catalogo. NAO abrevie, NAO generalize. Se o catalogo lista 'Shampoo Calvicie Zero' e 'Shampoo Calvicie Zero (2x)', estes sao produtos DIFERENTES."

---

## Resumo de Arquivos

| Arquivo | Mudancas |
|---------|----------|
| `supabase/functions/ads-chat/index.ts` | Fix matching (linhas 1991 e 2034) + prompt autonomia (linhas 2904-2907 e 2918-2919) + instrucao nome exato + VERSION v5.9.8 |
| `src/components/ads/ActionDetailDialog.tsx` | Query para buscar preview de imagem do `creative_jobs` quando `job_id` presente |

