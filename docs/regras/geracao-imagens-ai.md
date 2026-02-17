# Geração de Imagens com IA — Regras Canônicas v3.0

> **REGRA CRÍTICA:** A geração de mídia usa **Lovable AI Gateway** com pipeline v3.0 **Dual Provider** (OpenAI + Gemini) e critério de seleção por **REALISMO**.

---

## Arquitetura (v3.0 — Dual Provider)

| Componente | Descrição |
|------------|-----------|
| **Provedores** | OpenAI + Gemini (multi-seleção pelo usuário) |
| **Modelo Gemini (alta qualidade)** | `google/gemini-3-pro-image-preview` |
| **Modelo Gemini (rápido)** | `google/gemini-2.5-flash-image` |
| **Modelo OpenAI** | Via Lovable AI Gateway (simulado via Gemini Pro) |
| **QA/Scoring** | `google/gemini-3-flash-preview` |
| **Critério de Seleção** | **REALISMO** (40% peso) |

---

## Estilos de Geração (v3.0)

### 1. Produto + Fundo Natural (`product_natural`)

Fotografia profissional do produto em cenário natural/studio.

| Campo | Tipo | Opções |
|-------|------|--------|
| Ambiente | Select | `studio`, `bathroom`, `kitchen`, `outdoor`, `minimal` |
| Iluminação | Select | `natural`, `studio`, `golden_hour`, `dramatic` |
| Mood | Select | `clean`, `premium`, `organic`, `warm` |

**Prompt gerado:**
- Produto idêntico à referência
- Ambiente natural sem pessoas
- Iluminação profissional
- Foco no produto, fundo desfocado

### 2. Pessoa Interagindo (`person_interacting`)

Pessoa usando/segurando o produto com aparência fotorrealista.

| Campo | Tipo | Opções |
|-------|------|--------|
| Ação | Select | `holding`, `using`, `showing` |
| Perfil da Pessoa | Text | Descrição livre (ex: "mulher jovem, cabelos castanhos") |
| Tom | Select | `ugc`, `demo`, `review`, `lifestyle` |

**Prompt gerado:**
- Pessoa com aparência natural (não IA)
- Mão segura pela BASE (rótulo frontal visível)
- Modo Label Lock para substituição do produto

### 3. Promocional (`promotional`)

Imagem publicitária de alto impacto visual.

| Campo | Tipo | Opções |
|-------|------|--------|
| Intensidade de Efeitos | Select | `low`, `medium`, `high` |
| Elementos Visuais | Multi-select | `glow`, `particles`, `splash`, `rays`, `bokeh` |
| Texto Overlay | Text | Opcional (pode falhar em legibilidade) |

**Prompt gerado:**
- Visual impactante para anúncios
- Cores vibrantes e contraste alto
- Efeitos não cobrem o rótulo

---

## Pipeline de Geração

### Fluxo v3.0

```
1. DOWNLOAD: Baixar imagem do produto como referência
2. PROMPT: Montar prompt otimizado por estilo
3. GENERATE: Gerar com provedor(es) selecionado(s)
4. QA: Avaliar REALISMO por scoring automático
5. SELECT: Ordenar por score (realismo 40% peso)
6. UPLOAD: Salvar no storage com metadados
7. WINNER: Marcar melhor resultado como "is_winner: true"
```

### Comportamento por Seleção de Provedores

| Cenário | Comportamento |
|---------|---------------|
| **Apenas Gemini** | Gera N variações com Gemini |
| **Apenas OpenAI** | Gera N variações com OpenAI (via Gateway) |
| **Ambos (recomendado)** | Gera com AMBOS em paralelo, seleciona o mais realista |

### Scoring de Realismo

| Critério | Peso | Descrição |
|----------|------|-----------|
| **Realism** | 40% | Parece foto real? Sem artefatos de IA? |
| **Label** | 25% | Rótulo fiel e legível? |
| **Quality** | 20% | Qualidade técnica (nitidez, resolução)? |
| **Composition** | 15% | Enquadramento e composição adequados? |

**Score mínimo para aprovação:** 70%

---

## Princípio Fundamental: Produto Imutável + Label Lock

**REGRA CRÍTICA — PRODUTO IMUTÁVEL:**
O produto cadastrado no catálogo é **SAGRADO e IMUTÁVEL**. A IA **NUNCA** pode:
- Redesenhar, recriar ou reimaginar o produto
- Mudar embalagem, rótulo, formato, cores ou proporções
- Criar variações do produto (frascos diferentes, tamanhos diferentes, embalagens fictícias)
- Inventar produtos que não existem na imagem de referência
- Multiplicar o produto além do que o briefing pede

