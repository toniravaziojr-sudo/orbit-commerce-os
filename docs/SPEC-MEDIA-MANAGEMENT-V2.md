# Especificação: Sistema de Gestão de Mídias v2.0

## Visão Geral

Refatoração completa do módulo de Gestão de Mídias para criar um fluxo mais intuitivo baseado em **cards** como unidade central de criação de conteúdo. O sistema permitirá criação manual e geração por IA de forma integrada.

---

## 1. Criação de Campanha (CreateCampaignDialog)

### Mudanças Necessárias

**REMOVER:**
- ❌ Etapa de seleção de canais (step "channel")
- ❌ Dois passos no dialog

**MANTER/ADICIONAR:**
- ✅ Uma única etapa com 3 campos

### Campos do Dialog

```typescript
interface CreateCampaignForm {
  name: string;              // Nome da campanha (obrigatório)
  prompt: string;            // Prompt base para direcionamento da IA (obrigatório, mín 10 chars)
  selectedMonth: string;     // Mês selecionado no formato "YYYY-MM" (apenas um mês por campanha)
}
```

### UI do Seletor de Mês

- Botões horizontais mostrando os próximos 6 meses
- Formato: Mês abreviado + ano (ex: "Jan 25", "Fev 25", "Mar 25")
- Primeiro botão = mês atual
- Apenas UM mês pode ser selecionado por campanha
- Ao selecionar, definir `start_date` e `end_date` automaticamente como 1º e último dia do mês

### Regra de Datas

- Se mês atual: `start_date` = hoje, `end_date` = último dia do mês
- Se mês futuro: `start_date` = 1º do mês, `end_date` = último dia do mês

---

## 2. Calendário da Campanha (CampaignCalendar)

### Visualização dos Cards

- Cada dia do calendário é um **card**
- Cards de datas especiais (feriados/datas comemorativas) devem ter **borda vermelha** ou indicador visual diferenciado
- O calendário mostra apenas dias do mês da campanha
- Dias passados (anteriores a hoje) ficam desabilitados visualmente

### Status dos Cards (Legendas Simplificadas)

```typescript
const STATUS_CONFIG = {
  draft: { label: "Rascunho", color: "bg-muted text-muted-foreground" },
  approved: { label: "Aprovado", color: "bg-green-100 text-green-800" },
  scheduled: { label: "Agendado", color: "bg-blue-100 text-blue-800" },
  published: { label: "Publicado", color: "bg-green-600 text-white" },
  failed: { label: "Com Erros", color: "bg-red-100 text-red-800" }
};
```

**REMOVER os status:**
- ❌ suggested
- ❌ review
- ❌ generating_asset
- ❌ asset_review
- ❌ publishing
- ❌ skipped

### Ícones de Publicações no Card

Após criar publicação(ões), o card exibe ícones com contador:

| Canal/Tipo | Ícone | Cor |
|------------|-------|-----|
| Instagram Feed | Instagram logo | Rosa/Magenta |
| Instagram Story | "S" | Laranja |
| Facebook Feed | Facebook logo | Azul |
| Facebook Story | "S" | Azul claro |
| Blog | Newspaper/Document | Cinza |

Exemplo visual:
```
┌─────────────────┐
│ 15 🎄           │ ← Data + emoji de feriado (se houver)
│                 │
│ 📷1  S2  📰1    │ ← IG(1), Stories(2), Blog(1)
│                 │
│ [Rascunho]      │ ← Status badge
└─────────────────┘
```

---

## 3. Criação de Publicação (PublicationDialog - NOVO)

### Fluxo ao Clicar no Card

**Passo 1: Escolher Tipo de Publicação**

```typescript
type PublicationType = "feed" | "stories" | "blog";
```

- Seleção de APENAS UM tipo por vez
- UI: 3 botões grandes com ícone e descrição

**Passo 2: Escolher Canais (apenas para Feed e Stories)**

Se escolheu `feed` ou `stories`:
```typescript
const socialChannels = [
  { id: "instagram", label: "Instagram", icon: Instagram },
  { id: "facebook", label: "Facebook", icon: Facebook }
];
```
- Pode escolher UM ou AMBOS

Se escolheu `blog`:
- Não mostra opção de canal (vai direto para próximo passo)

**Passo 3: Campos Específicos por Tipo**

#### Feed (Instagram/Facebook):
```typescript
interface FeedPublication {
  image: File | string;      // Upload de imagem (formato 1:1 ou 4:5)
  copy: string;              // Legenda do post
  hashtags: string[];        // Hashtags
  cta: string;               // Call to action
  scheduled_time: string;    // Horário de publicação (HH:MM)
  channels: string[];        // ["instagram", "facebook"]
}
```

