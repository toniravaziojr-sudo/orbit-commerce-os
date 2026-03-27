# Mídias e Uploads — Regra Canônica

> **REGRA CRÍTICA:** Todos os uploads de arquivos/imagens em qualquer módulo DEVEM seguir este padrão.

## Fonte de Verdade

**Fonte de verdade:** `public.files` (Meu Drive)

---

## Fluxo de Upload Automático

| Etapa | Descrição |
|-------|-----------|
| **1. Upload direto** | O upload é feito automaticamente para o storage usando `uploadAndRegisterToSystemDrive()` |
| **2. Registro no Drive** | O arquivo é automaticamente registrado na pasta "Uploads do sistema" (files table) |
| **3. URL gerada** | A URL pública é retornada e salva no campo de configuração correspondente |

---

## Proibições

| ❌ Proibido | ✅ Correto |
|-------------|------------|
| Pedir para o usuário "usar o Meu Drive" e colar URL | Fazer upload automático e mostrar a URL gerada |
| Mostrar toast pedindo ação manual do usuário | Mostrar toast de sucesso após upload concluído |
| Ter abas "URL" e "Upload" onde Upload não funciona | Upload funcional que vai direto para o storage |

---

## Implementação Obrigatória

```typescript
// Em qualquer componente que precisa de upload
import { uploadAndRegisterToSystemDrive } from '@/lib/uploadAndRegisterToSystemDrive';

const result = await uploadAndRegisterToSystemDrive({
  tenantId,
  userId,
  file,
  source: 'identificador_do_modulo', // ex: 'page_banner_cart', 'category_image'
  subPath: 'pasta_no_storage',       // ex: 'banners', 'categories'
});

if (result?.publicUrl) {
  onChange(result.publicUrl); // Atualizar o campo com a URL
}
```

---

## Roteamento Automático de Pastas (Fase 1B)

O `driveService.ts` implementa roteamento automático baseado no campo `source` do upload.
Cada source é mapeado para uma pasta-alvo no Meu Drive. Pastas são criadas sob demanda.

| source | Pasta no Drive |
|--------|---------------|
| `storefront_logo`, `storefront_favicon`, `storefront_icon` | Uploads do sistema/Branding |
| `page_banner*`, `header_featured_promo`, `additional-highlight` | Uploads do sistema/Banners |
| `testimonial_image` | Uploads do sistema/Depoimentos |
| `review_media` | Uploads do sistema/Review de clientes |
| `product_image` | Produtos |
| `category_image`, `category_banner` | Categorias |
| `builder_desktop`, `builder_mobile` | Loja Virtual |
| `media_creative` | Mídias Sociais |
| `ai_creative_traffic` | Criativos IA/Tráfego IA |
| `ai_creative_calendar` | Criativos IA/Calendário de Conteúdo |
| `ai_creative_storefront` | Criativos IA/Loja Virtual |
| `ai_creative_landing` | Criativos IA/Landing Pages |
| `ai_creative` | Criativos IA |
| `landing_page_chat`, `landing_page_asset` | Landing Pages |
| `ads_chat_attachment`, `command_assistant`, `chatgpt*` | Assistente |
| `video_desktop`, `video_mobile` | Loja Virtual |
| `voice_sample` | Uploads do sistema |
| (sem rota definida) | Uploads do sistema (fallback) |

**API de roteamento:**
- `FOLDER_ROUTES` — mapa estático source → path
- `ensureFolderPath({ tenantId, userId, path })` — cria hierarquia de pastas (ex: "Criativos IA/Loja Virtual")
- `resolveTargetFolder(tenantId, userId, source, explicitFolderId?)` — resolve folder ID automaticamente

**Regra:** `folderId` explícito sempre tem prioridade sobre o roteamento automático.

---

## Registro de Imagens de Produtos

Imagens de produtos são uploaded para o bucket `product-images` (fluxo legado).
A partir da Fase 1B, após o upload, o sistema registra automaticamente no Drive via `registerProductImageToDrive()` (fire-and-forget).

| Arquivo | Função |
|---------|--------|
| `src/lib/registerProductImageToDrive.ts` | Helper fire-and-forget para registrar imagens de produtos no Drive |
| `src/components/products/ProductForm.tsx` | Chama `registerProductImageToDrive` após upload de imagens e variantes |
| `src/components/products/ProductImageManager.tsx` | Chama `registerProductImageToDrive` após upload de novas imagens |

**Regra:** A falha no registro do Drive nunca bloqueia o upload do produto.

---

## Pasta "Uploads do sistema"

| Regra | Descrição |
|-------|-----------|
| Sempre existe | `is_system_folder=true` |
| Não pode renomear/excluir/mover | - |
| Itens do sistema | Não podem sair da árvore do sistema |

---

## Uploads (obrigatório, qualquer módulo)

| Regra | Descrição |
|-------|-----------|
| Path único | Não sobrescrever |
| Registro | Em `public.files` com pasta automática via roteamento de source |
| Referência | Atualizar referência do módulo para nova mídia |
| Cache-busting | Em previews ao trocar |

---

## Indicador "Em Uso" (para Meu Drive)

| Regra | Descrição |
|-------|-----------|
| **Arquivo em uso** | Mostrar badge/sinalização clara que o arquivo está sendo usado por algum módulo |
| **Aviso ao excluir** | Antes de excluir arquivo em uso, mostrar alerta: "Este arquivo está sendo usado em [módulo]. Deseja excluir mesmo assim?" |
| **Arquivo não usado** | Aparece normal, sem sinalização especial |

---

## "Em uso" — Detecção Expandida

### Fontes de detecção

