## Diagnóstico real (causa raiz estrutural)

Re-li o código e os dados. O problema NÃO é a lógica de categorização — ela está deterministicamente correta. O problema é estrutural na forma como o diálogo pagina o lote para o edge `bulk_auto_categories`.

### Causa raiz
`supabase/functions/meli-bulk-operations/index.ts` na action `bulk_auto_categories` faz:

```ts
.eq("tenant_id", tenantId)
.in("status", [...])
.in("id", filterIds)
.range(offset, offset + limit - 1)   // <-- sem .order()
```

**Não há `ORDER BY`**. Postgres pode devolver as linhas em ordem diferente entre páginas (depende do plano, do cache, da concorrência), o que faz `OFFSET/LIMIT` produzir **sobreposições e lacunas**:

- Página 1 (offset 0, limit 5) pode trazer um conjunto.
- Página 2 (offset 5, limit 5) pode repetir 2 e perder 2.
- Listings repetidos são pulados (`if (listing.category_id) continue`), e os perdidos **nunca são processados** — ficam com `category_id NULL` e `updated_at` no carimbo da criação do rascunho.

Confirma no banco: todos os órfãos do tenant "Respeite o Homem" estão exatamente no mesmo timestamp `21:57:18.494946` (carimbo da criação do lote). Todos os categorizados têm timestamp posterior. Não é falha do cascata — é página perdida.

### Por que (3x) Dia categoriza e (2x) Dia não
Mesma família, mesmo `product_type` ("Shampoo, balm"), mesmo termo sanitizado ("Kit Banho Calvície Zero Dia"). Se a cascata rodasse para ambos, a saída seria idêntica. (3x) Dia caiu numa página que o Postgres devolveu; (2x) Dia caiu numa lacuna. Aleatório.

Ponto adicional: as actions `bulk_generate_titles` e `bulk_generate_descriptions` têm o mesmo padrão `range()` sem `order()` — mesma classe de bug latente.

## Plano estrutural (eficiente, sem mudança de UI nem de regra de negócio)

### Fix 1 — Garantir cobertura determinística no edge
Em `supabase/functions/meli-bulk-operations/index.ts`:

1. Em `bulk_auto_categories`, `bulk_generate_titles` e `bulk_generate_descriptions`:
   - Adicionar `.order("id", { ascending: true })` antes do `.range(...)`. Isso torna a paginação reprodutível.
   - **Quando `filterIds?.length` for fornecido**, ignorar `offset/limit/range` e processar **todos os IDs do filtro de uma vez** (a lista já vem bounded do diálogo, tipicamente ≤ 50). Elimina pagination drift na origem.
   - Manter `range()` apenas para a chamada sem `filterIds` (uso administrativo do botão "Recategorizar tudo").

2. Em `bulk_auto_categories`, devolver no payload de resposta `processedIds: string[]` (lista dos listingIds efetivamente tratados — categorizados, pulados ou que falharam). Isso permite ao diálogo auditar cobertura e re-tentar só o que faltou, sem chutar.

### Fix 2 — Diálogo audita cobertura e completa o que faltou
Em `src/components/marketplaces/MeliListingCreator.tsx` (função `handleCreateAndCategorize`, linhas 517-551):

1. Trocar o loop `while (hasMore) { offset += limit }` por **chunks explícitos do array `ids`** em JS:
   - Fatiar `ids` em pedaços de 5 e mandar cada pedaço como `listingIds: chunk` (sem `offset/limit`).
   - O edge processa exatamente esse pedaço (graças ao Fix 1).
2. Ao final, fazer uma **passada de reconciliação**:
   - Consultar `meli_listings` apenas pelos `ids` originais e isolar quem ainda está com `category_id IS NULL`.
   - Se restou alguém, disparar **uma única retentativa** desses faltantes em chunks de 5. Limite de 1 retry para não criar loop infinito.
   - O que sobrar após o retry segue como "não identificada" e o usuário continua podendo escolher manualmente no próprio diálogo (comportamento atual já cobre isso).
3. Em caso de erro de rede/timeout num chunk, **não quebrar o loop inteiro**: registrar a falha, continuar com os próximos chunks, e o passo de reconciliação no fim pega o que ficou.

### Fix 3 — Telemetria mínima para detectar recorrência
- No edge, logar por listing: `listingId | cascada vencedora | category_id resultante | razão se NULL`.
- Logar no início/fim de cada chamada: `received_ids_count`, `processed_ids_count`, `null_after_run_count`. Sem nova tabela; apenas `console.log` estruturado para investigação via `edge_function_logs`.

### O que NÃO mudo (e por quê)
- Cascata 1→4, gate de domínio, IA Decisora, sanitizador de termo, resumo cacheado — todos validados.
- UI/UX do diálogo (sem novos botões, sem novas etapas) — comportamento visual idêntico para o lojista.
- Schema do banco — sem migração.
- Os outros endpoints do edge que já operam só com `filterIds` curtos (bulk_titles/bulk_descriptions) recebem a mesma `.order("id")` por segurança anti-regressão, mas mantenho a paginação por compatibilidade com chamadas sem filtro.

### Validação técnica obrigatória pós-entrega
1. Build OK e deploy de `meli-bulk-operations`.
2. Limpar `category_id` dos órfãos atuais do Respeite o Homem (operação de saneamento, com aviso de "ação destrutiva controlada — só para limpar o estado residual deste bug", aguardando confirmação explícita antes de executar).
3. Disparar um novo lote pelo diálogo selecionando os mesmos produtos e confirmar via SQL que **todos** os listingIds enviados acabam com `category_id` preenchido OU explicitamente `NULL` por decisão da Cascata 4 (com log "ai-decider declarou nenhuma compatível"). Zero casos por "página perdida".
4. Reportar tabela final: listingId → produto → cascata vencedora → category_id.

### Documentação a atualizar (mesma entrega)
- `docs/especificacoes/marketplaces/mercado-livre.md` — seção "Cascata determinística do termo de busca": acrescentar que o fan-out por `filterIds` processa o conjunto completo sem pagination drift e que o diálogo faz reconciliação ao final.
- `.lovable/memory/constraints/ml-cadastro-fonte-unica.md` — registrar a regra: **"pagination drift proibido em ações em lote do MeLi; usar `filterIds` fan-out ou `.order('id')` + `.range()` deterministicamente"**.

## Dúvida / limitação
- **Ação destrutiva controlada**: para validar end-to-end com os mesmos produtos do tenant Respeite o Homem, preciso zerar `category_id`/`category_name`/`category_path_text` dos listings órfãos atuais antes de re-rodar o diálogo. Isso só roda após sua aprovação explícita. Sem essa limpeza, o cascata vai pular esses listings (porque já têm `category_id NULL` mas a categoria não foi salva — tudo bem, eles entram normal; na verdade não precisa limpar nada para os NULL. Só preciso confirmação para limpar **caso queira reprocessar listings que já foram categorizados errados**). Confirma?
- Se você quiser, posso reaproveitar o lote atual sem nenhuma operação destrutiva: basta abrir o diálogo, selecionar os mesmos produtos, e o novo fluxo cobre todos. Diga qual caminho prefere.

📌 STATUS DA ENTREGA: Plano pronto, aguardando aprovação para implementar e validar.