#### Stories (Instagram/Facebook):
```typescript
interface StoryPublication {
  image: File | string;      // Upload de imagem (formato 9:16)
  scheduled_time: string;    // Horário de publicação (HH:MM)
  channels: string[];        // ["instagram", "facebook"]
}
```

#### Blog:
```typescript
interface BlogPublication {
  title: string;             // Título do artigo
  content: string;           // Conteúdo em markdown/texto rico
  cover_image?: File | string; // Imagem de capa (opcional)
}
```

### Limites por Card

```typescript
const PUBLICATION_LIMITS = {
  feed: 4,      // Máximo 4 publicações de feed por dia
  stories: 10,  // Máximo 10 stories por dia
  blog: 2       // Máximo 2 artigos de blog por dia
};
```

- Ao tentar exceder: mostrar toast de aviso
- Desabilitar botão de adicionar quando no limite

---

## 4. Botões de Ação (Topo do Calendário)

### Layout dos Botões

```
┌──────────────────────────────────────────────────────────────────┐
│ [Selecionar Cards] [Criar Estratégia IA] [Gerar Criativos] [Agendar] │
└──────────────────────────────────────────────────────────────────┘
```

### a) Selecionar Cards (já existe - manter)
- Toggle de modo seleção
- Contador de cards selecionados
- Visual: cards selecionados ficam com borda azul/primary

### b) Criar Estratégia IA (NOVO - sobrescreve conteúdo existente)

**Função:** Usar Lovable AI para criar toda a estratégia de conteúdo

**Comportamento:**
1. Avisa que irá sobrescrever conteúdo existente
2. Para cada card selecionado, a IA decide:
   - Quantas publicações fazer
   - Em quais canais (IG feed, IG stories, FB feed, FB stories, Blog)
   - Cria as copies
   - Cria os prompts para geração de criativos
   - Busca nomes REAIS dos produtos do tenant (não genéricos)
3. Salva os itens no banco com status `draft`

**Edge Function:** `media-generate-strategy` (criar nova ou adaptar `media-generate-suggestions`)

**Contexto para IA:**
- Produtos do tenant (nome, preço, descrição, slug)
- Categorias
- Promoções ativas
- Datas comemorativas do período
- Prompt base da campanha

**Output esperado da IA:**
```typescript
interface AIStrategyItem {
  scheduled_date: string;
  publication_type: "feed" | "stories" | "blog";
  channels: string[];
  title: string;
  copy: string;
  hashtags?: string[];
  cta?: string;
  generation_prompt: string;  // Prompt para gerar o criativo
  product_references?: string[]; // Slugs dos produtos mencionados
  scheduled_time?: string;
}
```

### c) Gerar Criativos (Lovable AI + OpenAI)

**Regras de Roteamento:**

1. **Criativos SEM produtos** → Lovable AI (gemini-2.5-flash-image ou equivalente)
   - Cenários, conceitos, lifestyle
   - Imagens de capa de blog

2. **Criativos COM produtos** → OpenAI (dall-e-3)
   - Buscar a imagem real do produto (campo `thumb_url` ou primeira imagem de `product_images`)
   - Usar como referência para composição
   - Product slug -> buscar produto -> obter imagem

**Edge Function:** `media-generate-creative` (adaptar `media-generate-image`)

**Fluxo:**
1. Para cada item com `generation_prompt` preenchido:
2. Verificar se tem `product_references`
3. Se sim: usar OpenAI + imagem do produto
4. Se não: usar Lovable AI
5. Salvar imagem gerada no Storage
6. Atualizar `asset_url` do item

### d) Agendar Publicações

**Função:** Enviar publicações aprovadas para agendamento via Late

**Pré-requisitos:**
- Integração Late conectada
- Itens com status `approved`
- Itens com `asset_url` preenchido (para feed/stories)

**Edge Function:** `late-schedule-post` (já existe)

---

## 5. Estrutura de Dados (Ajustes no banco)

### Tabela `media_calendar_items` - Campos a adicionar/ajustar

```sql
-- Adicionar campo para tipo de publicação
ALTER TABLE media_calendar_items 
ADD COLUMN IF NOT EXISTS publication_type text 
CHECK (publication_type IN ('feed', 'stories', 'blog'));

-- Adicionar campo para referências de produtos
ALTER TABLE media_calendar_items
ADD COLUMN IF NOT EXISTS product_references text[];

-- Adicionar campo para canais específicos (sobrescreve target_platforms para clareza)
ALTER TABLE media_calendar_items
ADD COLUMN IF NOT EXISTS channels text[];
```

### Status simplificados no enum

Verificar se o enum `media_item_status` pode ser ajustado ou se usamos os valores existentes com nova semântica.

---

## 6. Regras de Sobrescrita

