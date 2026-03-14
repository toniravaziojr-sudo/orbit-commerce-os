
Diagnóstico profundo (confirmado)
- O bug não está no bloco Banner em si; está no fluxo de persistência para páginas de `store_pages`.
- Evidência de dados:
  - `store_pages.content` da página **Como Comprar** não contém o Banner salvo.
  - `store_page_versions` da mesma página contém versões recentes com `Section -> [Container, Banner]`.
- Causa estrutural principal:
  - Em `VisualBuilder`, o `saveDraft/publish` legacy envia `pageType` como `undefined` quando `entityType === 'page'`.
  - Isso desvia do caminho especial de páginas institucionais e cai no fluxo de versionamento genérico.
  - O editor (`PageBuilder`) carrega de `store_pages.content`, então após salvar ele volta para conteúdo antigo (rollback visual imediato).
- Causa secundária:
  - O gate anti-rollback pode ser liberado cedo por atualização otimista de cache, permitindo novo sync com dado antigo vindo do refetch.

Decisão funcional (com base na sua resposta)
- Você confirmou: **“Salvar deve aparecer na loja pública”**.
- Portanto, para páginas institucionais/landing de `store_pages`, a fonte de verdade de “Salvar” deve ser `store_pages.content` (não apenas `store_page_versions`).

Plano de implementação
1) Corrigir contrato de salvamento/publicação no builder
- Arquivo: `src/components/builder/VisualBuilder.tsx`
- Ajustar chamadas de `saveDraft.mutateAsync` e `publish.mutateAsync` para sempre enviar `pageType` também em `entityType === 'page'`.
- Objetivo: garantir roteamento correto para fluxo de página institucional/landing.

2) Tornar persistência de páginas consistente com o comportamento esperado
- Arquivo: `src/hooks/useBuilderData.ts`
- Garantir caminho explícito para `pageType in ('institutional','landing_page')`:
  - `saveDraft`: atualiza `store_pages.content` + `updated_at`.
  - `publish`: atualiza `store_pages.content` + `is_published/status`.
- Manter versionamento apenas onde fizer sentido histórico (sem quebrar a edição principal).

3) Harmonizar leitura entre editor, preview e público para evitar divergência
- Arquivos:
  - `src/pages/PageBuilder.tsx`
  - `src/hooks/usePreviewTemplate.ts`
  - `src/hooks/usePublicTemplate.ts`
  - (validar também `src/pages/storefront/StorefrontLandingPage.tsx`)
- Estratégia:
  - Priorizar `store_pages.content` para institucional/landing no fluxo principal.
  - Usar versões como fallback de compatibilidade, não como fonte primária para esse caso.
- Resultado: editor, preview e vitrine não entram em estados conflitantes.

4) Garantir propagação na vitrine ao salvar páginas publicadas
- Arquivos:
  - `src/hooks/useBuilderData.ts`
  - `src/lib/storefrontCachePurge.ts` (reuso)
- Ao salvar uma página já publicada (`is_published=true`), disparar purge/revalidação (como já é feito em outros módulos) para refletir rápido no HTML de borda.

5) Blindagem contra novo rollback visual
- Arquivo: `src/components/builder/VisualBuilder.tsx`
- Refinar gate anti-rollback para não liberar apenas por atualização otimista local; liberar só com confirmação coerente do estado persistido.
- Evita “sumiu na hora” mesmo com refetch assíncrono.

Detalhes técnicos (objetivo de arquitetura)
- Problema real: coexistem dois modelos de verdade para páginas (`store_pages.content` vs `store_page_versions`), com precedências diferentes por tela.
- Correção proposta: unificar fluxo de páginas institucionais/landing em `store_pages.content` para atender seu requisito de “salvar já refletir”.
- Compatibilidade:
  - Preservar leitura de versões apenas como fallback/migração.
  - Evitar quebrar histórico já existente.
- Segurança de entrega:
  - Sem alteração em arquivos proibidos de integração.
  - Sem depender de mudanças em auth/roles.

Validação pós-implementação (checklist)
- Página essencial IA (“Como Comprar”): adicionar Banner -> Salvar -> não some no editor.
- Página institucional criada manualmente: adicionar bloco -> Salvar -> permanece.
- Landing page do módulo de páginas: adicionar bloco -> Salvar -> permanece.
- Página publicada: Salvar -> validar atualização pública com cache-buster (`?cb=timestamp`).
- Reabrir editor da mesma página: conteúdo salvo permanece idêntico.