| Fonte | Campo(s) verificados | Tipo de uso | Badge |
|-------|---------------------|-------------|-------|
| `store_settings` | `logo_url`, `favicon_url`, `logo_file_id`, `favicon_file_id` | `logo`, `favicon` | Logo, Favicon |
| `categories` | `image_url`, `banner_desktop_url`, `banner_mobile_url` | `category_image`, `category_banner` | Categoria |
| `product_images` | `url`, `file_id` | `product_image` | Produto |
| `social_posts` | `media_urls[]` (status: scheduled/published/processing) | `social_post` | Publicação |
| `ai_landing_pages` | `seo_image_url` | `landing_page` | Landing page |

### Matching (prioridade)

| Prioridade | Método | Descrição |
|-----------|--------|-----------|
| 1 | `file_id` | Match exato pelo ID do arquivo |
| 2 | `bucket::storage_path` | Match por bucket + caminho |
| 3 | URL normalizada | Match por URL sem query params |

### Performance
- Consultas em lote por tenant (não arquivo a arquivo)
- Índices pré-construídos com `useMemo` para lookups O(1)
- `staleTime` diferenciado: 5s (store_settings), 30s (categories/products/posts), 60s (landing pages)
- Realtime apenas para `store_settings` (mudanças mais frequentes)

### UX

| Comportamento | Descrição |
|---------------|-----------|
| Badge "Em uso" | Exibido com ícone de link e tooltip detalhando onde |
| Tooltip | Lista todos os locais de uso com detalhes |
| Excluir arquivo em uso | Alerta com lista de impactos + confirmação explícita |
| Mover arquivo em uso | Aviso informativo (não bloqueante) |

### Componentes

| Componente | Arquivo | Função |
|-----------|---------|--------|
| `useFileUsageDetection` | `src/hooks/useFileUsageDetection.ts` | Hook central de detecção |
| `FileUsageBadge` | `src/components/drive/FileUsageBadge.tsx` | Badge com tooltip |
| `DeleteFileDialog` | `src/components/drive/DeleteFileDialog.tsx` | Alerta de exclusão com impacto |
| `MoveFileDialog` | `src/components/drive/MoveFileDialog.tsx` | Aviso de arquivo em uso ao mover |

**Decisão:** `media_library` não é banco do usuário; builder consome imagens do Meu Drive.

---

## Hooks e Utilitários Canônicos

| Arquivo | Uso |
|---------|-----|
| `src/lib/driveService.ts` | **Hub central** — upload, registro, URL, bucket, ensureFolder, folder routing, download. |
| `src/lib/registerProductImageToDrive.ts` | Helper fire-and-forget para registrar imagens de produtos no Drive |
| `src/hooks/useSystemUpload.ts` | Hook React para uploads em componentes (wrapper sobre driveService) |
| `src/hooks/useFiles.ts` | CRUD de arquivos/pastas do Drive (consome driveService para bucket/URL/download) |
| `src/hooks/useDriveFiles.ts` | Navegação, busca e breadcrumbs do Drive (consome driveService para URL) |
| `supabase/functions/_shared/drive-register.ts` | **Helper server-side** — ensureFolderPathEdge, registerFileToDriveEdge, resolveAndEnsureFolderEdge |
| `supabase/functions/_shared/visual-engine.ts` | Motor de geração visual — agora registra no Drive via drive-register.ts |
| `src/lib/uploadAndRegisterToSystemDrive.ts` | **[WRAPPER]** Compatibilidade — delega para driveService.uploadToDrive |
| `src/lib/registerFileToDrive.ts` | **[WRAPPER]** Compatibilidade — delega para driveService |
| `src/lib/replaceSystemAsset.ts` | **[WRAPPER]** Compatibilidade — delega para driveService.replaceDriveAsset |
| `src/lib/registerReviewMediaToDrive.ts` | **[WRAPPER]** Compatibilidade — delega para driveService |
| `src/lib/ensureMediaMonthFolder.ts` | **[WRAPPER]** Compatibilidade — delega para driveService.ensureFolder |
| `supabase/functions/drive-backfill/index.ts` | **Edge function** — backfill de assets antigos (store_settings, product_images, categories) |
| `src/hooks/useDriveBackfill.ts` | Hook React para disparar o backfill de assets antigos |

> **REGRA:** Novos módulos devem importar diretamente de `driveService.ts` (frontend) ou `drive-register.ts` (edge functions).

---

## Backfill de Assets Antigos (Fase 2)

A edge function `drive-backfill` registra no Meu Drive os assets que já existiam antes da centralização.

| Módulo | Campo(s) | Pasta no Drive | source |
|--------|----------|---------------|--------|
| store_settings | `logo_url`, `favicon_url` | Uploads do sistema/Branding | `storefront_logo`, `storefront_favicon` |
| product_images | `url` | Produtos | `product_image` |
| categories | `image_url`, `banner_desktop_url`, `banner_mobile_url` | Categorias | `category_image`, `category_banner` |

**Regras do backfill:**
- Idempotente: verifica duplicatas por `storage_path` antes de inserir
- NÃO move, renomeia, apaga ou troca URLs de arquivos já salvos
- NÃO altera bucket, path real ou vínculo atual dos módulos
- Apenas cria registros na tabela `files` com `metadata.backfill = true`
- Pagina product_images em lotes de 500 (até 5000)

**Pendentes para fase posterior:**
- Blocos da loja virtual (builder blocks com imagens inline)
- Campanhas/publicações (media_publications)
- Landing pages (ai_landing_pages com imagens geradas)
- Criativos IA já gerados por engines antigas

---

## Calendário de Conteúdo (IA) — Integração YouTube

