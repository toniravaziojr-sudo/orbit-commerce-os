
# Plano: Sistema de Upload Universal com Integração ao Meu Drive

## Visão Geral

Implementar um sistema de upload universal que permita aos usuários escolher entre fazer upload direto do computador OU selecionar arquivos já existentes no "Meu Drive" completo (todas as pastas, não apenas "Uploads do sistema").

---

## Arquitetura da Solução

```text
┌─────────────────────────────────────────────────────────────────────┐
│                    UniversalImageUploader                           │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐                 │
│  │   Upload    │  │  Meu Drive  │  │     URL     │                 │
│  │    (PC)     │  │  (Seletor)  │  │  (Externa)  │                 │
│  └─────────────┘  └─────────────┘  └─────────────┘                 │
│         │                │                │                         │
│         ▼                ▼                ▼                         │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │                    onChange(url)                             │   │
│  └─────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
                   ┌─────────────────────┐
                   │  DriveFilePicker    │
                   │  (Modal Completo)   │
                   ├─────────────────────┤
                   │ • Navegar pastas    │
                   │ • Buscar arquivos   │
                   │ • Preview imagem    │
                   │ • Breadcrumb        │
                   └─────────────────────┘
```

---

## Componentes a Criar

### 1. DriveFilePicker (Novo)
Modal de seleção de arquivos do Meu Drive completo com navegação por pastas.

**Localização:** `src/components/ui/DriveFilePicker.tsx`

**Funcionalidades:**
- Navegação hierárquica por todas as pastas do tenant
- Breadcrumb para navegação
- Busca por nome de arquivo
- Preview de imagem ao selecionar
- Filtro por tipo (imagem, vídeo, documento, todos)
- Compatível com o hook `useFiles` existente

**Props:**
```typescript
interface DriveFilePickerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (url: string, fileId?: string) => void;
  accept?: 'image' | 'video' | 'document' | 'all';
  title?: string;
}
```

### 2. UniversalImageUploader (Novo)
Componente unificado que substitui os diversos uploaders existentes.

**Localização:** `src/components/ui/UniversalImageUploader.tsx`

**Funcionalidades:**
- Aba "Upload" - upload direto do PC (usa `useSystemUpload`)
- Aba "Meu Drive" - abre `DriveFilePicker`
- Aba "URL" - colar URL externa (opcional)
- Preview da imagem selecionada
- Suporte a diferentes aspect ratios

**Props:**
```typescript
interface UniversalImageUploaderProps {
  value: string;
  onChange: (url: string) => void;
  source: string;           // Para registro no drive
  subPath?: string;         // Subpasta do storage
  placeholder?: string;
  aspectRatio?: 'square' | 'video' | 'banner';
  showUrlTab?: boolean;     // Mostrar aba URL (default: true)
  accept?: string;          // MIME types aceitos
  maxSize?: number;         // Tamanho máximo em MB
  label?: string;           // Label opcional
  description?: string;     // Descrição/ajuda
}
```

---

## Componentes a Refatorar

### 1. ImageUpload (Settings)
**Arquivo:** `src/components/settings/ImageUpload.tsx`

**Mudança:** Adicionar botão "Escolher do Meu Drive" que abre `DriveFilePicker`.

### 2. ProductImageUploader
**Arquivo:** `src/components/products/ProductImageUploader.tsx`

**Mudança:** Adicionar terceiro botão "Meu Drive" ao lado de "Upload" e "URL".

### 3. ProductImageManager
**Arquivo:** `src/components/products/ProductImageManager.tsx`

**Mudança:** Mesma lógica do ProductImageUploader.

### 4. ImageUploader (Builder)
**Arquivo:** `src/components/builder/ImageUploader.tsx`

**Mudança:** Substituir por `UniversalImageUploader` ou adicionar aba "Meu Drive".

### 5. ImageUploaderWithLibrary (Builder)
**Arquivo:** `src/components/builder/ImageUploaderWithLibrary.tsx`

**Mudança:** Substituir `MediaLibraryPicker` por `DriveFilePicker` para permitir navegação em todas as pastas.

### 6. HeaderSettings (Featured Promo)
**Arquivo:** `src/components/builder/theme-settings/HeaderSettings.tsx`

