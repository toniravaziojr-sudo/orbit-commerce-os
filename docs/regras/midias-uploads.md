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

## Arquivos Relacionados

| Se for editar... | Leia este doc primeiro |
|------------------|------------------------|
| `src/hooks/useSystemUpload.ts` | Este documento |
| `src/lib/uploadAndRegisterToSystemDrive.ts` | Este documento |
| `src/lib/registerFileToDrive.ts` | Este documento |
| Qualquer componente com upload de imagem | Este documento |