O módulo "Calendário de Conteúdo (IA)" (`/media`), localizado no grupo **Central de Conteúdo** na sidebar, inclui integração com YouTube para upload e agendamento de vídeos.

### Funcionalidades

| Feature | Descrição |
|---------|-----------|
| Upload de Vídeos | Upload resumable para YouTube com metadados (título, descrição, tags) |
| Agendamento | Publicação futura via `publishAt` |
| Thumbnails | Upload de thumbnail customizada |
| Analytics | Visualização de métricas (views, watch time) - em desenvolvimento |

### Consumo de Créditos

O YouTube utiliza o sistema de **Pacotes IA** (créditos) para gerenciar a quota da API do Google:

| Operação | Créditos | Quota Google |
|----------|----------|--------------|
| Upload base | 16 | 1600 unidades |
| +Thumbnail | 1 | 50 unidades |
| +Captions | 2 | 100 unidades |
| +1GB de vídeo | 1 | overhead |

**Limite diário:** A API do Google tem quota de 10.000 unidades/dia. Com 16 créditos por upload, permite ~6 uploads/dia por canal.

### Fluxo de Upload

```
1. Verificar saldo de créditos (check_credit_balance)
2. Reservar créditos (reserve_credits)
3. Criar job em youtube_uploads
4. Background: Download vídeo → Upload para YouTube
5. Consumir créditos reservados (consume_credits)
6. Atualizar status para completed
```

### Componentes

| Arquivo | Descrição |
|---------|-----------|
| `src/hooks/useYouTubeConnection.ts` | Hook para gerenciar conexão OAuth |
| `src/components/integrations/YouTubeSettings.tsx` | UI de configuração |
| `supabase/functions/youtube-upload/index.ts` | Edge Function de upload |

---

## Sistema de Upload Universal

O sistema permite aos usuários escolher entre 3 fontes para uploads:

| Fonte | Descrição |
|-------|-----------|
| **Upload (PC)** | Upload direto do computador usando `useSystemUpload` |
| **Meu Drive** | Seleção de arquivos já existentes no drive do tenant |
| **URL** | Colar URL de imagem externa (opcional) |

### Componentes Universais

| Componente | Uso |
|------------|-----|
| `src/components/ui/UniversalImageUploader.tsx` | Uploader unificado com abas (Upload, Meu Drive, URL) |
| `src/components/ui/DriveFilePicker.tsx` | Modal de navegação completa do Meu Drive |
| `src/hooks/useDriveFiles.ts` | Hook para listar/navegar arquivos do drive |

### Props do UniversalImageUploader

```typescript
interface UniversalImageUploaderProps {
  value: string;              // URL atual da imagem
  onChange: (url: string) => void;  // Callback ao selecionar
  source: string;             // Identificador do módulo (ex: 'product_image')
  subPath?: string;           // Subpasta no storage (ex: 'products')
  placeholder?: string;       // Texto do placeholder
  aspectRatio?: 'square' | 'video' | 'banner';  // Proporção do preview
  showUrlTab?: boolean;       // Mostrar aba URL (default: true)
  accept?: 'image' | 'video' | 'document' | 'all';  // Tipo de arquivo
  maxSize?: number;           // Tamanho máximo em MB (default: 5)
  disabled?: boolean;         // Desabilitar uploader
}
```

### Exemplo de Uso

```tsx
import { UniversalImageUploader } from '@/components/ui/UniversalImageUploader';

<UniversalImageUploader
  value={imageUrl}
  onChange={setImageUrl}
  source="product_main_image"
  subPath="products"
  aspectRatio="square"
  placeholder="Selecione a imagem do produto"
/>
```

### DriveFilePicker (Modal Standalone)

Para casos onde precisa apenas do seletor do Drive:

```tsx
import { DriveFilePicker } from '@/components/ui/DriveFilePicker';

<DriveFilePicker
  open={showPicker}
  onOpenChange={setShowPicker}
  onSelect={(url) => handleSelect(url)}
  accept="image"
  title="Selecionar Imagem"
/>
```

#### Regras Críticas de Estabilidade do DriveFilePicker

| Regra | Motivo |
|-------|--------|
| `DialogContent` DEVE ter `onPointerDownOutside={e => e.stopPropagation()}` e `onInteractOutside={e => e.stopPropagation()}` | Impede que fechar o DriveFilePicker feche também o dialog pai (ex: CalendarItemDialog) |
| O botão "Escolher do Meu Drive" no `UniversalImageUploader` DEVE ter `type="button"` | Sem isso, o botão dispara submit do formulário pai, fechando/enviando o dialog |
| Processar seleção de arquivos via argumentos de função, não via state | Evita race conditions no double-click (state do React pode estar desatualizado) |
| Preview de imagem limitado a `max-h-[300px]` com `min-h-0` e `overflow-hidden` | Garante layout estável dentro de modais |

---

## Pasta "Imagens de Produtos" (Meu Drive)

Pasta automática criada no Meu Drive para centralizar imagens de produtos, acessível pelo **Gestor de Tráfego IA** para geração de criativos.

| Item | Valor |
|------|-------|
| **Nome da pasta** | `Imagens de Produtos` |
| **Criação** | Automática pela edge function `ads-chat` ao precisar de imagens |
| **Fonte** | `product_images` + `products.images` (JSONB) |
| **Registro** | `public.files` com `source: 'product_catalog'` e `system_managed: true` |
| **Uso principal** | IA de Tráfego consulta esta pasta para gerar criativos com imagens reais dos produtos |

### Sincronização

```
1. Ao criar a pasta, imagens existentes de product_images são copiadas automaticamente
2. Novos produtos com imagens são registrados sob demanda pela IA
3. A pasta é do tipo is_folder=true, NÃO é system_folder (pode ser navegada pelo lojista)
```