A IA **PODE APENAS**:
- Mudar o AMBIENTE/CENÁRIO ao redor do produto (fundo, superfície, iluminação)
- Adicionar CONTEXTO (mãos segurando, bancada, flatlay)
- Aplicar efeitos leves de iluminação/sombra NO AMBIENTE (nunca no produto)
- Posicionar o produto em diferentes ângulos (mantendo fidelidade total)

**Label Lock:** Modelos de geração de imagem distorcem texto quando tentam "desenhar letras". O rótulo do produto **NUNCA** deve ser gerado pela IA. O pipeline **Label Lock** compõe o produto real (recortado) sobre a cena gerada, garantindo texto/rótulo 100% fiel.

---

## UI/UX (aba Imagens v3.0)

### Seleção de Provedores (topo)

| Componente | Tipo | Default |
|------------|------|---------|
| OpenAI | Toggle | ✅ ON |
| Gemini | Toggle | ✅ ON |

**Regra:** Se ambos desligados → bloquear botão "Gerar".

### Seleção de Estilo

| Estilo | Descrição |
|--------|-----------|
| Produto + Fundo (Natural) | Foto de produto em ambiente |
| Pessoa Interagindo | UGC/Lifestyle com modelo |
| Promocional (Efeitos) | Visual publicitário impactante |

### Campos Comuns

| Campo | Tipo | Obrigatório |
|-------|------|-------------|
| Produto | Select (catálogo) | ✅ Sim |
| Contexto/Brief | Textarea | Não |
| Formato | Select (`1:1`, `9:16`, `16:9`) | Não |
| Variações | Slider (1-4) | Não |

### Campos Dinâmicos por Estilo

Os campos específicos aparecem baseados no estilo selecionado.

### Estimativa de Custo

| Provedor | Custo/Imagem |
|----------|--------------|
| Gemini | ~R$ 0,17 |
| OpenAI | ~R$ 0,35 |
| QA (por imagem) | ~R$ 0,04 |

**Exemplo:** 2 variações com ambos provedores ≈ R$ 1,20

---

## Edge Function: `creative-image-generate`

### Endpoint

```
POST /functions/v1/creative-image-generate
Authorization: Bearer <token>
```

### Body

```json
{
  "tenant_id": "uuid",
  "product_id": "uuid",
  "product_name": "Nome do Produto",
  "product_image_url": "https://...",
  "prompt": "Brief opcional",
  "settings": {
    "providers": ["openai", "gemini"],
    "generation_style": "person_interacting",
    "format": "1:1",
    "variations": 2,
    "style_config": {
      "action": "holding",
      "personProfile": "mulher jovem",
      "tone": "lifestyle"
    },
    "enable_qa": true,
    "enable_fallback": true,
    "label_lock": true
  }
}
```

### Response

```json
{
  "success": true,
  "data": {
    "job_id": "uuid",
    "status": "running",
    "message": "Job iniciado. Acompanhe o progresso na lista.",
    "pipeline_version": "3.0.0",
    "providers": ["openai", "gemini"]
  }
}
```

### Resultado Final (creative_jobs.settings)

```json
{
  "results": [
    {
      "url": "https://...",
      "provider": "gemini",
      "scores": {
        "realism": 8.5,
        "quality": 9.0,
        "composition": 8.0,
        "label": 7.5,
        "overall": 0.82
      },
      "isWinner": true
    }
  ],
  "winner_provider": "gemini",
  "winner_score": 0.82
}
```

---

## Custos e Créditos

### Estimativa Antes da Geração

| Configuração | Custo Estimado |
|--------------|----------------|
| 1 provedor, 1 variação | ~R$ 0,20 |
| 1 provedor, 4 variações | ~R$ 0,80 |
| 2 provedores, 2 variações | ~R$ 1,20 |
| 2 provedores, 4 variações | ~R$ 2,40 |

### Regras de Cobrança

1. **Estimativa mostrada ANTES** de gerar
2. **Débito apenas após sucesso**
3. **Débito parcial** se um provedor falhar
4. **Registro de erro** para debug

---

## Armazenamento

### Pasta de Destino

```
/Criativos com IA/{job_id}/{provider}_{index}.png
```

### Registro em `files`

| Campo | Valor |
|-------|-------|
| `source` | `creative_job_v3` |
| `job_id` | UUID do job |
| `provider` | `openai` ou `gemini` |
| `is_winner` | `true` para melhor resultado |
| `scores` | Objeto com scores de QA |