**Regra Central:**
> Quando o usuário usa qualquer botão de ação da IA, ela sobrescreve o conteúdo existente nos cards selecionados.

**Fluxo Correto (para quem quer usar IA):**
1. Criar campanha
2. Selecionar dias desejados
3. Clicar "Criar Estratégia IA" → IA preenche tudo
4. Revisar/ajustar manualmente se necessário
5. Clicar "Gerar Criativos" → IA gera imagens
6. Revisar criativos
7. Aprovar itens
8. Clicar "Agendar" → Envia para Late

**Fluxo Manual (sem IA):**
1. Criar campanha
2. Clicar em cada card manualmente
3. Criar publicações uma a uma
4. Upload de imagens manual
5. Aprovar
6. Agendar

---

## 7. Componentes a Criar/Modificar

### Novos Componentes

1. `src/components/media/PublicationDialog.tsx` - Dialog multi-step para criar publicação
2. `src/components/media/PublicationTypeSelector.tsx` - Seletor de tipo (feed/stories/blog)
3. `src/components/media/ChannelSelector.tsx` - Seletor de canais (IG/FB)
4. `src/components/media/FeedPublicationForm.tsx` - Formulário para feed
5. `src/components/media/StoryPublicationForm.tsx` - Formulário para stories
6. `src/components/media/BlogPublicationForm.tsx` - Formulário para blog
7. `src/components/media/CardPublicationIcons.tsx` - Ícones de publicações no card

### Componentes a Modificar

1. `src/components/media/CreateCampaignDialog.tsx` - Simplificar para um passo
2. `src/components/media/CampaignCalendar.tsx` - Novo visual dos cards, nova legenda
3. `src/components/media/CalendarItemDialog.tsx` - Substituir por PublicationDialog

### Edge Functions a Criar/Modificar

1. `supabase/functions/media-generate-strategy/index.ts` - Nova ou adaptar suggestions
2. `supabase/functions/media-generate-creative/index.ts` - Roteamento Lovable AI vs OpenAI

---

## 8. Ordem de Implementação Sugerida

### Fase 1: Fundação
1. Migração de banco (novos campos)
2. Simplificar CreateCampaignDialog (seletor de mês)
3. Atualizar status/legendas no CampaignCalendar

### Fase 2: UI dos Cards
1. Visual dos cards com ícones de publicação
2. Borda vermelha para datas especiais
3. Componente CardPublicationIcons

### Fase 3: Criação de Publicação
1. PublicationDialog com fluxo multi-step
2. Formulários específicos por tipo
3. Validação de limites

### Fase 4: IA - Estratégia
1. Edge function media-generate-strategy
2. Integração com contexto do tenant
3. Busca de produtos reais

### Fase 5: IA - Criativos
1. Roteamento Lovable AI vs OpenAI
2. Busca de imagens de produtos
3. Geração e salvamento

### Fase 6: Agendamento
1. Integração com Late (já existe)
2. Atualização de status

---

## 9. Critérios de Aceite

- [ ] Campanha criada em um passo com seletor de mês
- [ ] Cards mostram ícones de publicações com contador
- [ ] Datas especiais têm borda vermelha
- [ ] Legendas simplificadas (5 status)
- [ ] Publicação criada via dialog multi-step
- [ ] Limites respeitados (4 feed, 10 stories, 2 blog)
- [ ] "Criar Estratégia IA" gera conteúdo para cards selecionados
- [ ] IA usa nomes reais de produtos do tenant
- [ ] "Gerar Criativos" roteia corretamente (Lovable AI vs OpenAI)
- [ ] Criativos com produtos usam imagem real do produto
- [ ] Agendamento via Late funciona
- [ ] Sobrescrita funciona corretamente

---

## 10. Notas Técnicas

### Integração Lovable AI

```typescript
// Para geração de imagens (criativos sem produto)
const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
  method: "POST",
  headers: {
    Authorization: `Bearer ${LOVABLE_API_KEY}`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    model: "google/gemini-2.5-flash-image-preview",
    messages: [{ role: "user", content: prompt }],
    modalities: ["image", "text"]
  })
});
```

### OpenAI para Produtos

```typescript
// Para criativos com produtos (usando imagem real)
const response = await openai.images.generate({
  model: "dall-e-3",
  prompt: `${prompt}. Include the product shown in the reference.`,
  size: "1024x1024",
  quality: "hd"
});
```

### Busca de Imagem do Produto

```typescript
// Buscar imagem do produto pelo slug
const { data: product } = await supabase
  .from("products")
  .select("thumb_url, product_images!inner(url)")
  .eq("slug", productSlug)
  .single();

const productImageUrl = product?.thumb_url || product?.product_images?.[0]?.url;
```

---

*Documento criado em: 2026-01-08*
*Versão: 2.0*