### Acesso pela IA de Tráfego

A ferramenta `get_product_images` do chat de IA busca imagens de duas fontes:
1. **Tabela `product_images`** — imagens cadastradas no módulo de produtos
2. **Pasta "Imagens de Produtos"** no Meu Drive — imagens organizadas para uso em criativos

---

## Pasta "Gestor de Tráfego IA" (Meu Drive)

Pasta automática para armazenar criativos gerados pela IA de Tráfego para campanhas de anúncios.

| Item | Valor |
|------|-------|
| **Nome da pasta** | `Gestor de Tráfego IA` |
| **Criação** | Automática pela edge function `ads-autopilot-creative` |
| **Registro** | `public.files` com `source: 'ads_autopilot'` e `system_managed: true` |

---

## Criativos com IA — Armazenamento Automático

Criativos gerados pelo módulo **Gestor de Criativos** (`/creatives`) são automaticamente armazenados no Meu Drive:

| Item | Valor |
|------|-------|
| **Pasta** | `Criativos com IA` |
| **Bucket** | `media-assets` |
| **Registro** | `public.files` com `source: 'creative_job'` e `system_managed: true` |
| **Exclusão** | Via hook `useDeleteCreativeJob` — remove do banco E do storage |

### Fluxo

```
1. Job de criativo finaliza com sucesso
2. Arquivo salvo em storage/media-assets/{tenant_id}/creatives/...
3. Registro criado em public.files com folder_id = pasta "Criativos com IA"
4. URL disponível em creative_jobs.output_urls
```

---

## Arquivos Relacionados

| Se for editar... | Leia este doc primeiro |
|------------------|------------------------|
| `src/hooks/useSystemUpload.ts` | Este documento |
| `src/hooks/useDriveFiles.ts` | Este documento |
| `src/hooks/useCreatives.ts` | Este documento + docs/regras/geracao-imagens-ai.md |
| `src/lib/uploadAndRegisterToSystemDrive.ts` | Este documento |
| `src/lib/registerFileToDrive.ts` | Este documento |
| `src/components/ui/UniversalImageUploader.tsx` | Este documento |
| `src/components/ui/DriveFilePicker.tsx` | Este documento |
| `src/components/creatives/AIPipelineInfo.tsx` | docs/regras/geracao-imagens-ai.md |
| Qualquer componente com upload de imagem | Este documento |
| `src/hooks/useYouTubeConnection.ts` | Este documento |
| `src/pages/Media.tsx` | Este documento |
| `src/components/settings/ImageUpload.tsx` | Este documento |

---

## Componente ImageUpload (Configurações da Loja)

O componente `ImageUpload` é usado para upload de logo e favicon nas configurações da loja.

### Props

| Prop | Tipo | Descrição |
|------|------|-----------|
| `label` | string | Título do campo (ex: "Logo") |
| `description` | string | Texto de ajuda (ex: "Recomendado: PNG, 200x60px") |
| `value` | string \| null | URL atual da imagem |
| `onChange` | (url: string \| null) => void | Callback ao alterar |
| `onUpload` | (file: File) => Promise<string \| null> | Handler de upload |
| `accept` | string | MIME types aceitos |
| `disabled` | boolean | Desabilitar edição |

### Fluxo de Substituição

```
1. Usuário clica em "Substituir" ou "Meu Drive"
2. Arquivo é selecionado (local ou do Drive)
3. onUpload() é chamado → retorna URL pública
4. onChange(url) é chamado para atualizar UI imediatamente
5. Estado local e banco são atualizados
```

### Recomendações de Tamanho

| Asset | Dimensão Recomendada | Formato |
|-------|---------------------|---------|
| Logo | 200x60px | PNG, SVG (transparente) |
| Favicon | 32x32px ou 64x64px | PNG, ICO |

### Validações

- Tamanho máximo: 2MB
- Tipos aceitos: Definidos via prop `accept`

---

## Gestor de Mídias IA — Criativos (Upload/Drive)

O fluxo de criação manual de publicações no Gestor de Mídias (`/media`) utiliza o `UniversalImageUploader` para seleção de criativos, garantindo acesso a **Upload**, **Meu Drive** e **URL** em todos os formatos (Feed e Stories).

| Componente | Integração |
|------------|------------|
| `PublicationDialog.tsx` | `UniversalImageUploader` para Feed e Stories |
| `CalendarItemDialog.tsx` | `UniversalImageUploader` para itens do calendário |

### Regra

| ❌ Proibido | ✅ Correto |
|-------------|------------|
| Input file simples sem acesso ao Drive | `UniversalImageUploader` com abas Upload/Drive/URL |
| Stories sem campo de upload manual | Stories com `UniversalImageUploader` igual ao Feed |

---

## Visibilidade de Criativos — Regras de Exibição

Todas as previews de criativos (gerados ou uploaded) devem usar `object-contain` para garantir que a imagem completa seja visível, sem corte:

| Componente | Regra |
|------------|-------|
| `CalendarItemDialog.tsx` | `object-contain` com altura generosa (`max-h-80`+) |
| `AssetVariantsGallery.tsx` | Thumbnails sem `aspect-square` forçado; usar `object-contain` com `bg-muted` |
| `ApprovalDialog.tsx` | Thumbnails com `object-cover` (80x80 — tamanho pequeno, corte aceitável) |

> **PROIBIDO:** Usar `object-cover` em previews grandes de criativos. Apenas thumbnails pequenos (≤80px) podem usar `object-cover`.

---

## Nomes Únicos de Criativos no Drive