**Mudança:** Substituir input inline por `UniversalImageUploader`.

### 7. ProductVariantPicker (Imagens de Variantes)
**Arquivo:** `src/components/products/ProductVariantPicker.tsx`

**Mudança:** Adicionar opção de selecionar do Drive.

---

## Hooks Necessários

### 1. useDriveFiles (Novo)
Hook para listar arquivos do drive com suporte a navegação e filtros.

**Localização:** `src/hooks/useDriveFiles.ts`

```typescript
interface UseDriveFilesOptions {
  folderId?: string | null;
  fileType?: 'image' | 'video' | 'document' | 'all';
  search?: string;
}

interface UseDriveFilesResult {
  files: FileItem[];
  folders: FolderItem[];
  currentPath: PathItem[];
  isLoading: boolean;
  navigateTo: (folderId: string | null) => void;
  getFileUrl: (file: FileItem) => string;
}
```

---

## Ordem de Implementação

| Fase | Tarefa | Arquivos |
|------|--------|----------|
| 1 | Criar hook `useDriveFiles` | `src/hooks/useDriveFiles.ts` |
| 2 | Criar `DriveFilePicker` | `src/components/ui/DriveFilePicker.tsx` |
| 3 | Criar `UniversalImageUploader` | `src/components/ui/UniversalImageUploader.tsx` |
| 4 | Refatorar `ImageUploaderWithLibrary` | Substituir `MediaLibraryPicker` por `DriveFilePicker` |
| 5 | Refatorar `ProductImageUploader` | Adicionar botão "Meu Drive" |
| 6 | Refatorar `ImageUpload` (settings) | Adicionar seletor do Drive |
| 7 | Refatorar `ProductVariantPicker` | Adicionar opção do Drive |
| 8 | Atualizar `HeaderSettings` | Usar `UniversalImageUploader` |
| 9 | Testes end-to-end | Validar todos os fluxos |

---

## UI do DriveFilePicker

```text
┌────────────────────────────────────────────────────────────────┐
│  📁 Selecionar do Meu Drive                              [X]  │
├────────────────────────────────────────────────────────────────┤
│  🏠 Raiz > 📁 Marketing > 📁 Banners                          │
│                                                                │
│  🔍 [Buscar arquivos...                               ]       │
├────────────────────────────────────────────────────────────────┤
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐       │
│  │ 📁       │  │ 🖼️       │  │ 🖼️       │  │ 🖼️       │       │
│  │ Pastas   │  │ img1.jpg │  │ img2.png │  │ img3.jpg │       │
│  │ Sistema  │  │          │  │   ✓      │  │          │       │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘       │
│                                                                │
│  ┌──────────────────────────────────────────────────────────┐ │
│  │  Preview: img2.png                                       │ │
│  │  [================IMAGEM PREVIEW================]        │ │
│  │  Tamanho: 256KB • Tipo: image/png                        │ │
│  └──────────────────────────────────────────────────────────┘ │
├────────────────────────────────────────────────────────────────┤
│                          [Cancelar]  [Selecionar]             │
└────────────────────────────────────────────────────────────────┘
```

---

## Detalhes Técnicos

### Obtenção de URL do Arquivo
Ao selecionar um arquivo do Drive, usar a lógica existente em `useFiles.getFileUrl()`:
1. Verificar `metadata.url` primeiro
2. Construir URL pública via `supabase.storage.getPublicUrl()`
3. Fallback para signed URL se necessário

### Registro de Uploads
Quando upload for feito do PC, continuar usando `uploadAndRegisterToSystemDrive()` para:
1. Fazer upload para storage
2. Registrar em `public.files` na pasta "Uploads do sistema"
3. Retornar URL pública

### Compatibilidade
- Manter props existentes dos componentes refatorados
- Adicionar novas props como opcionais para não quebrar usos existentes
- O `UniversalImageUploader` pode ser usado gradualmente substituindo os antigos

---

## Atualização de Documentação

Após implementação, atualizar:
- `docs/regras/midias-uploads.md` - Adicionar seção sobre upload universal
- Documentar props do `UniversalImageUploader`
- Documentar uso do `DriveFilePicker`
