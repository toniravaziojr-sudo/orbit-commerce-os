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

## Gestor de Mídias IA — Integração YouTube

O módulo "Gestor de Mídias IA" (`/media`) inclui integração com YouTube para upload e agendamento de vídeos.

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

---

## Arquivos Relacionados

| Se for editar... | Leia este doc primeiro |
|------------------|------------------------|
| `src/hooks/useSystemUpload.ts` | Este documento |
| `src/hooks/useDriveFiles.ts` | Este documento |
| `src/lib/uploadAndRegisterToSystemDrive.ts` | Este documento |
| `src/lib/registerFileToDrive.ts` | Este documento |
| `src/components/ui/UniversalImageUploader.tsx` | Este documento |
| `src/components/ui/DriveFilePicker.tsx` | Este documento |
| Qualquer componente com upload de imagem | Este documento |
| `src/hooks/useYouTubeConnection.ts` | Este documento |
| `src/pages/Media.tsx` | Este documento |
