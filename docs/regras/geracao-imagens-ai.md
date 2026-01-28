# Geração de Imagens e Vídeos com IA — Regras Canônicas

> **REGRA CRÍTICA:** A geração de mídia usa **Fal.AI** com modelos específicos para imagens e vídeos.

---

## Arquitetura

| Componente | Descrição |
|------------|-----------|
| **Provider** | Fal.AI (chave de API global da plataforma) |
| **Modelo (image-to-image)** | `gpt-image-1.5/edit` — quando há produto detectado no prompt |
| **Modelo (text-to-image)** | `gpt-image-1.5` — quando não há produto específico |
| **Modelo (video)** | `sora-2/image-to-video/pro` — vídeo premium a partir de imagem de referência |
| **Credencial** | `FAL_API_KEY` em `platform_credentials` |

---

## Geração de Imagens

### Fluxo

```
1. Cliente cria criativo no calendário de mídia
2. Cliente solicita geração de imagem
3. Edge Function `media-generate-image`:
   - Busca produtos mencionados no prompt (nome, SKU)
   - Identifica imagem principal do produto
   - Cria registro em `media_asset_generations` (status: queued)
   - Dispara processamento
4. Edge Function `media-process-generation-queue`:
   - Se produto detectado: baixa imagem do produto
   - Chama Fal.AI com imagem de referência (image-to-image)
   - Salva resultado em `media-assets` bucket
   - Atualiza calendar item com URL
```

---

## Geração de Vídeos (Sora 2 Pro)

### Modelo

| Especificação | Valor |
|---------------|-------|
| **Modelo** | `fal-ai/sora-2/image-to-video/pro` |
| **Tipo** | Image-to-Video (usa imagem como referência criativa) |
| **Durações** | 5s, 10s, 15s, 20s |
| **Aspect Ratios** | 16:9, 9:16, 1:1 |
| **Qualidade** | Premium, cinematográfico |
| **Áudio** | Gerado automaticamente pelo modelo |

### Fluxo

```
1. Cliente seleciona duração desejada (5s a 20s)
2. Edge Function `media-generate-video`:
   - Busca produtos mencionados no prompt
   - Identifica imagem principal do produto
   - Cria registro em `media_asset_generations` com metadata de vídeo
   - Dispara processamento
3. Edge Function `media-process-generation-queue`:
   - Detecta que é geração de vídeo (settings.asset_type === 'video')
   - Envia para Fal.AI queue (sora-2/image-to-video/pro)
   - Polling até conclusão (pode levar 1-5 minutos)
   - Salva resultado .mp4 em `media-assets` bucket
   - Atualiza variante com URL do vídeo
```

### Uso da Imagem de Produto

**IMPORTANTE:** A imagem do produto é usada como **REFERÊNCIA CRIATIVA**, não como frame fixo:

| Cenário | Comportamento |
|---------|---------------|
| **Pessoas segurando produto** | ✅ Permitido — IA pode criar cenas com pessoas |
| **Produto em superfície** | ✅ Permitido — ambientes lifestyle |
| **Produto em movimento** | ✅ Permitido — rotação, zoom, partículas |
| **Alterar rótulo/design** | ❌ PROIBIDO — manter fidelidade visual |
| **Kit (múltiplos produtos)** | Produtos devem estar em superfície, não nas mãos |

### Exemplo de Uso

```
Prompt do cliente: "Um homem de meia idade sorrindo e segurando o Shampoo Calvície Zero"

Sistema:
1. Detecta "Shampoo Calvície Zero" no prompt
2. Busca produto com esse nome no catálogo do tenant
3. Recupera imagem principal do produto
4. Envia para Fal.AI com instrução:
   "Use a imagem do produto como referência criativa para manter fidelidade
    visual. Pode criar cenas com pessoas segurando o produto. Preservar cores,
    rótulo e design exato."
5. Gera vídeo com o produto REAL na cena solicitada
```

---

## Detecção Automática de Produtos

