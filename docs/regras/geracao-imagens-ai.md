# Geração de Imagens e Vídeos com IA — Regras Canônicas

> **REGRA CRÍTICA:** A geração de mídia usa **Lovable AI Gateway** com pipeline v3.0 **Dual Provider** (OpenAI + Gemini).

---

## Arquitetura (v3.0 — Dual Provider)

| Componente | Descrição |
|------------|-----------|
| **Provedores** | OpenAI + Gemini (selecionável pelo usuário) |
| **Modelo Gemini (alta qualidade)** | `google/gemini-3-pro-image-preview` |
| **Modelo Gemini (rápido)** | `google/gemini-2.5-flash-image` |
| **Modelo OpenAI** | Via Lovable AI Gateway |
| **QA/Scoring** | `google/gemini-3-flash-preview` |
| **Critério de Seleção** | **REALISMO** (40% peso) |
| **Vídeos** | ⚠️ DESATIVADOS (migração em andamento) |

---

## Princípio Fundamental: NUNCA Confiar no Modelo para Texto

**REGRA CRÍTICA:** Modelos de geração de imagem distorcem texto quando tentam "desenhar letras". O rótulo do produto **NUNCA** deve ser gerado pela IA.

**Solução:** O pipeline **Label Lock** compõe o produto real (recortado) sobre a cena gerada, garantindo texto/rótulo 100% fiel.

---

## Pipeline Completa de Geração de Imagens (v2.1 — Label Lock)

### Fluxo

```
1. CUTOUT: Gerar recorte do produto (fundo transparente)
2. SCENE GENERATION: Gerar cena (pessoa + ambiente) SEM confiar no texto
3. LABEL LOCK OVERLAY: Compor produto real sobre a cena gerada
4. QA + OCR: Verificar tokens esperados via OCR
5. SELECTION: Escolher melhor variação por score
6. FALLBACK: Se tudo falhar, composição pura (mão vazia + produto real)
```

### Passo 1 — Product Cutout

- Gera versão do produto com fundo 100% transparente
- Usado para composição (Label Lock) e fallback
- Preserva nitidez do texto/rótulo

### Passo 2 — Scene Generation (Label Lock Mode)

**IMPORTANTE:** O prompt instrui o modelo a:
- Gerar a cena (pessoa, cenário, iluminação)
- NÃO se preocupar com o texto do rótulo (será substituído)
- Posicionar a mão para segurar pela base (rótulo frontal visível)

Regras no prompt:
```
O produto na imagem será SUBSTITUÍDO por composição — não se preocupe com o texto do rótulo.
Foque em criar a CENA perfeita (pessoa, mãos, iluminação, fundo).
A pessoa deve estar segurando o produto pela BASE/CORPO, deixando a FRENTE visível.
```

### Passo 3 — Label Lock Overlay

**ETAPA CRÍTICA:** Compor o produto real sobre a cena gerada.

| Operação | Descrição |
|----------|-----------|
| Substituição | Produto na cena é substituído pelo cutout real |
| Escala | Ajustada para encaixar naturalmente nas mãos |
| Perspectiva | Rotação/ângulo coerente com a cena |
| Iluminação | Integrada com a cena (sombras, reflexos) |
| Oclusão | Dedos podem ficar levemente na frente (não cobrir rótulo) |

**Resultado:** Rótulo 100% fiel, mesmo com zoom.

### Passo 4 — QA Automático + OCR

| Critério | Peso | Descrição |
|----------|------|-----------|
| **Similarity** | 30% | Produto gerado parece igual ao original? |
| **Label (OCR)** | 40% | Texto do rótulo está CORRETO e LEGÍVEL? |
| **Quality** | 30% | Imagem tem qualidade profissional? |

**Verificação de OCR:**
1. Lê TODO o texto visível no rótulo
2. Verifica presença dos tokens esperados (marca, nome)
3. Avalia legibilidade (não borrado, não distorcido)

- Score mínimo para aprovação: **70%**
- Imagens com texto distorcido/ilegível: **reprovadas**

### Passo 5 — Fallback por Composição Pura

Se TODAS as variações falharem no QA:

1. Gera cena com pessoa + **mão vazia**
2. Compõe o produto real (cutout) na mão
3. Ajusta sombra, iluminação e oclusão

**Resultado:** Entrega garantida com 100% de fidelidade.

### Passo 6 — Seleção Automática

- Variações aprovadas ordenadas por score
- A melhor é marcada como `is_best: true`
- Arquivos nomeados com sufixo `_LL` (Label Lock aplicado)

---

## UI/UX (aba Imagens)

### Formulário

| Campo | Tipo | Default | Descrição |
|-------|------|---------|-----------|
| Produto | Select (obrigatório) | — | Selecionar do catálogo |
| Cenário | Select | bathroom | Preset de ambiente |
| Gênero | Select | any | Feminino/Masculino/Qualquer |
| Faixa Etária | Select | middle | Jovem/Meia Idade/Maduro |
| Pose | Select | holding | Segurando (rótulo frontal) / Usando / Mostrando |
| Qualidade | Select | high | Standard/Alta |
| **🔒 Rótulo 100% fiel** | Switch | **ON** | Label Lock ativado |
| QA Automático + OCR | Switch | ON | Avaliar fidelidade com OCR |
| Fallback Inteligente | Switch | ON | Composição se falhar |
| Variações | Slider | 4 | 1-4 variações |

### Histórico de Jobs

| Info | Descrição |
|------|-----------|
| Status | queued/running/succeeded/failed |
| QA Score | Porcentagem de qualidade (0-100%) |
| Label Score | Score específico do rótulo (OCR) |
| OCR Text | Texto lido no rótulo |
| Label Lock | ✅ Se composição foi aplicada |
| Melhor Variação | Índice da variação selecionada |
| Pipeline Version | v2.1.0 |

---

## Regras de Negócio

| Regra | Descrição |
|-------|-----------|
| **Produto obrigatório** | Não gera sem produto selecionado |
| **Imagem obrigatória** | Produto deve ter imagem cadastrada |
| **Kit na mão** | PROIBIDO — kits em superfície |
| **Label Lock** | ON por padrão (recomendado) |
| **QA Score < 70%** | Imagem reprovada automaticamente |
| **Texto distorcido** | Imagem reprovada (label_score baixo) |
| **Todas reprovadas** | Fallback por composição pura |

---

## Custos Estimados (v2.1)

| Operação | Custo Estimado |
|----------|----------------|
| Cutout (gemini-flash-image) | ~R$ 0,05 |
| Variação (gemini-pro-image) | ~R$ 0,10 |
| Label Lock Overlay | ~R$ 0,08/variação |
| QA + OCR (gemini-flash) | ~R$ 0,05/variação |
| Fallback (composição pura) | ~R$ 0,25 |

**Exemplo:** 4 variações + Label Lock + QA ≈ R$ 0,95

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
| "Texto do rótulo distorcido" | Ativar Label Lock (ON por padrão) |
| "QA Score baixo" | Aumentar variações para 4, Label Lock ON |
| "Todas reprovadas" | Fallback será acionado automaticamente |
| "Rate limit" | Aguardar alguns minutos e tentar novamente |
| "Créditos insuficientes" | Adicionar créditos no workspace |

---

## Checklist Anti-Regressão

- [ ] Produto selecionado do catálogo
- [ ] Imagem do produto disponível e pública
- [ ] **Label Lock ativado (recomendado)**
- [ ] QA automático + OCR habilitado
- [ ] Fallback habilitado
- [ ] Pelo menos 4 variações para maior sucesso
- [ ] Pose "Segurando (rótulo frontal)" para melhor resultado
