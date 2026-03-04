# Memory: features/ai/landing-page-v5-architecture-v5-3
Updated: now

O sistema de AI Landing Pages evoluiu para o Motor V5.4 (HTML Livre + Timeout Resolvido):

1. **Mudança Arquitetural (V5.4)**: A IA voltou a gerar HTML/CSS livre (como V4) em vez de JSON/blocos. Isso dá controle total sobre layout, tipografia, gradientes, efeitos visuais e espaçamentos — resultando em páginas de venda premium de alta conversão.

2. **Estágio 1 (ai-landing-page-generate v5.4.0)**: Gera HTML/CSS COMPLETO usando imagens do catálogo (sem gerar novas). Salva em `generated_html` + `generated_css`. Sem tool calling — a IA retorna HTML direto. Tempo: ~30-60s.

3. **Estágio 2 (ai-landing-page-enhance-images)**: Mantido igual — gera imagens premium assíncronamente e substitui URLs no HTML salvo. Chunking por timeout (~30s por imagem, recursivo).

4. **Renderização**: Prioridade invertida — `generated_html` (iframe via `buildDocumentShell`) tem prioridade sobre `generated_blocks` (React). Blocos V5 mantidos apenas como fallback para conteúdo legado.

5. **Contrato de Saída**: A IA retorna APENAS conteúdo do `<body>` (sem document shell). O backend (`buildDocumentShell`) é 100% autoritativo sobre o shell, CSS utilities, safety CSS e auto-resize script.

6. **Componentes afetados**: LandingPageEditor.tsx, StorefrontAILandingPage.tsx e LandingPagePreviewDialog.tsx todos priorizam HTML→iframe sobre blocks→BlockRenderer.
