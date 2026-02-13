
# Reestruturar o Gestor de Midias IA

## Problema Atual

A pagina `/media` tem abas desconectadas (Estrategia, Publicar, Conexoes) e o fluxo real acontece dentro do calendario (`CampaignCalendar`), onde todos os botoes de acao (Criar Estrategia IA, Gerar Criativos, Aprovar, Agendar) estao acumulados numa barra horizontal. Nao existe separacao clara entre fluxo manual e fluxo com IA, e as IAs nao sao especializadas o suficiente.

## Nova Arquitetura

### Fluxo Principal (simplificado)

```text
/media (lista de campanhas)
  |
  v
Criar Campanha (dialog: nome, mes, prompt de direcionamento)
  |
  v
/media/campaign/:id (calendario editorial)
  |
  +-- Manual: clicar no dia -> criar item (copy + upload de criativo)
  |
  +-- Com IA: selecionar dias -> botoes de acao sequenciais
       |
       1. "Gerar Estrategia IA" -> cria items no calendario (titulo, tema, tipo)
       2. "Gerar Copys IA" -> preenche copy, CTA, hashtags dos items
       3. "Gerar Criativos IA" -> gera imagens para os items
       4. "Aprovar" -> marca items como aprovados
       5. "Publicar" -> publica/agenda nas redes
```

### Mudancas na pagina /media (Media.tsx)

- **Remover as abas** (Estrategia, Publicar, Conexoes) - sao confusas e sem funcao real
- A pagina mostra apenas a **lista de campanhas** (`CampaignsList`) diretamente, sem Tabs
- O fluxo completo acontece dentro do calendario de cada campanha

### Mudancas no Calendario (CampaignCalendar.tsx)

**Barra de acoes redesenhada** com fluxo progressivo claro:

1. **Selecionar Dias** (ja existe) - seleciona dias no calendario
2. **Gerar Estrategia IA** (ja existe) - gera titulos/temas para os dias selecionados
3. **Gerar Copys IA** (NOVO) - preenche copy, CTA, hashtags dos items ja criados
4. **Gerar Criativos** (ja existe) - gera imagens
5. **Aprovar** (ja existe) - aprova items prontos
6. **Publicar/Agendar** (ja existe) - publica nas redes

Para o **fluxo manual**, o usuario clica no dia e preenche tudo manualmente (ja funciona via CalendarItemDialog), incluindo upload de criativo proprio.

### Nova Edge Function: `media-generate-copys`

Edge function especialista em copywriting para redes sociais. Recebe os items do calendario que ja tem titulo/tema e gera:
- **Copy/legenda** otimizada para cada plataforma
- **CTA** persuasivo
- **Hashtags** relevantes
- **Prompt de imagem** detalhado para geracao posterior

**Prompt especialista:**
- Tom de voz adaptado ao nicho da loja
- Tecnicas de copywriting (AIDA, PAS, storytelling)
- Limite de caracteres por plataforma (Instagram 2200, Facebook ilimitado)
- Emojis estrategicos
- Hashtags pesquisadas por relevancia

### Melhoria da Edge Function existente: `media-generate-suggestions`

Tornar a IA mais especialista em **estrategia de conteudo**:
- Foco em **planejamento editorial** (temas, tipos de conteudo, datas estrategicas)
- Nao gerar copys longas - apenas titulo, tema e tipo de conteudo
- Considerar datas comemorativas, sazonalidade, tendencias
- Equilibrar conteudo educativo, promocional e de engajamento
- Definir melhor a distribuicao entre stories, feed e blog

## Detalhes Tecnicos

### 1. Media.tsx - Simplificar

Remover todo o sistema de Tabs. Manter apenas:
- PageHeader
- Badges das redes (Facebook, Instagram, YouTube)
- CampaignsList diretamente

### 2. CampaignCalendar.tsx - Barra de acoes progressiva

Redesenhar a Card de acoes para mostrar botoes em sequencia logica:
- Numerar ou agrupar visualmente: "1. Estrategia" | "2. Copys" | "3. Criativos" | "4. Aprovar" | "5. Publicar"
- Cada botao so aparece/ativa quando o passo anterior esta concluido
- Adicionar botao "Gerar Copys IA" que chama a nova edge function

### 3. Nova Edge Function `media-generate-copys/index.ts`

- Recebe `campaign_id` e `tenant_id`
- Busca items com status draft/suggested que tem titulo mas nao tem copy
- Usa Lovable AI (`google/gemini-2.5-flash`) com prompt especialista em copywriting
- Atualiza os items com copy, CTA, hashtags e generation_prompt

### 4. Melhorar `media-generate-suggestions/index.ts`

- Simplificar o output: gerar apenas titulo, tema, content_type, target_platforms
- Nao gerar copy completa (isso agora e responsabilidade de `media-generate-copys`)
- Melhorar o prompt de estrategia para ser mais inteligente sobre distribuicao de conteudo

### 5. CalendarItemDialog.tsx - Upload manual de criativo

Ja suporta edicao manual de copy/hashtags/CTA. Adicionar:
- Campo de upload de imagem/criativo (usando o sistema de upload existente)
- Quando o usuario faz upload manual, preenche `asset_url` diretamente

### Arquivos Afetados

| Arquivo | Acao |
|---------|------|
| `src/pages/Media.tsx` | Remover Tabs, simplificar para lista direta |
| `src/components/media/CampaignCalendar.tsx` | Redesenhar barra de acoes, adicionar botao "Gerar Copys IA" |
| `src/components/media/CalendarItemDialog.tsx` | Adicionar upload manual de criativo |
| `supabase/functions/media-generate-copys/index.ts` | CRIAR - Edge function especialista em copys |
| `supabase/functions/media-generate-suggestions/index.ts` | Simplificar para foco em estrategia (sem copys) |
| `docs/regras/campanhas.md` | Atualizar documentacao |
