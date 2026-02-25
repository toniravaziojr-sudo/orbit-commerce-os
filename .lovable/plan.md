
Objetivo
- Corrigir definitivamente os dois sintomas reportados no fluxo de anúncios do Mercado Livre:
  1) títulos gerados ficando curtos/truncados (“Hom”, “Calv”, “Pós-Ban” etc.);
  2) dificuldade de rolagem no passo de Títulos quando há muitos itens.

Contexto e regras lidas antes do plano
- Li as regras obrigatórias para este módulo:
  - `docs/regras/mercado-livre.md`
  - `docs/regras/edge-functions.md`
  - `docs/regras/regras-gerais.md`
- Também validei o estado atual do código e backend relacionado:
  - `src/components/marketplaces/MeliListingCreator.tsx`
  - `src/components/marketplaces/MeliListingWizard.tsx`
  - `supabase/functions/meli-bulk-operations/index.ts`
  - `supabase/functions/meli-generate-description/index.ts`
  - `supabase/functions/meli-search-categories/index.ts`
  - `supabase/functions/meli-publish-listing/index.ts`
- Validação adicional no banco:
  - `meli_listings.title` é `text` (sem limite SQL fixo).

Diagnóstico de causa raiz (o que está quebrando hoje)
1) Truncamento forçado ainda existe no frontend
- Em `MeliListingCreator.tsx`, ao salvar títulos para próxima etapa, ainda há:
  - `title: item.title.slice(0, 60)`
- Isso corta qualquer título acima de 60, mesmo após mudanças anteriores.
- Em `MeliListingWizard.tsx` ainda há múltiplos pontos com `slice(0, 60)` e `maxLength={60}`.

2) Gerador em massa ainda persiste títulos inválidos na última tentativa
- Em `meli-bulk-operations/index.ts`, no fluxo `bulk_generate_titles`, quando a última tentativa falha na validação, o código ainda aceita o candidato inválido:
  - `if (attempt === MAX_TITLE_ATTEMPTS) finalTitle = title;`
- Isso explica títulos terminando “cortados” apesar da validação semântica.

3) Limite de título deve ser por categoria (não hardcode fixo global)
- Pesquisa/documentação oficial do Mercado Livre indica que o limite vem de `max_title_length` na categoria (`GET /categories/{id}`), não um único valor universal.
- Portanto, o correto é validar com base na categoria selecionada (ou ao publicar).

4) Risco de UX de rolagem no modal
- O modal já está em layout flex + footer fixo, mas os passos com lista usam `ScrollArea` com `max-h-[400px]`.
- Em cenários com muitos itens e viewport variado, isso pode gerar comportamento inconsistente de rolagem.
- Padrão interno recomendado para wizards/dialogs complexos é corpo com `flex-1 overflow-y-auto`.

Confirmação do que você pediu
- Você pediu explicitamente: “pesquise até quantos chars o Mercado Livre aceita e coloque no máximo”.
- Diretriz adotada no plano: usar limite dinâmico por categoria (`max_title_length` da API do ML), em vez de valor fixo arbitrário.

Plano de implementação (execução proposta)
Fase 1 — Corrigir truncamentos e validação no pipeline de títulos
1. `src/components/marketplaces/MeliListingCreator.tsx`
   - Remover o `slice(0, 60)` de `handleSaveTitles`.
   - Ajustar validação de título para bloquear finais claramente truncados.
   - Ajustar aviso de contagem para não pressupor 60 fixo.
2. `src/components/marketplaces/MeliListingWizard.tsx`
   - Remover todos os `slice(0, 60)` no pré-fill e regeneração.
   - Trocar `maxLength={60}` por limite dinâmico (ou fallback temporário alto até resolver categoria).
   - Atualizar contador visual para refletir limite real.
3. `supabase/functions/meli-bulk-operations/index.ts`
   - Alterar fluxo `bulk_generate_titles` para NUNCA salvar candidato inválido na última tentativa.
   - Se todas as tentativas falharem, usar fallback robusto (como já existe no `meli-generate-description`) e só persistir título válido.
   - Incrementar `VERSION` conforme regra de edge function.
