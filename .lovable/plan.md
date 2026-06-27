## Objetivo
Fechar a categorização automática do Mercado Livre adicionando uma **Cascata 4 — IA Decisora** como fallback inteligente antes de cair em "pendente para edição manual". Hoje o gate de confiança (v1.12.0) protege contra categorias absurdas, mas é binário: ou aceita o que o ML devolve, ou deixa em branco. Falta a etapa em que a IA realmente *escolhe* entre as candidatas reais do ML.

## Fluxo final acordado
1. **Cascata 1** — Nome sanitizado + Tipo de produto → ML decide. Se passar no gate → fim.
2. **Cascata 2** — Nome + Resumo IA cacheado → ML decide. Se passar no gate → fim.
3. **Cascata 3** — Nome + Marca → ML decide. Se passar no gate → fim.
4. **Cascata 4 (NOVA) — IA Decisora**:
   - Coletar **todas** as categorias candidatas que o ML devolveu nas 3 cascatas anteriores (mesmo as bloqueadas pelo gate), deduplicadas por `category_id`.
   - Para cada candidata, hidratar o **caminho completo** (`path_from_root`) consultando `/categories/{id}` (com cache em memória por execução para evitar refetch).
   - Pedir à IA (Gemini Flash via router padrão, JSON estruturado) que escolha a melhor `category_id` com base em: nome do produto, tipo, tipo IA, marca, descrição curta, composição, resumo cacheado. A IA recebe a lista enumerada de candidatas (id + caminho completo) e devolve `{ chosen_category_id, confidence, reason }` ou `{ chosen_category_id: null }` se nenhuma servir.
   - O resultado da IA **ainda passa pelo mesmo gate de domínio** (`categoryMatchesProductDomain`). Defesa em profundidade: se a IA escolher algo incompatível com a família detectada, rejeita e cai para o passo 5.
5. **Fallback final** — Pendente (`category_id = NULL`) para edição manual no diálogo. Comportamento preservado.

## Princípios de custo e segurança
- Cascata 4 só roda quando 1, 2 e 3 falharam no gate. Produtos categorizados de primeira nunca disparam a IA decisora.
- Reaproveita o resumo cacheado da v1.11.0 (sem regerar).
- Sem novas tabelas, sem cron, sem fila. Chamada síncrona única por produto órfão.
- Gate continua sendo última palavra (regra "pendente é melhor que errado").
- Cadastro continua fonte única — IA escolhe categoria, nunca preenche campos do produto.

## Arquivos técnicos impactados
- `supabase/functions/meli-bulk-operations/index.ts` — adicionar coleta de candidatas em cada cascata, função `aiPickBestCategory(candidates, productContext)` e novo passo antes do "deixa em branco". Usar `aiChatCompletionJSON` do `_shared/ai-router.ts` (regra `ai-provider-router-standard`).
- Nenhuma migração. Nenhuma mudança de UI/UX (diálogo de envio segue igual; produto pendente continua aparecendo como pendente até a IA escolher).

## Validação técnica obrigatória pós-entrega
1. Build OK e deploy da `meli-bulk-operations`.
2. Limpar `category_id` dos 6 produtos órfãos do tenant Respeite o Homem (Fast Upgrade, Kits Banho, Kit Zero Falhas) via SQL controlado.
3. Reprocessar via edge function e capturar log da cascata: quais candidatas vieram, qual a IA escolheu, se passou no gate.
4. Confirmar no banco que produtos categorizados antes (Shampoos, Bálsamos, Suplementos) não sofreram regressão.
5. Confirmar que produtos genuinamente sem encaixe continuam `NULL` (raríssimo, mas precisa funcionar).
6. Reportar para o usuário a tabela: produto → categoria escolhida → caminho completo → fonte (cascata 1/2/3/4 ou pendente).

## Documentação a atualizar (mesma entrega)
- `docs/especificacoes/marketplaces/mercado-livre.md` — adicionar a Cascata 4 ao fluxo de categorização, descrevendo: insumos para a IA, formato de resposta, fato de o gate de domínio se aplicar também à escolha da IA, e quando cai em pendente.
- `.lovable/memory/constraints/ml-cadastro-fonte-unica.md` — registrar que a IA pode escolher categoria entre candidatas reais do ML, mas nunca inventa categoria e nunca preenche campos do cadastro; gate continua soberano.

## Decisões técnicas que tomo por conta (dentro do critério dado)
- Modelo: Gemini Flash via `aiChatCompletionJSON` (router padrão, fallback automático).
- Sem cache persistente da escolha — cada reprocessamento reavalia (volume é baixíssimo, só produtos órfãos, custo desprezível).
- Hidratação de `path_from_root` em memória dentro da mesma execução (evita refetch quando vários produtos compartilham candidatas).
- Limite de 8 candidatas enviadas à IA (suficiente; mais que isso = ruído).
- Timeout curto (10s) na chamada da IA; se estourar, cai em pendente sem travar o batch.

## O que NÃO vou tocar sem aprovação
- UI do diálogo de envio, painel de atributos, cadastro do produto.
- Lista de campos obrigatórios do `mlReadiness`.
- Regras do gate de domínio (continua igual).
- Geração/cache do resumo (v1.11.0 inalterado).
- Núcleo Produtos/Clientes/Pedidos.

## Dúvidas / limitações conhecidas
- Nenhuma bloqueante. Único ponto de atenção: se as 3 cascatas anteriores não devolverem nenhuma candidata (ML retornar vazio em todas), a Cascata 4 não tem o que avaliar e cai direto em pendente — comportamento correto e desejado.

📌 STATUS DA ENTREGA: Plano pronto, aguardando aprovação para implementar, validar tecnicamente e atualizar docs.