---
name: AI Image Generation — Full Product Context v1
description: creative-image-generate injeta cadastro completo (75 campos + payload comercial + composição + dores + memória manual) como briefing estruturado; checker de readiness mostra banner amarelo no diálogo quando faltam campos, sem bloquear.
type: feature
---
- Loader: `supabase/functions/_shared/product-context-loader.ts` (`loadProductContext`, `buildProductBriefing`, `evaluateImageContextReadiness`).
- Edge: `creative-image-generate/index.ts` substitui `descriptionContext` por briefing completo dentro do bloco `processPipeline`.
- UI: `src/lib/ai/productImageReadiness.ts` + banner amarelo em `AIImageGeneratorDialog.tsx` (warning, nunca bloqueia).
- Modelo de imagem mantido: Fal/GPT Image. Sem nova chamada de IA — apenas leituras paralelas no banco com RLS.
- Trava anti-alucinação: bloco "Restrições obrigatórias" no briefing proíbe texto/selos/ingredientes não cadastrados; kits devem usar exatamente os itens da composição.
- Doc oficial: `docs/especificacoes/criativos/contrato-format-size-quality.md` seção "Contexto de produto v1 (2026-06-25)".