Criativos gerados pela IA (edge function `creative-image-generate`) usam nomes descritivos e únicos:

| Item | Valor |
|------|-------|
| **Padrão** | `{product_name}_{style}_{provider}_{DDMM_HHmm}{_BEST}.png` |
| **Exemplo** | `Shampoo_Anticaspa_natural_gemini_0219_1430_BEST.png` |
| **Unicidade** | Timestamp curto `DDMM_HHmm` garante nomes distintos |
| **Sanitização** | `product_name` é sanitizado (sem acentos/especiais, underscores) |

### Ordenação no Drive

| Regra | Descrição |
|-------|-----------|
| **Ordenação padrão** | `created_at DESC` — mais recentes no topo |
| **Hook** | `useDriveFiles.ts` ordena por `created_at DESC` após pastas do sistema |

---

## Buckets e URLs — Regra de Acesso

| Bucket | Visibilidade | Método de URL |
|--------|-------------|---------------|
| `store-assets` | Público | `getPublicUrl()` |
| `media-assets` | Público | `getPublicUrl()` |
| `tenant-files` | **Privado** | `createSignedUrl()` (1h de expiração) |

> **REGRA CRÍTICA:** `getPublicUrl()` sempre retorna uma URL, mesmo para buckets privados (a URL simplesmente não funciona). Por isso, para `tenant-files`, SEMPRE usar `createSignedUrl()` diretamente. Nunca tentar `getPublicUrl` como primeiro passo em buckets privados.

---

## Toasts de Upload — Consolidação Obrigatória

| Regra | Descrição |
|-------|-----------|
| **Upload único** | Toast: "Arquivo enviado com sucesso!" |
| **Upload múltiplo** | Toast: "X arquivos enviados com sucesso!" (consolidado) |
| **Erros parciais** | Toast de erro separado: "X arquivo(s) falharam no envio." |
| **Implementação** | O toast é disparado pelo **caller** (`Files.tsx`), não pelo hook `useFiles.ts` |

> **PROIBIDO:** Disparar toast individual por arquivo dentro do `onSuccess` da mutation. O hook `useFiles.uploadFile` NÃO emite toasts — a responsabilidade é do componente que orquestra o upload em lote.

---

## Fase 1A — Robustez Operacional do Calendário de Conteúdo

### Novas Colunas — social_posts

| Coluna | Tipo | Default | Propósito |
|--------|------|---------|-----------|
| `attempt_count` | int | 0 | Quantas tentativas de publicação foram feitas |
| `next_retry_at` | timestamptz | null | Quando o robô deve tentar publicar de novo |
| `processing_started_at` | timestamptz | null | Marca quando o robô começou a processar (lock) |
| `lock_token` | uuid | null | Token único que impede processamento duplicado |
| `last_error_code` | text | null | Código do erro: `retryable`, `permanent`, `preflight_failed`, etc. |
| `last_error_message` | text | null | Mensagem detalhada do erro |
| `payload_snapshot` | jsonb | {} | **Fonte de verdade para execução** — conteúdo congelado no momento do agendamento |
| `normalization_result` | jsonb | null | Resultado da normalização de mídia (MIME detectado, conversão, URL normalizada) |

### Novas Colunas — media_calendar_items

| Coluna | Tipo | Default | Propósito |
|--------|------|---------|-----------|
| `frozen_payload` | jsonb | null | Snapshot do conteúdo no momento do agendamento — referência/auditoria do lote |

### Hierarquia de fonte de verdade

| Nível | Fonte | Uso |
|-------|-------|-----|
| **Execução** | `social_posts.payload_snapshot` | O robô de publicação usa este snapshot, não o item pai |
| **Auditoria** | `media_calendar_items.frozen_payload` | Referência do que foi congelado no agendamento |
| **Fallback** | `media_calendar_items.*` | Usado apenas se `payload_snapshot` estiver vazio (posts antigos) |

### Nova Edge Function — media-normalize-asset

| Item | Valor |
|------|-------|
| **Arquivo** | `supabase/functions/media-normalize-asset/index.ts` |
| **Versão** | 1.0.0 |
| **Propósito** | Validar e normalizar mídia antes de enviar às redes sociais |
| **Chamada** | Automática pelo worker, antes de publicar no Instagram |

**Comportamento por tipo de mídia:**

| Tipo | Comportamento |
|------|---------------|
| Imagem aceita (JPEG, PNG) | Retorna URL original sem conversão |
| Imagem incompatível (WebP, AVIF, BMP, GIF) | Re-upload com Content-Type correto para Instagram |
| Vídeo compatível (MP4, MOV) | Retorna URL original sem conversão |
| Vídeo incompatível | Falha permanente com motivo claro |
| Formato não reconhecido | Falha com `unconvertible_format` |

**Validações realizadas:**
- MIME real via magic bytes (não confia na extensão)
- Tamanho máximo por plataforma (Instagram: 8MB, Facebook: 10MB)
- Resultado da normalização é salvo em `social_posts.normalization_result`

### Robô de Publicação — media-social-publish-worker v2.0.0

| Item | Valor |
|------|-------|
| **Arquivo** | `supabase/functions/media-social-publish-worker/index.ts` |
| **Versão** | 2.0.0 |

**Mudanças em relação à v1.0.0:**

| Feature | Antes | Agora |
|---------|-------|-------|
| Retry | Nenhum | Até 3 tentativas com backoff (1min, 5min, 15min) |
| Locking | Nenhum | `processing_started_at` + `lock_token` por post |
| Stale lock | N/A | Liberado automaticamente após 10 minutos |
| Fonte de dados | Item pai direto | `payload_snapshot` do social_post (fallback para pai) |
| Normalização | Nenhuma | Chama `media-normalize-asset` antes do Instagram |
| Classificação de erro | Nenhuma | `retryable` vs `permanent` |
| Agregação do pai | `published` ou `failed` | Aguarda se ainda há posts pendentes/em retry |

