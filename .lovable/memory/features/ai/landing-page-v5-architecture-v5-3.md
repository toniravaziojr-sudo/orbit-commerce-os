# Memory: features/ai/landing-page-v5-architecture-v5-3
Updated: now

O sistema de AI Landing Pages (Motor V5+) adota uma arquitetura 'Projeto (Arquiteto) vs. Execução (Construtor)' para garantir coesão estética e superar o limite de 150s das Edge Functions:
1. Estágio 1 (Arquiteto - 'ai-landing-page-generate'): Gera a estrutura lógica e o 'Visual Blueprint'. Cada bloco (BlockNode) recebe um 'visual_brief' no metadata descrevendo cenário, iluminação e enquadramento.
2. Estágio 2 (Construtor - 'ai-landing-page-enhance-images' v2.1.0): Executa o briefing de forma assíncrona com **chunking por timeout**. Utiliza o PNG transparente do produto como referência para gerar composições visuais unificadas (21:9 ou 16:9).
3. Gestão de Timeout (v2.1.0): O processamento é sequencial. A função calcula o budget de tempo (130s úteis de 150s) e estima ~30s por imagem. Antes de cada geração, verifica o tempo restante. Se não há budget suficiente, salva progresso parcial (blocks + metadata) e retorna `{ done: false, nextIndex, nextStage }`. O frontend chama recursivamente a mesma função com `startFromIndex` e `stage` incrementados até `done: true`.
4. Parâmetros de Entrada (v2.1.0): `{ landingPageId, tenantId, userId, startFromIndex?: number, stage?: number }`. O `startFromIndex` indica qual seção iniciar (default 0). O `stage` é informativo (1, 2, 3...).
5. Metadata de Enhancement: O campo `metadata.imageEnhancement` acumula seções de todos os stages, incluindo `totalSections`, `totalEnhanced`, `stage`, e `done`.
6. Renderização: O conteúdo é salvo como JSON ('generated_blocks') e renderizado nativamente via React ('PublicTemplateRenderer'), garantindo responsividade e performance superiores ao modelo legatário de HTML/Iframe.
