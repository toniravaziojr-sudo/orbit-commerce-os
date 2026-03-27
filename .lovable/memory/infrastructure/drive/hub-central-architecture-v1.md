# Memory: infrastructure/drive/hub-central-architecture-v1
Updated: 2026-03-27

Arquitetura 'Hub Central' para o Meu Drive (v1.2.0 — Fase 1A + 1B + 1C): 
1. Unificação: Centraliza toda a lógica de upload, registro, resolução de buckets e URLs na biblioteca 'driveService.ts'. Libs legadas funcionam como wrappers de compatibilidade. 
2. Roteamento Automático de Pastas: O campo `source` do upload determina automaticamente a pasta-alvo no Drive via `FOLDER_ROUTES` map e `ensureFolderPath`. Pastas criadas sob demanda.
3. Registro de Imagens de Produtos: ProductForm e ProductImageManager registram fire-and-forget no Drive após upload ao bucket product-images.
4. Edge Functions Integradas (v1.2.0): Novo helper server-side `drive-register.ts` com `ensureFolderPathEdge`, `registerFileToDriveEdge` e `resolveAndEnsureFolderEdge`. Integrado em: visual-engine.ts (criativos do builder → "Criativos IA/Loja Virtual"), ai-landing-page-enhance-images (→ "Criativos IA/Landing Pages"), creative-image-generate (→ "Criativos IA"). media-process-generation-queue já registrava via month folders.
5. Resiliência: Criação de pastas com `.limit(1)` e retry. Drive registration é fire-and-forget em edge functions.
6. Pendente: backfill de arquivos antigos, busca universal, badge "em uso" expandido, decomposição UI, support-email-inbound (bucket email-attachments) e media-approve-variant (bucket published-assets) são fluxos auxiliares não cobertos nesta fase.