**Classificação de erros:**

| Tipo | Exemplos | Comportamento |
|------|----------|---------------|
| Retryable | timeout, rate limit, 429, 500, 503 | Agenda retry com backoff |
| Permanent | token expired, permission denied, conta desconectada | Falha definitiva |

### Publicador — meta-publish-post v3.0.0

| Item | Valor |
|------|-------|
| **Arquivo** | `supabase/functions/meta-publish-post/index.ts` |
| **Versão** | 3.0.0 |

**Mudanças em relação à v2.4.0:**

| Feature | Antes | Agora |
|---------|-------|-------|
| Preflight | Nenhum | Validação por plataforma antes de agendar |
| Snapshot | Nenhum | `payload_snapshot` salvo em cada social_post |
| Frozen payload | Nenhum | `frozen_payload` salvo no item pai ao agendar |
| Erro granular | Genérico | `last_error_code` + `last_error_message` por post |

**Validações do preflight (por plataforma):**

| Validação | Instagram | Facebook |
|-----------|-----------|----------|
| Conta conectada | ✅ | ✅ |
| Mídia obrigatória (exceto texto) | ✅ | — |
| Story requer mídia | ✅ | — |
| Limite de 6 meses | ✅ | ✅ |
| Conteúdo não vazio | ✅ | ✅ |
| Data definida | ✅ | ✅ |

### Proteção contra edição silenciosa

| Regra | Comportamento |
|-------|---------------|
| Item agendado → pai editado | Os `social_posts` continuam com `payload_snapshot` original |
| Worker executa | Usa `payload_snapshot`, ignora valores atuais do pai |
| Substituição explícita | Será implementada na Fase 2 ("Editar e substituir agendamento") |

---

## Fase 1B — Status Agregados, Rastreabilidade e Ações Operacionais

### Novos Status do Item Pai (media_item_status enum)

| Status | Significado |
|--------|-------------|
| `partially_published` | Algumas redes publicaram, outras ainda pendentes/em retry |
| `partially_failed` | Algumas redes publicaram, outras falharam permanentemente |
| `retry_pending` | Há posts filhos aguardando nova tentativa automática |
| `superseded` | Item foi substituído por versão mais recente |
| `canceled` | Falha foi encerrada manualmente pelo operador |

### Agregação Automática (DB Trigger)

O status do item pai é calculado automaticamente por trigger (`trg_sync_calendar_item_status`) a cada mudança nos filhos (`social_posts`). Não é mais necessário calcular no worker.

| Condição dos filhos ativos | Status resultante do pai |
|---------------------------|--------------------------|
| Todos publicados | `published` |
| Algum agendado ou publicando | `scheduled` |
| Algum em retry pendente | `retry_pending` |
| Alguns publicados + alguns falhados | `partially_failed` |
| Alguns publicados + alguns pendentes | `partially_published` |
| Todos falhados | `failed` |

### Novas Colunas — social_posts

| Coluna | Tipo | Default | Propósito |
|--------|------|---------|-----------|
| `execution_log` | jsonb | `[]` | Histórico de tentativas com timestamp, resultado, erros |
| `warning_flags` | jsonb | `[]` | Avisos (ex: "mídia ausente na plataforma após publicação") |
| `superseded_by` | uuid (FK) | null | Referência ao post que substituiu este |
| `superseded_at` | timestamptz | null | Quando foi marcado como substituído |

### Nova Coluna — media_calendar_items

| Coluna | Tipo | Default | Propósito |
|--------|------|---------|-----------|
| `platform_summary` | jsonb | `{}` | Resumo por plataforma (status, erro, tentativas) — preenchido pelo trigger |

### Nova Edge Function — media-social-post-actions v1.0.0

| Item | Valor |
|------|-------|
| **Arquivo** | `supabase/functions/media-social-post-actions/index.ts` |
| **Versão** | 1.0.0 |
| **Propósito** | Ações manuais operacionais sobre publicações por plataforma |

**Ações disponíveis:**

| Ação | Quando usar | O que faz |
|------|-------------|-----------|
| `retry_platform` | Post falhou e operador quer reenviar | Zera tentativas, re-agenda como `scheduled` |
| `dismiss_failure` | Falha que não será corrigida | Marca como `canceled`, para de tentar |
| `supersede` | Reagendamento manual | Marca antigo como `superseded`, preserva histórico |

### Robô de Publicação — media-social-publish-worker v2.1.0

| Mudança | Antes (v2.0.0) | Agora (v2.1.0) |
|---------|----------------|----------------|
| Rastreabilidade | Apenas `attempt_count` | `execution_log` com histórico completo por tentativa |
| Avisos | Nenhum | `warning_flags` para degradação (ex: publicou sem mídia) |
| Agregação do pai | Calculada no worker | Delegada ao DB trigger |

### Componentes de Interface

| Componente | Arquivo | Propósito |
|------------|---------|-----------|
| `PlatformStatusPanel` | `src/components/media/PlatformStatusPanel.tsx` | Mostra status por rede com ações de reenvio/encerramento |
| `useSocialPosts` | `src/hooks/useSocialPosts.ts` | Hook para consultar posts filhos de um item |
| `useSocialPostActions` | `src/hooks/useSocialPosts.ts` | Hook para executar ações operacionais |

### Onde aparece na interface

