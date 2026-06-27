
## Objetivo
Aumentar a taxa de categorização automática no Mercado Livre sem desperdiçar processamento, usando o `tipo de produto` do cadastro como termo primário e, quando ele estiver vazio ou não bater, um resumo curto gerado por IA a partir da leitura completa do cadastro — gerado uma única vez e reaproveitado até que o cadastro mude.

## Decisão técnica (revisada após releitura dos docs e histórico)
Mantenho a direção que conversamos. Duas pequenas revisões em relação ao que tinha esboçado:

1. **Resumo é pré-computado e cacheado por produto, não por anúncio.** O cadastro é a fonte única; o anúncio é só consumidor. Assim, vários anúncios do mesmo produto reaproveitam o mesmo resumo.
2. **Invalidação por assinatura (hash) do cadastro, não por timestamp.** Mais robusto: se nada relevante mudou, não regera; se mudou qualquer campo de entrada, regera no próximo uso. Sem cron, sem trigger pesado.

## Como funcionará

### Cascata de termo de busca enviado ao Mercado Livre
1. **Primário:** `nome sanitizado + tipo de produto` (do cadastro). Sem IA, sem custo.
2. **Fallback 1 (se primário não retornar categoria confiável):** `nome sanitizado + resumo IA cacheado` (≤ 80 caracteres, formato funcional).
3. **Fallback 2 (último recurso):** `nome sanitizado + marca` (já existe hoje).
4. Se tudo falhar → fica em **Pendências** para seleção manual (comportamento atual preservado).

A sanitização atual (`(3x)`, `kit com 2`, etc.) continua aplicada em todas as etapas.

### Geração e cache do resumo IA
- Campo novo no cadastro do produto guarda dois valores: o resumo e a assinatura do conteúdo que o gerou.
- Resumo é gerado **sob demanda**, na primeira vez que a categorização precisar do fallback. Não roda batch, não roda no save do produto.
- Antes de gerar, calcula a assinatura atual do cadastro (nome + tipo + descrição curta + descrição longa + composição + marca). Se bater com a assinatura salva, reusa o resumo. Se diferir, regera uma vez e atualiza ambos.
- Modelo: Gemini Flash-Lite via Lovable AI Gateway (barato, rápido, sem tools). Saída estruturada para garantir formato.
- Prompt instrui a IA a ler todo o cadastro e devolver um resumo funcional curto no formato "TIPO + atributo essencial + volume/quantidade", sem adjetivos comerciais, sem nome da marca, sem benefícios. Exemplo do alvo: "Shampoo anticaspa masculino 250ml".
- Limite duro de tamanho aplicado em código (corte seguro mesmo se a IA exceder).

### Custo e segurança
- Produto categorizado de primeira (cascata 1) **nunca** dispara IA.
- Produto que precisa do fallback dispara IA **uma vez por versão do cadastro**.
- Sem cron, sem fila, sem reprocessamento em massa.
- Cadastro continua sendo fonte única (regra `ml-cadastro-fonte-unica`); o resumo é metadado derivado, não substitui campos.

## Arquivos técnicos (referência)
- `supabase/functions/meli-bulk-operations/index.ts` — onde mora a categorização hoje. Vou inserir a cascata nova nos dois pontos que chamam `domain_discovery/search` (loop principal e `auto_suggest`).
- Tabela `products` — duas colunas novas: resumo cacheado + assinatura. Migração simples, sem impacto em RLS existente.
- Helper compartilhado novo em `supabase/functions/_shared/meli/` para: (a) calcular assinatura, (b) ler/gerar/persistir o resumo, (c) montar os termos de busca da cascata.

## Validação técnica obrigatória pós-entrega
- Reprocessar os 13 produtos órfãos do tenant "Respeite o Homem" e medir quantos passam a categorizar.
- Confirmar via log que produtos com `tipo de produto` preenchido **não** disparam IA.
- Confirmar via banco que o resumo só é regerado quando a assinatura do cadastro muda (editar e re-categorizar).
- Confirmar que produto novo recém-criado sem `tipo de produto` cai no fallback IA e categoriza.

## Documentação a atualizar
- `docs/especificacoes/marketplaces/mercado-livre.md` — nova seção descrevendo a cascata de termo de busca, o resumo cacheado e a regra de invalidação por assinatura.
- `.lovable/memory/constraints/ml-cadastro-fonte-unica.md` — registrar que o resumo é metadado derivado (não viola fonte única) e que IA nunca preenche campos do cadastro.

## O que estou decidindo por conta (técnico/fluxo, dentro do seu critério)
- Cache no próprio `products` em vez de tabela nova (menos joins, menos custo).
- Invalidação por hash de conteúdo (mais barata que trigger no UPDATE; só recalcula quando alguém realmente vai usar).
- Geração lazy sob demanda (evita gasto em produtos que nunca serão anunciados no ML).
- Modelo barato com output estruturado (sem tools, sem multi-turn).

## O que NÃO vou tocar sem você aprovar
- Nenhuma mudança de UI/UX no cadastro do produto, no diálogo de anúncio ou no painel de atributos.
- Nenhuma mudança nas regras de negócio do core (Produtos/Clientes/Pedidos).
- Nenhuma mudança na lista de campos obrigatórios do `mlReadiness`.
- Nenhuma alteração nos demais fallbacks já consolidados.

## Dúvidas / limitações conhecidas
- Nenhuma bloqueante. Único ponto de atenção: se o `tipo de produto` no cadastro estiver preenchido com algo genérico tipo "Cuidados pessoais", o primário pode falhar — mas é exatamente para isso que o fallback IA existe.

📌 STATUS DA ENTREGA: Diagnóstico fechado. Plano pronto, aguardando sua aprovação para implementar.
