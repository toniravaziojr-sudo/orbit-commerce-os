# Geração de Imagens e Vídeos com IA — Regras Canônicas

> **REGRA CRÍTICA:** A geração de mídia usa **Lovable AI Gateway (Gemini Image)** com pipeline completa de QA.

---

## Arquitetura (v2.0)

| Componente | Descrição |
|------------|-----------|
| **Provider** | Lovable AI Gateway (LOVABLE_API_KEY auto-provisionada) |
| **Modelo (imagem alta qualidade)** | `google/gemini-3-pro-image-preview` |
| **Modelo (imagem rápida)** | `google/gemini-2.5-flash-image` |
| **Modelo (QA/texto)** | `google/gemini-3-flash-preview` |
| **Vídeos** | ⚠️ DESATIVADOS TEMPORARIAMENTE (migração em andamento) |

---

## Pipeline Completa de Geração de Imagens (v2.0)

### Fluxo

```
1. CUTOUT: Gerar recorte do produto (fundo transparente)
2. GENERATION: Gerar N variações (default 4) com imagem de referência
3. QA: Avaliar cada variação (similarity + label check)
4. FALLBACK: Se todas falharem QA, composição com produto real
5. SELECTION: Escolher melhor variação automaticamente por score
```

### Passo 1 — Product Cutout

- Gera versão do produto com fundo transparente
- Usado para QA (comparação) e fallback (composição)
- Se falhar, usa imagem original como fallback

### Passo 2 — Prompt Rewriter

O prompt do usuário é expandido com:
- Preset de cenário (banheiro, lavabo, academia, etc.)
- Descrição de personagem (gênero, idade)
- Pose/interação (segurando, usando, mostrando)
- Regras de fidelidade (alta = preservar rótulo exatamente)
- Negative prompt (proibir distorções)

### Passo 3 — Geração de Variações

- Gera N variações (1-4, default 4)
- Cada variação recebe instrução de diversificação
- Usa imagem do produto como referência obrigatória

### Passo 4 — QA Automático

| Critério | Peso | Descrição |
|----------|------|-----------|
| **Similarity** | 40% | Produto gerado parece igual ao original? |
| **Label** | 30% | Texto do rótulo está legível e correto? |
| **Quality** | 30% | Imagem tem qualidade profissional? |

- Score mínimo para aprovação: **70%**
- Imagens reprovadas são descartadas
- Se QA falhar (API indisponível), aprova com score 60%

### Passo 5 — Fallback por Composição

Se TODAS as variações falharem no QA:

1. Gera cena com pessoa + mão vazia
2. Compõe o produto real (cutout) na mão
3. Ajusta sombra, iluminação e oclusão

**Objetivo:** Garantir entrega com 100% de fidelidade ao produto.

### Passo 6 — Seleção Automática

- Variações aprovadas são ordenadas por score
- A melhor é marcada como `is_best: true`
- Todas ficam disponíveis para o usuário escolher

---

## UI/UX (aba Imagens)

### Formulário

| Campo | Tipo | Default | Descrição |
|-------|------|---------|-----------|
| Produto | Select (obrigatório) | — | Selecionar do catálogo |
| Cenário | Select | bathroom | Preset de ambiente |
| Gênero | Select | any | Feminino/Masculino/Qualquer |
| Faixa Etária | Select | middle | Jovem/Meia Idade/Maduro |
| Pose | Select | holding | Segurando/Usando/Mostrando |
| Qualidade | Select | high | Standard/Alta |
| Fidelidade | Select | high | Baixa/Média/Alta |
| Variações | Slider | 4 | 1-4 variações |
| QA Automático | Switch | ON | Avaliar fidelidade |
| Fallback | Switch | ON | Composição se falhar |

### Histórico de Jobs

| Info | Descrição |
|------|-----------|
| Status | queued/running/succeeded/failed |
| QA Score | Porcentagem de qualidade (0-100%) |
| Melhor Variação | Índice da variação selecionada |
| Aprovadas | X de Y variações passaram no QA |
| Pipeline Version | v2.0.0 |
| Etapa Atual | Cutout/Geração/QA/Seleção |

---

## Regras de Negócio

| Regra | Descrição |
|-------|-----------|
| **Produto obrigatório** | Não gera sem produto selecionado |
| **Imagem obrigatória** | Produto deve ter imagem cadastrada |
| **Kit na mão** | PROIBIDO — kits em superfície |
| **Fidelidade** | Rótulo, cores e design preservados |
| **QA Score < 70%** | Imagem reprovada automaticamente |
| **Todas reprovadas** | Fallback por composição |

---

## Custos Estimados (v2.0)

| Operação | Custo Estimado |
|----------|----------------|
| Cutout (gemini-flash-image) | ~R$ 0,05 |
| Variação (gemini-pro-image) | ~R$ 0,10 |
| QA (gemini-flash) | ~R$ 0,05/variação |
| Fallback (composição) | ~R$ 0,20 |

**Exemplo:** 4 variações + QA ≈ R$ 0,65

---

## Arquivos Relacionados

| Se for editar... | Leia este doc primeiro |
|------------------|------------------------|
| `supabase/functions/creative-image-generate/index.ts` | Este documento |
| `src/components/creatives/ProductImageTab.tsx` | Este documento |
| `src/components/creatives/CreativeJobsList.tsx` | Este documento |
| `src/hooks/useCreatives.ts` | Este documento |

---

## Vídeos (DESATIVADOS)

> ⚠️ **Funcionalidades de vídeo estão temporariamente desativadas** enquanto migramos de fal.ai para alternativa.

Abas desativadas:
- UGC Cliente (Vídeo)
- UGC 100% IA
- Vídeos de Produto
- Avatar Mascote

---

## Troubleshooting

| Problema | Solução |
|----------|---------|
| "LOVABLE_API_KEY não configurada" | Verificar se Cloud está habilitado |
| "Produto não tem imagem" | Cadastrar imagem principal do produto |
| "QA Score baixo" | Aumentar variações para 4, usar fidelidade alta |
| "Todas reprovadas" | Fallback será acionado automaticamente |
| "Rate limit" | Aguardar alguns minutos e tentar novamente |
| "Créditos insuficientes" | Adicionar créditos no workspace |

---

## Checklist Anti-Regressão

- [ ] Produto selecionado do catálogo
- [ ] Imagem do produto disponível e pública
- [ ] QA automático habilitado (recomendado)
- [ ] Fallback habilitado (recomendado)
- [ ] Pelo menos 4 variações para maior sucesso
- [ ] Fidelidade "Alta" para produtos com rótulo importante