O painel de status por plataforma aparece na lista de publicações do dia (`DayPostsList`), abaixo de cada item que está agendado, publicado ou com erro. Mostra:
- Ícone da rede (Instagram/Facebook)
- Status individual (Publicado, Com Erro, Agendado, Aguardando retry)
- Erro amigável traduzido
- Botões "Reenviar" e "Encerrar" para posts com falha permanente
- Registros anteriores (substituídos/encerrados) em seção colapsável

---

## Fase 2 — Regras de Edição, Substituição e Versionamento

### Regras de Editabilidade por Estado

| Estado | Pode editar | Pode excluir | Modo | Descrição |
|--------|-------------|--------------|------|-----------|
| draft, suggested, review, generating_asset, asset_review | ✅ | ✅ | Livre | Edição sem restrições |
| approved | ✅ | ✅ | Livre (com tracking) | Se campo crítico mudar, volta para revisão |
| scheduled | ❌ direto | ❌ | Substituição | Abre modal de decisão: substituir ou duplicar |
| publishing, retry_pending | ❌ | ❌ | Somente leitura | Em processamento |
| partially_published, partially_failed | ❌ | ❌ | Somente leitura total | Reenviar pendentes ou criar nova versão |
| published | ❌ | ❌ | Somente leitura | Visualizar e duplicar apenas |
| superseded, canceled, failed | ❌ | ❌ | Somente leitura | Histórico |

### Campos Críticos (Tracking de Reaprovação)

Ao editar item aprovado, mudanças em `copy`, `asset_url`, `target_platforms` ou `content_type` revertem status para `review`.

### Substituição de Agendamento (Ordem Segura)

1. Salva novos dados no item pai (sem apagar nada)
2. Se sucesso → marca social_posts ativos como `superseded` via edge function
3. Reseta status para `approved`
4. Limpa `frozen_payload`
5. Preserva `scheduled_time` original

Se falhar em qualquer passo, o agendamento antigo permanece intacto.

### Item Parcialmente Publicado = Somente Leitura Total

O item original fica 100% somente leitura. Opções do usuário:
- **Reenviar pendentes** — reenvia sem alterar conteúdo (via PlatformStatusPanel)
- **Criar nova versão** — duplica como rascunho independente

### Componentes da Fase 2

| Componente | Arquivo | Propósito |
|------------|---------|-----------|
| `ScheduledEditChoiceDialog` | `src/components/media/ScheduledEditChoiceDialog.tsx` | Modal de decisão: substituir agendamento ou duplicar |
| `useCalendarItemActions` | `src/hooks/useCalendarItemActions.ts` | Hook central: checkEditability, replaceScheduledItem, duplicateAsNewVersion |
| `checkEditability` | `src/hooks/useCalendarItemActions.ts` | Função pura que retorna permissões por estado |
| `hasCriticalFieldChanged` | `src/hooks/useCalendarItemActions.ts` | Detecta mudança em campos que exigem reaprovação |

### Ações Contextuais na Lista do Dia (DayPostsList)

Botões mudam conforme o estado do item:
- Em construção/aprovado: Editar, Duplicar, Excluir
- Agendado: Substituir, Duplicar, Ver
- Publicando/retry: Ver, Duplicar
- Parcial: Reenviar, Duplicar, Ver
- Publicado/finalizado: Ver, Duplicar

### Banners de Contexto no Editor (PublicationDialog)

| Situação | Banner |
|----------|--------|
| Modo substituição | Aviso amarelo: "Ao salvar, o agendamento anterior será cancelado" |
| Parcialmente publicado | Aviso com cadeado: "Somente leitura — reenvie pendentes ou duplique" |
| Publicado | Aviso verde com cadeado: "Item publicado — use Duplicar" |

---

## Fase 3 — Reorganização da Experiência em 3 Abas

### Estrutura de Abas

| Aba | Propósito | Componente |
|-----|-----------|------------|
| **Planejamento** | Selecionar dias, gerar estratégia/copys/criativos, editar rascunhos | `PlanningTab.tsx` |
| **Aprovação e Publicação** | Revisar, aprovar e publicar itens prontos (lista inline com checklist) | `ApprovalTab.tsx` |
| **Acompanhamento** | Ver status de publicados/agendados/com erro, reenviar, duplicar | `TrackingTab.tsx` |

### Componentes da Fase 3

| Componente | Arquivo | Propósito |
|------------|---------|-----------|
| `CampaignTabs` | `src/components/media/CampaignTabs.tsx` | Orquestra as 3 abas, gerencia estado compartilhado (dialogs, seleção) |
| `PlanningTab` | `src/components/media/PlanningTab.tsx` | Calendário + stepper de construção (passos 1-4), filtra itens em preparo |
| `ApprovalTab` | `src/components/media/ApprovalTab.tsx` | Lista inline de aprovação + publicação, reutiliza handlers existentes |
| `TrackingTab` | `src/components/media/TrackingTab.tsx` | Calendário somente leitura com status operacionais, cards de resumo |

### Navegação entre Abas

| De | Para | Gatilho |
|----|------|---------|
| Planejamento → Aprovação | Alerta verde "X itens prontos para aprovação" com botão "Ir para Aprovação" |
| Aprovação → Planejamento | Botão "Editar" em cada item leva de volta ao editor no Planejamento |
| Aprovação → Planejamento | Botão "Voltar ao Planejamento" quando lista vazia |
| Acompanhamento → DayPostsList | Clique no dia abre lista com ações de ver/reenviar/duplicar |

### CampaignCalendar Refatorado

O `CampaignCalendar.tsx` foi reduzido de ~1020 linhas para ~40 linhas, servindo apenas como casca que renderiza `PageHeader` + `CampaignTabs`.

