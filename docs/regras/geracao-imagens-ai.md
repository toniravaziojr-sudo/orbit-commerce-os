# Geração de Imagens com IA — Regras Canônicas

> **REGRA CRÍTICA:** A geração de imagens usa **Fal.AI** com o modelo `gpt-image-1.5/edit` para composição com produtos reais.

---

## Arquitetura

| Componente | Descrição |
|------------|-----------|
| **Provider** | Fal.AI (chave de API global da plataforma) |
| **Modelo (image-to-image)** | `gpt-image-1.5/edit` — quando há produto detectado no prompt |
| **Modelo (text-to-image)** | `gpt-image-1.5` — quando não há produto específico |
| **Credencial** | `FAL_API_KEY` em `platform_credentials` |

---

## Fluxo de Geração

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

## Detecção Automática de Produtos

O sistema **busca automaticamente** produtos mencionados no prompt:

| Método | Descrição |
|--------|-----------|
| **Match exato** | Nome completo do produto está no texto |
| **Match por palavras** | ≥50% das palavras significativas (>3 chars) do nome |
| **Kit detection** | Produto com "kit" no nome ou múltiplos produtos mencionados |

### Exemplo de Uso

```
Prompt do cliente: "Um homem de meia idade sorrindo e segurando o Shampoo Calvície Zero"

Sistema:
1. Detecta "Shampoo Calvície Zero" no prompt
2. Busca produto com esse nome no catálogo do tenant
3. Recupera imagem principal do produto
4. Envia para Fal.AI com gpt-image-1.5/edit
5. Gera imagem com o produto REAL na cena solicitada
```

---

## Regras de Negócio

| Regra | Descrição |
|-------|-----------|
| **Produto sem imagem** | BLOQUEAR geração — exigir cadastro da imagem primeiro |
| **Kit na mão** | PROIBIDO — kits devem ser apresentados em superfície |
| **Produto único** | Pode ser segurado (máx. 1 por mão) |
| **Fidelidade** | A imagem gerada deve preservar rótulo, cores e design do produto real |

---

## Proibições no Prompt (Anti-Alucinação)

- NÃO inventar rótulos, logos ou textos na embalagem
- NÃO alterar cores ou design do produto
- NÃO duplicar o produto na cena
- NÃO adicionar texto sobreposto
- NÃO criar produtos genéricos ou "parecidos"

---

## Arquivos Relacionados

| Se for editar... | Leia este doc primeiro |
|------------------|------------------------|
| `supabase/functions/media-generate-image/index.ts` | Este documento |
| `supabase/functions/media-process-generation-queue/index.ts` | Este documento |
| `src/components/media/AssetVariantsGallery.tsx` | Este documento |
| `src/hooks/useAssetGeneration.ts` | Este documento |

---

## Configuração da Plataforma

A chave `FAL_API_KEY` deve ser configurada em:
- **Rota:** `/platform-integrations`
- **Seção:** Fal.AI
- **Armazenamento:** `platform_credentials` (tabela de credenciais globais)

---

## Custos Estimados

| Operação | Custo Estimado |
|----------|----------------|
| gpt-image-1.5/edit (image-to-image) | ~$0.02/imagem |
| gpt-image-1.5 (text-to-image) | ~$0.02/imagem |

---

## Troubleshooting

| Problema | Solução |
|----------|---------|
| "FAL_API_KEY não configurada" | Configurar em Integrações da Plataforma > IA > Fal.AI |
| "Produto não tem imagem" | Cadastrar imagem principal do produto antes de gerar |
| "Falha ao baixar imagem" | Verificar se URL da imagem do produto é pública/acessível |
| "Polling timeout" | Geração demorou muito — tentar novamente |
