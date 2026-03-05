# Memory: features/ai/landing-page-v7-composition-contract
Updated: now

A arquitetura V4.0.0 das AI Landing Pages gera BANNERS COMPLETOS com o produto incluído na imagem — exatamente como qualquer IA de geração de imagem faz naturalmente. 

1. **Produto como Referência**: A foto do catálogo é enviada como imagem de referência para a IA, que gera um banner fotorrealista premium COM o produto posicionado proporcionalmente.
2. **Prompt Unificado**: Um único prompt instrui a IA sobre composição (posição do produto, aspect ratio, cenário), com regras de fidelidade (não alterar cores/rótulo do produto).
3. **Renderização**: Em "scene mode", o banner gerado é usado como background-image full-bleed. O texto fica por cima com overlay gradiente. NÃO há composição separada de produto — ele já está no banner.
4. **Layout por Viewport**: Desktop (16:9) produto à direita 28-35% da largura; Mobile (9:16) produto centralizado no terço inferior 40-55% da altura.
5. **Fallback**: Em "standard mode" (sem scene gerada), o produto do catálogo é exibido como img separada com glow neutro.