### Filtros por Aba

| Aba | Statuses visíveis no calendário |
|-----|--------------------------------|
| Planejamento | draft, suggested, review, generating_asset, asset_review, approved |
| Acompanhamento | scheduled, publishing, published, failed, partially_published, partially_failed, retry_pending, superseded, canceled |

---

## Histórico de Alterações

| Data | Alteração |
|------|-----------|
| 2026-03-27 | **Fase 4** — Exclusão em lote segura com useConfirmDialog (substitui confirm() nativo) |
| 2026-03-27 | **Fase 4** — Estados vazios orientativos nas 3 abas com EmptyState + atalhos contextuais |
| 2026-03-27 | **Fase 4** — Resumo compacto no topo do painel do dia (DayPostsList) |
| 2026-03-27 | **Fase 4** — Microcopy melhorado: "Publicação parcial", "Falha parcial", "Aguardando reenvio", "Substituir agendamento" |
| 2026-03-27 | **Fase 4** — Indicadores de atenção no calendário de Planejamento (dots âmbar/roxo/verde com prioridade) |
| 2026-03-27 | **Fase 4** — Status parciais/superseded/canceled adicionados ao PublicationPreviewDialog |
| 2026-03-27 | **Fase 4** — Alerta de rascunhos incompletos na aba Aprovação com atalho para Planejamento |
| 2026-03-27 | **Fase 3** — Reorganização em 3 abas (CampaignTabs, PlanningTab, ApprovalTab, TrackingTab) |
| 2026-03-27 | **Fase 3** — CampaignCalendar reduzido a casca de ~40 linhas |
| 2026-03-27 | **Fase 3** — Aprovação transformada em lista inline com filtros (prontos/aprovados) |
| 2026-03-27 | **Fase 3** — Navegação cruzada entre abas com atalhos contextuais |
| 2026-03-27 | **Fase 2** — Regras de editabilidade por estado (checkEditability) |
| 2026-03-27 | **Fase 2** — Modal ScheduledEditChoiceDialog para itens agendados |
| 2026-03-27 | **Fase 2** — Substituição segura de agendamento (replaceScheduledItem) |
| 2026-03-27 | **Fase 2** — Tracking de campos críticos com reaprovação automática |
| 2026-03-27 | **Fase 2** — Ações contextuais no DayPostsList por estado |
| 2026-03-27 | Corrigido scroll interno do PublicationDialog (maxHeight inline + display flex forçado) e espaçamento do campo de prompt IA com resize desabilitado |
| 2026-03-27 | **Fase 2** — Banners de contexto e modo somente leitura no PublicationDialog |
| 2026-03-27 | **Bugfix pastas duplicadas** — Corrigido `ensureMediaMonthFolder.ts` e edge function `media-process-generation-queue`: busca de pasta raiz "Mídias Sociais" trocada de `.maybeSingle()` para `.limit(1).order(created_at asc)` + filtro `folder_id IS NULL`. Isso evita erro quando existem duplicatas e impede criação de novas pastas duplicadas. Limpeza: 17 pastas raiz duplicadas e 17 subpastas de mês removidas; 7 arquivos órfãos movidos para a pasta Março 2026 correta. |
| 2026-03-27 | Revertido `resize-none` do campo de prompt IA no PublicationDialog — campo voltou a permitir redimensionamento (igual ao campo de legenda/copy), mantendo apenas o espaçamento (`pb-3`) entre o campo e os botões de ação |
| 2026-03-27 | **Fase 2** — Item parcialmente publicado = somente leitura total |
| 2026-03-27 | **Fase 1A** — Adicionadas colunas de retry/locking/snapshot em social_posts e frozen_payload em media_calendar_items |
| 2026-03-27 | **Fase 1A** — Nova edge function `media-normalize-asset` para validação de mídia antes do Instagram |
| 2026-03-27 | **Fase 1A** — Worker v2.0.0: retry automático com backoff, locking, normalização, uso de payload_snapshot |
| 2026-03-27 | **Fase 1A** — meta-publish-post v3.0.0: preflight por plataforma, snapshot congelado, frozen_payload no pai |
| 2026-03-02 | Corrigido `getFileUrl` para usar `createSignedUrl` em buckets privados (`tenant-files`) — previews e downloads agora funcionam |
| 2026-03-02 | Toasts de upload consolidados: uma única notificação para uploads em lote em vez de uma por arquivo |
| 2026-02-19 | Nomes únicos para criativos (`{product}_{style}_{provider}_{timestamp}.png`) e ordenação do Drive por `created_at DESC` |
| 2026-02-17 | Adicionadas pastas "Imagens de Produtos" e "Gestor de Tráfego IA" — sincronização automática de imagens do catálogo para o Meu Drive |
| 2026-02-14 | Adicionadas regras de estabilidade do DriveFilePicker: `stopPropagation` no DialogContent e `type="button"` no botão do Drive |
| 2026-02-14 | Adicionada seção de Visibilidade de Criativos — regras de `object-contain` vs `object-cover` |
| 2026-02-14 | Corrigido `CalendarItemDialog` e `AssetVariantsGallery` para não cortar imagens |
| 2025-02-13 | Integrado UniversalImageUploader no PublicationDialog (Feed + Stories) e CalendarItemDialog |
| 2025-02-13 | Corrigido Stories sem opção de upload manual de criativos |
| 2025-01-31 | Corrigido fluxo de substituição de logo/favicon para chamar onChange() após upload |
| 2025-01-31 | Adicionada recomendação de tamanho (200x60px) na descrição do campo logo |
| 2025-01-31 | Reset do input file após upload para permitir reenvio do mesmo arquivo |