O sistema **busca automaticamente** produtos mencionados no prompt:

| Método | Descrição |
|--------|-----------|
| **Match exato** | Nome completo do produto está no texto |
| **Match por palavras** | ≥50% das palavras significativas (>3 chars) do nome |
| **Kit detection** | Produto com "kit" no nome ou múltiplos produtos mencionados |

---

## Regras de Negócio

| Regra | Descrição |
|-------|-----------|
| **Produto sem imagem** | BLOQUEAR geração — exigir cadastro da imagem primeiro |
| **Kit na mão** | PROIBIDO — kits devem ser apresentados em superfície |
| **Produto único** | Pode ser segurado (máx. 1 por mão) |
| **Fidelidade** | A mídia gerada deve preservar rótulo, cores e design do produto real |

---

## Proibições no Prompt (Anti-Alucinação)

- NÃO inventar rótulos, logos ou textos na embalagem
- NÃO alterar cores ou design do produto
- NÃO duplicar o produto na cena
- NÃO adicionar texto sobreposto
- NÃO criar produtos genéricos ou "parecidos"
- NÃO distorcer o produto durante animação de vídeo

---

## Arquivos Relacionados

| Se for editar... | Leia este doc primeiro |
|------------------|------------------------|
| `supabase/functions/media-generate-image/index.ts` | Este documento |
| `supabase/functions/media-generate-video/index.ts` | Este documento |
| `supabase/functions/media-process-generation-queue/index.ts` | Este documento |
| `src/components/media/AssetVariantsGallery.tsx` | Este documento |
| `src/hooks/useAssetGeneration.ts` | Este documento |

---

## Configuração da Plataforma

A chave `FAL_API_KEY` deve ser configurada em:
- **Rota:** `/platform-integrations`
- **Seção:** Fal.AI
- **Armazenamento:** `platform_credentials` (tabela de credenciais globais)

### Fluxo de Credenciais nas Edge Functions

Todas as Edge Functions de geração usam `getCredential()` do shared module:

```typescript
import { getCredential } from "../_shared/platform-credentials.ts";

const falApiKey = await getCredential(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  "FAL_API_KEY"
);
```

**Prioridade de busca:**
1. Banco de dados (`platform_credentials`) — preferencial
2. Variável de ambiente (fallback)

---

## Custos Estimados

| Operação | Custo Estimado |
|----------|----------------|
| gpt-image-1.5/edit (image-to-image) | ~$0.02/imagem |
| gpt-image-1.5 (text-to-image) | ~$0.02/imagem |
| sora-2/image-to-video/pro (5s) | ~$0.15/vídeo |
| sora-2/image-to-video/pro (10s) | ~$0.25/vídeo |
| sora-2/image-to-video/pro (15s) | ~$0.35/vídeo |
| sora-2/image-to-video/pro (20s) | ~$0.45/vídeo |

---

## UI/UX

### Galeria de Criativos

| Elemento | Comportamento |
|----------|---------------|
| **Botão "Gerar imagem"** | Gera 1 imagem com IA |
| **Selector de duração** | Dropdown com opções: 5s, 10s, 15s, 20s |
| **Botão "Gerar vídeo"** | Gera vídeo com duração selecionada |
| **Preview de vídeo** | Hover para play automático, ícone de play sobreposto |
| **Aprovação** | Mesmo fluxo de imagens — aprovar publica o vídeo |

---

## Troubleshooting

| Problema | Solução |
|----------|---------|
| "FAL_API_KEY não configurada" | Configurar em Integrações da Plataforma > IA > Fal.AI |
| "Produto não tem imagem" | Cadastrar imagem principal do produto antes de gerar |
| "Falha ao baixar imagem" | Verificar se URL da imagem do produto é pública/acessível |
| "Polling timeout" | Vídeos podem levar até 5 minutos — tentar novamente |
| "Vídeo sem áudio" | Sora 2 Pro gera áudio automaticamente — verificar player |