4. `supabase/functions/meli-generate-description/index.ts`
   - Manter consistência de validação semântica/fallback entre geração unitária e geração em massa.
   - Ajustes finos se necessário para garantir que o último token não saia “quebrado”.
   - Incrementar `VERSION` se houver alteração.

Fase 2 — Limite correto por categoria (fonte oficial ML)
5. `supabase/functions/meli-search-categories/index.ts`
   - Incluir `max_title_length` no payload de resposta quando consultar categoria (`categoryId` e/ou resultados enriquecidos).
   - Incrementar `VERSION` e manter CORS/contrato `{ success: true/false }`.
6. Frontend (Creator/Wizard)
   - Armazenar `max_title_length` por item após categoria definida.
   - Aplicar validação final usando esse valor.
   - Exibir helper claro: “Limite desta categoria: X caracteres”.
7. `supabase/functions/meli-publish-listing/index.ts` (guard rail final)
   - Antes do POST de publicação, consultar categoria no ML e validar `title.length <= max_title_length`.
   - Se exceder: retornar erro de negócio padronizado (`success: false`) com mensagem objetiva para ajuste.
   - Evita ida e volta com erro genérico da API externa.

Fase 3 — Corrigir UX de rolagem no modal
8. `src/components/marketplaces/MeliListingCreator.tsx`
   - Nos passos com listas longas (principalmente Títulos), trocar área rolável para padrão estável:
     - corpo: `flex-1 min-h-0 overflow-y-auto`
     - footer: fixo com `shrink-0 border-t`
   - Garantir que o usuário consiga rolar até o último item em qualquer resolução/zoom.
   - Preservar comportamento atual de botões (“Voltar/Continuar” sempre visíveis).

Fase 4 — Validação completa e anti-regressão
9. Testes funcionais (manual guiado)
   - Criar lote com muitos produtos (>=15) e confirmar rolagem completa no passo Títulos.
   - Regenerar títulos em massa e individualmente; verificar ausência de finais truncados.
   - Confirmar avanço de etapa com validações corretas.
   - Publicar anúncio com título no limite da categoria e acima do limite para verificar bloqueio/mensagem.
10. Verificação de dados
   - Conferir no banco os títulos salvos pós-ajuste (sem cortes artificiais).
   - Garantir compatibilidade com anúncios já existentes.

Arquivos que serão afetados
- `src/components/marketplaces/MeliListingCreator.tsx`
- `src/components/marketplaces/MeliListingWizard.tsx`
- `supabase/functions/meli-bulk-operations/index.ts`
- `supabase/functions/meli-search-categories/index.ts`
- `supabase/functions/meli-publish-listing/index.ts`
- (Possivelmente) `supabase/functions/meli-generate-description/index.ts` para alinhamento de regras

Critérios de aceite
- Não existe mais nenhum `slice(0, 60)` no fluxo de títulos do Mercado Livre.
- Nenhum título inválido/truncado é persistido por fallback de última tentativa.
- Limite de título passa a ser por categoria (`max_title_length`), não hardcoded global.
- O passo “Títulos” permite rolagem completa com muitos itens.
- Mensagens de validação ficam claras e acionáveis para o usuário.

Seção técnica (detalhes para implementação)
```text
Arquitetura alvo do título:

[IA gera candidato] 
   -> sanitize
   -> validate semantic (final não truncado)
   -> validate length (dinâmico por categoria quando disponível)
   -> persist only if valid
   -> senão retry (até N)
   -> fallback seguro (nunca inválido)
   -> persist

Guards obrigatórios:
- Frontend guard: bloqueia avanço quando inválido
- Backend guard (bulk): não salva inválido no final
- Publish guard: valida contra max_title_length real da categoria
```

Observações importantes
- Não há necessidade de migração de banco para esta correção.
- A regra mais importante aqui é retirar truncamento artificial e adotar limite real por categoria (fonte oficial do marketplace), exatamente como você pediu.
- Após implementar, também vou alinhar a documentação do módulo Mercado Livre para refletir “limite dinâmico por categoria” e remover ambiguidades 60 vs 120.
