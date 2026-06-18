---
name: Ads H.4.8 — Copy completa, layout do passo Anúncios e anti-repetição
description: Limites generosos de copy (60/500/90), smartTrim sem mutilar palavra, prompt com VERSÕES ANTERIORES para forçar variação, painel de IA acima da copy canônica, rodapé do modal com altura uniforme e barra de ações de criativo no topo do bloco.
type: constraint
---

# Regra (Onda H.4.8 — 2026-06-18)

Substitui parcialmente H.4.5 / H.4.6 / H.4.7 nos pontos abaixo.

## Limites de copy (Meta Ads)
- `headline`: até **60** caracteres
- `primary_text`: até **500** caracteres (recomendado <125, mas Meta aceita até 2200)
- `description`: até **90** caracteres

O backend NUNCA corta no meio de palavra. `smartTrim` corta no último `.`/`!`/`?` se houver, senão no último espaço, e como último recurso adiciona reticências. O prompt exige frases COMPLETAS (regra dura nº 9): se não couber, a IA reescreve mais curto — nunca trunca.

## Anti-repetição obrigatória
- Em `generate_copy`, se já existem `headline`/`primary_text`/`description`, o prompt recebe um bloco "VERSÕES ANTERIORES" e exige abertura/framework/ângulo radicalmente diferentes.
- Em `regen_copy_field`, o prompt recebe a versão atual do campo como "NÃO repita estrutura, abertura nem ritmo".
- Regra dura nº 10 reforça: cada regeneração precisa variar abertura, ritmo, framework (AIDA/PAS/4Us/BAB) e ângulo.

## Layout do passo Anúncios (StructuredProposalModal)
- `AdCreativeAIPanel` renderiza ACIMA do bloco "Criativo do anúncio". O botão "Gerar tudo novamente" e os feedbacks por campo ficam antes das copies canônicas (que ficam logo abaixo para conferência).
- `AttachCreativeBlock` agrupa todos os botões de ação (Gerar com IA / Enviar do PC / Escolher no Drive / Remover) em uma barra no TOPO do bloco "Anexar criativo" / "Criativo anexado". Preview da imagem fica abaixo.
- Rodapé do modal (Cancelar campanha / Ajustar proposta / Aprovar): todos os botões com altura `h-9` para alinhamento vertical consistente; texto auxiliar "A aprovação acontece ao publicar na última etapa" só aparece em telas md+ e tem `max-w` para não empurrar os botões.

## Proibições
- Não voltar a usar `slice(0, N)` cego em copy gerada por IA — usar `smartTrim`.
- Não voltar a usar limites curtos (40/180/30) que mutilavam o texto principal.
- Não renderizar o painel de IA abaixo da seção "Criativo do anúncio".
- Não espalhar botões de gerar/subir criativo ao lado da preview da imagem.
- Não regenerar copy sem passar a versão atual/prévias no prompt (anti-repetição).

## Implementação
- Edge: `supabase/functions/ads-creative-inline-generate/index.ts` — `COPY_LIMITS`, `smartTrim`, prompts com bloco "VERSÕES ANTERIORES".
- UI: `src/components/ads/StructuredProposalModal.tsx` — ordem dos blocos no `AdSection`, layout do footer e do `AttachCreativeBlock`.
- UI: `src/components/ads/AdCreativeAIPanel.tsx` — inalterado (a posição é decidida pelo pai).

## Anti-regressão
- H.4.5 (briefing enriquecido + feedback visível), H.4.6 (sem `?` no título) e H.4.7 (3 versões internas + persona) continuam valendo.
- Mudança é de tamanho, alinhamento e contexto anti-repetição — não muda contrato de resposta, não muda governança da etapa 4, não muda quem aprova/publica.
