# Memory: infrastructure/drive/hub-central-architecture-v1
Updated: 2026-03-27

Arquitetura 'Hub Central' para o Meu Drive (v2.0.0 — Fases 1A+1B+1C+2): 
1. Unificação: Centraliza toda a lógica de upload, registro, resolução de buckets e URLs na biblioteca 'driveService.ts'. Libs legadas funcionam como wrappers de compatibilidade. 
2. Roteamento Automático de Pastas: O campo `source` do upload determina automaticamente a pasta-alvo no Drive via `FOLDER_ROUTES` map e `ensureFolderPath`. Pastas criadas sob demanda.
3. Registro de Imagens de Produtos: ProductForm e ProductImageManager registram fire-and-forget no Drive após upload ao bucket product-images.
4. Edge Functions Integradas (v1.2.0): Helper server-side `drive-register.ts` com `ensureFolderPathEdge`, `registerFileToDriveEdge` e `resolveAndEnsureFolderEdge`. Integrado em: visual-engine.ts, ai-landing-page-enhance-images, creative-image-generate.
5. Resiliência: Criação de pastas com `.limit(1)` e retry. Drive registration é fire-and-forget em edge functions.
6. Backfill (v2.0.0): Edge function `drive-backfill` registra assets antigos na tabela files de forma idempotente. Cobre: store_settings (logo/favicon), product_images, categories (image, banners). Hook `useDriveBackfill` permite disparar do frontend. Não move/renomeia/altera URLs existentes.
7. Pendente: backfill de blocos/builder, campanhas/publicações, landing pages, criativos antigos. Badge "em uso" expandido, busca universal, decomposição UI, refino visual.
