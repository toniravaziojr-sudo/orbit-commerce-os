# Memory: features/marketing/ads-autopilot-strategic-plan-rendering-v8-0-0
Updated: now

O 'StrategicPlanContent' (v8) e o Motor Estrategista (v1.27.0) implementam uma hierarquia completa de planejamento (Campanha > Conjunto > Anúncio) para garantir transparência técnica. 

1. **Schema Estruturado (OBRIGATÓRIO):** O campo 'planned_actions' utiliza objetos complexos contendo um array obrigatório de 'adsets', onde cada item especifica:
   - `adset_name` (string): Nome descritivo do conjunto
   - `audience_type` (enum): `broad` | `interest` | `lookalike` | `custom` | `retargeting` | `abo_test`
   - `audience_description` (string): Descrição detalhada do público
   - `budget_brl` (number): Orçamento diário em BRL deste conjunto (ABO)
   - `ads_count` (number): Quantidade de anúncios neste conjunto

2. **Regras Arquiteturais por Tipo (INVIOLÁVEIS):**
   - **Teste (ABO):** 1 AdSet por Anúncio — `audience_type: "abo_test"`, orçamento no AdSet, mínimo 2 AdSets
   - **Venda Direta (TOF):** Mínimo 2 AdSets com públicos distintos — Broad + LAL/Interesses/Custom
   - **Remarketing (BOF):** AdSets por temperatura — Visitantes 14d, ATC 7d, IC 7d — criativos ÚNICOS ≠ TOF

3. **Diagnóstico Profundo:** O campo 'diagnosis' exige obrigatoriamente um mínimo de 300 palavras para assegurar qualidade analítica.

4. **Terminologia Humana (PT-BR):** Substitui terminologias técnicas por termos amigáveis: 'Topo de Funil' (TOF), 'Fundo de Funil' (BOF/Remarketing), 'Meta de Desempenho' e 'Local da Conversão'.

5. **Interface Hierárquica (v8):** Os cards de ação na UI listam OBRIGATORIAMENTE todos os AdSets planejados com:
   - Badge de tipo de audiência (Broad, LAL, Interesses, Remarketing, ABO Teste)
   - Orçamento diário por conjunto (R$ X/dia)
   - Número de anúncios no conjunto
   - Descrição do público-alvo
   A hierarquia Campanha > Conjunto > Anúncio deve ser visível antes da aprovação.

6. **Alocação de Verba:** Mantém o gráfico visual de distribuição do orçamento diário por etapa do funil (Aquisição, Remarketing, Teste).

### Arquivos Relacionados
- `supabase/functions/ads-autopilot-strategist/index.ts` — Motor Estrategista com schema de adsets
- `src/components/ads/StrategicPlanContent.tsx` — UI de renderização hierárquica

### Checklist Anti-Regressão
- [ ] `planned_actions` sempre contém array `adsets` com todos os campos obrigatórios
- [ ] Campanhas TOF têm ≥ 2 AdSets com audiences distintas no JSON
- [ ] Campanhas Teste têm audience_type `abo_test` com 1 AdSet por Ad
- [ ] UI renderiza seção "Conjuntos de Anúncios" em cada card de ação
- [ ] Badges de audiência exibidos corretamente (Broad, LAL, Interesses, etc.)
