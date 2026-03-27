# Memory: infrastructure/drive/hub-central-architecture-v1
Updated: 2026-03-27

Arquitetura 'Hub Central' para o Meu Drive (v1.1.0 — Fase 1A + 1B): 
1. Unificação: Centraliza toda a lógica de upload, registro, resolução de buckets e URLs na biblioteca 'driveService.ts'. Libs legadas funcionam como wrappers de compatibilidade para evitar regressões. 
2. Roteamento Automático de Pastas (v1.1.0): O campo `source` do upload determina automaticamente a pasta-alvo no Drive via `FOLDER_ROUTES` map e `ensureFolderPath`. Pastas são criadas sob demanda. Hierarquias incluem: Branding, Banners, Depoimentos, Produtos, Categorias, Loja Virtual, Mídias Sociais, Criativos IA (com sub-rotas: Tráfego IA, Calendário de Conteúdo, Loja Virtual, Landing Pages), Landing Pages, Assistente. folderId explícito sempre tem prioridade.
3. Registro de Imagens de Produtos (v1.1.0): ProductForm e ProductImageManager registram fire-and-forget no Drive após upload ao bucket product-images via `registerProductImageToDrive.ts`.
4. Resiliência: A criação de pastas utiliza obrigatoriamente busca por nome com '.is("folder_id", null)' e '.limit(1)' para prevenir duplicatas causadas por condições de corrida. 
5. Detecção de Uso: Sistema de detecção expandido (useFileUsageDetection) que rastreia vínculos em produtos, categorias, banners e publicações, exibindo badges de 'Em uso' e bloqueios de segurança. 
6. Busca: A busca é global por padrão em todo o tenant, com filtros granulares por tipo, origem e estado de uso.
7. Pendente para fases futuras: backfill de arquivos antigos, edge functions (visual-engine) gerando source correto para sub-rotas de IA, busca universal, badge "em uso" expandido, decomposição UI.