---

## Arquivos Relacionados

| Se for editar... | Leia este doc primeiro |
|------------------|------------------------|
| `supabase/functions/creative-image-generate/index.ts` | Este documento |
| `src/components/creatives/image-generation/*.tsx` | Este documento |
| `src/components/creatives/CreativeJobsList.tsx` | Este documento |
| `src/hooks/useCreatives.ts` | Este documento |

---

## Troubleshooting

| Problema | Solução |
|----------|---------|
| "LOVABLE_API_KEY não configurada" | Verificar se Cloud está habilitado |
| "Produto não tem imagem" | Cadastrar imagem principal do produto |
| "Nenhum provedor selecionado" | Ativar ao menos OpenAI ou Gemini |
| "QA Score baixo" | Aumentar variações, tentar outro estilo |
| "Rate limit" | Aguardar alguns minutos |
| "Créditos insuficientes" | Adicionar créditos no workspace |
| "Texto do rótulo distorcido" | Ativar Label Lock (padrão) |

---

## Checklist Anti-Regressão

- [ ] Produto selecionado do catálogo
- [ ] Imagem do produto disponível e pública
- [ ] Ao menos um provedor ativo (OpenAI ou Gemini)
- [ ] Estilo selecionado com campos preenchidos
- [ ] Estimativa de custo exibida antes de gerar
- [ ] Job criado com status "running"
- [ ] Resultados ordenados por score de realismo
- [ ] Winner marcado com `is_winner: true`
- [ ] Arquivos salvos com metadados completos

---

## Integração com Ads Autopilot (v2.0.0)

A edge function `ads-autopilot-creative-generate` atua como **bridge** entre o sistema de tráfego e a geração de imagens:

### Fluxo
1. `ads-autopilot-creative-generate` gera briefs de texto (headline + copy) em `ads_creative_assets`
2. Agrupa briefs por `product_id`
3. Para cada produto, chama `creative-image-generate` via M2M (Machine-to-Machine) com `service_role` key
4. `creative-image-generate` gera imagens reais via Lovable AI Gateway (Gemini)
5. Imagens são salvas no Storage e registradas no Drive (pasta "Gestor de Tráfego IA")
6. `ads_creative_assets` é atualizado com `asset_url` e `storage_path`

### Autenticação M2M
- `creative-image-generate` aceita chamadas com `service_role` key
- `verify_jwt = false` no `config.toml`
- `creative_jobs.created_by` é nullable (permite jobs sem usuário)
- `userId = null` em chamadas M2M

### Atualização Automática de Assets (v2.0.1)
- Após pipeline completar, `creative-image-generate` busca `ads_creative_assets` com `meta.image_job_id` correspondente
- Atualiza `asset_url`, `storage_path` e `status = 'ready'`
- Tabela `files` **não possui** coluna `file_type` — apenas `mime_type` é utilizado no insert

### Publicação no Meta (v5.9.5 / v5.10.1)

Quando um `ads_creative_assets` atinge `status = 'ready'`, tanto o `ads-chat` quanto o `ads-autopilot-analyze` podem publicá-lo no Meta:

1. **Upload da imagem** para Meta via `POST /act_{id}/adimages` → obtém `image_hash`
2. **URL de destino obrigatória**: `https://{storeHost}/produto/{product_slug}` — domínio resolvido via `tenant_domains` (type=custom, is_primary=true), fallback para `slug.shops.comandocentral.com.br`
3. **Criação de `adcreative`** com `object_story_spec.link_data` contendo `image_hash`, `message`, `name`, `link` e `call_to_action`
4. **Atualização do asset**: `status → 'published'`, `platform_ad_id → creative_id` do Meta

**⚠️ NUNCA usar `tenants.custom_domain`** — esta coluna NÃO EXISTE. Sempre buscar de `tenant_domains`.

**Ciclo de vida do `status`**:
```
draft → ready → published
  ↑              ↓
  └── (falha) ←──┘
```

**Bucket de imagens**: As imagens geradas ficam no bucket `media-assets` (NÃO `files`). Fallbacks de `createSignedUrl` devem usar `supabase.storage.from("media-assets")`.

---

## Vídeos (DESATIVADOS)

> ⚠️ **Funcionalidades de vídeo estão temporariamente desativadas** enquanto migramos de fal.ai para alternativa (Runway, HeyGen, Akool, Sync Labs).

Abas desativadas:
- UGC Cliente (Vídeo)
- UGC 100% IA
- Vídeos de Produto
- Avatar Mascote
