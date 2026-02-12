

# Atualizar Documentacao de Campanhas

## Resumo

Atualizar `docs/regras/campanhas.md` para refletir a substituicao completa da integracao Late pela integracao nativa com a Meta (Graph API), incluindo a nova tabela `social_posts` e o fluxo de publicacao via `meta-publish-post`.

## Alteracoes em `docs/regras/campanhas.md`

### 1. Tabela de Arquivos Principais (Midias Sociais)
- Remover referencia a `supabase/functions/late-schedule-post/`
- Adicionar `supabase/functions/meta-publish-post/` com descricao "Publicacao nativa Meta (Facebook + Instagram)"
- Adicionar `src/hooks/useMetaConnection.ts` como hook de conexao Meta

### 2. Fluxo de Criacao de Campanha (Redes Sociais)
- Substituir passo 6 de `late-schedule-post (Meta)` para `meta-publish-post (Meta Graph API)`
- Atualizar diagrama para refletir o novo fluxo: approved -> publishing (via meta-publish-post) -> published

### 3. Remover secao "Publicacao via Late (Meta)"
- Remover bloco de codigo com endpoint `late-schedule-post`
- Remover secao "Integracao Late (Meta)" com tabela de funcoes Late

### 4. Adicionar nova secao "Integracao Meta Nativa (Facebook + Instagram)"
Documentar:
- Edge Function `meta-publish-post` e seus parametros
- Tabela `social_posts` com campos: platform, post_type, status, meta_post_id, api_response, scheduled_at, published_at
- Tipos de post suportados: feed, story, reel, carousel
- Plataformas: facebook (Pages API), instagram (Instagram Graph API)
- Fluxo Instagram (Container Flow): Create Container -> Poll Status -> Publish
- Escopos OAuth necessarios: pages_manage_posts, instagram_basic, instagram_content_publish, instagram_manage_insights

### 5. Atualizar "Separacao de Fluxos"
- Substituir referencia `late-schedule-post` por `meta-publish-post` na tabela de regras de isolamento

### 6. Atualizar Anti-Patterns
- Remover mencao a Late
- Adicionar: "Publicar no Instagram sem aguardar container FINISHED" como anti-pattern

### 7. Atualizar Checklist
- Marcar `[x] Conexao com Meta (nativa)` substituindo `[ ] Conexao com Late`
- Adicionar `[x] Tabela social_posts para evidencias App Review`

## Secao Tecnica

### Arquivos afetados
- `docs/regras/campanhas.md` (unico arquivo modificado)

### Dependencias
Nenhuma -- apenas atualizacao de documentacao refletindo mudancas ja implementadas.

