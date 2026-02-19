
# Plano Completo: Reorganizacao do Fluxo de Aprovacao + Nomes Unicos de Criativos

## 1. Nomes unicos para criativos no Drive

**Problema:** Todos os criativos sao salvos como `gemini_1.png`, `openai_2.png`, etc., causando repeticao e confusao tanto visual quanto para a IA buscar criativos.

**Arquivo:** `supabase/functions/creative-image-generate/index.ts` (linha 869-870)

**Mudanca:** Gerar nomes descritivos e unicos usando o padrao:
```text
{NomeProduto}_{estilo}_{provedor}_{timestamp_curto}_{BEST?}.png
```

Exemplo: `Shampoo_Anticaspa_natural_gemini_0219_1430_BEST.png`

- `filename` (exibido no Drive): `{product_name}_{style}_{provider}_{DDMM_HHmm}{_BEST}.png`
- `original_name` (metadata): mesmo valor para consistencia
- Timestamp curto (`DDMM_HHmm`) garante unicidade sem poluir o nome
- O `product_name` vem do parametro ja existente na funcao
- O `style` (product_natural, person_interacting, promotional) vem do `job.settings.style`

Alem disso, a ordenacao no Drive ja usa `created_at DESC`, entao os mais recentes aparecerao primeiro naturalmente. Validar que a query no `useDriveFiles` mantem `order('original_name', { ascending: true })` — isso pode precisar mudar para `order('created_at', { ascending: false })` para garantir que os mais recentes fiquem no topo.

**Arquivo adicional:** `src/hooks/useDriveFiles.ts` (linha 85-87) — Alterar ordenacao de arquivos de `original_name ASC` para `created_at DESC` para que os mais recentes aparecam primeiro.

---

## 2. "Acoes da IA" — Log historico puro

**Arquivo:** `src/components/ads/AdsActionsTab.tsx`

**Mudancas:**
- Remover as mutations `approveAction` e `rejectAction` (linhas 104-136)
- Remover botoes "Aprovar" e "Rejeitar" para acoes `pending_approval` (linhas 284-306)
- Substituir por Badge "Aguardando Aprovacao" com texto "Veja na aba Aguardando Acao"
- Manter: `rollbackAction`, botao "Desfazer" (para executadas), botao "Detalhes"

---

## 3. "Aguardando Acao" — Centro de aprovacao com preview completo

**Arquivo:** `src/components/ads/AdsPendingApprovalTab.tsx`

**Mudancas:**
- Substituir os cards inline atuais (linhas 158-294) pelo componente `ActionApprovalCard`
- Importar `ActionApprovalCard` e `BudgetSummaryHeader` (extrair de `AdsPendingActionsTab` ou recriar inline)
- Adicionar barra de orcamento global no topo (usando `budget_snapshot` da primeira acao)
- Manter a mesma logica de `approveAction` (chama edge function `execute-approved`), `rejectAction` e `adjustAction`
- Adaptar os callbacks do `ActionApprovalCard` (`onApprove`, `onReject`, `onAdjust`) para as mutations existentes

---

## 4. Central de Execucoes — Alerta de aprovacao pendente

**Arquivo:** `src/components/dashboard/AdsAlertsWidget.tsx`

**Mudancas:**
- Importar `useAdsPendingActions` (hook existente)
- Adicionar item de alerta quando `pendingCount > 0`:
  - Icone: `Hourglass`
  - Titulo: "X acoes aguardando sua aprovacao"
  - Descricao: "Propostas da IA precisam da sua decisao"
  - Variante: `warning`
- Ao clicar, navegar para `/ads` (aba pending-approval)

---

## 5. ActionDetailDialog — Preview enriquecido com dados do `action_data.preview`

**Arquivo:** `src/components/ads/ActionDetailDialog.tsx`

**Mudancas no `CampaignPreview`:**
- Quando `data.adsets` e `data.ads` estiverem vazios, fazer fallback para `data.preview`:
  - Mostrar `preview.headline` como titulo do anuncio
  - Mostrar `preview.copy_text` como texto do anuncio
  - Mostrar `preview.creative_url` como imagem
  - Mostrar `preview.targeting_summary` como publico
  - Mostrar `preview.funnel_stage` como funil
  - Mostrar `preview.budget_snapshot` como barra de orcamento
  - Mostrar `preview.product_name` e `preview.product_price_display`

---

## Sequencia de Implementacao

1. `creative-image-generate/index.ts` — Nomes unicos + deploy
2. `useDriveFiles.ts` — Ordenacao por `created_at DESC`
3. `AdsActionsTab.tsx` — Remover botoes de aprovacao
4. `AdsPendingApprovalTab.tsx` — Usar `ActionApprovalCard` + barra de orcamento
5. `AdsAlertsWidget.tsx` — Alerta de pendencias
6. `ActionDetailDialog.tsx` — Fallback para preview
