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
| Registro | Em `public.files` (folder do sistema), com `metadata { source, system_managed:true }` |
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

## "Em uso" — Matching

| Regra | Descrição |
|-------|-----------|
| Matching estrito | `file_id` > `path` > URL normalizada (sem contains/prefix) |
| Em duplicidade | `updated_at` mais recente |

**Decisão:** `media_library` não é banco do usuário; builder consome imagens do Meu Drive.

---

## Hooks e Utilitários Canônicos

| Arquivo | Uso |
|---------|-----|
| `src/hooks/useSystemUpload.ts` | Hook React para uploads em componentes |
| `src/lib/uploadAndRegisterToSystemDrive.ts` | Função utilitária para upload + registro |
| `src/lib/registerFileToDrive.ts` | Funções auxiliares (ensureSystemFolderAndGetId, fileExistsInDrive) |

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

## Histórico de Alterações

| Data | Alteração |
|------|-----------|
| 2026-02-17 | Adicionadas pastas "Imagens de Produtos" e "Gestor de Tráfego IA" — sincronização automática de imagens do catálogo para o Meu Drive |
| 2026-02-14 | Adicionadas regras de estabilidade do DriveFilePicker: `stopPropagation` no DialogContent e `type="button"` no botão do Drive |
| 2026-02-14 | Adicionada seção de Visibilidade de Criativos — regras de `object-contain` vs `object-cover` |
| 2026-02-14 | Corrigido `CalendarItemDialog` e `AssetVariantsGallery` para não cortar imagens |
| 2025-02-13 | Integrado UniversalImageUploader no PublicationDialog (Feed + Stories) e CalendarItemDialog |
| 2025-02-13 | Corrigido Stories sem opção de upload manual de criativos |
| 2025-01-31 | Corrigido fluxo de substituição de logo/favicon para chamar onChange() após upload |
| 2025-01-31 | Adicionada recomendação de tamanho (200x60px) na descrição do campo logo |
| 2025-01-31 | Reset do input file após upload para permitir reenvio do mesmo arquivo |
