# Memory: features/marketing/ai-ads-autopilot-campaign-content-standards-v1-15-0
Updated: now

## Padrões de Conteúdo e Estrutura de Campanhas (v1.26.0)

### Regras Estruturais por Tipo de Campanha

#### 1. Campanhas de Teste (ABO Obrigatório)
- **Estrutura:** 1 AdSet por Anúncio (ABO — Ad Budget Optimization).
- **Motivo:** Forçar distribuição igual de orçamento entre variações, impedindo que a Meta concentre verba em um único anúncio prematuramente.
- **Mínimo:** 2 a 4 variações criativas, cada uma em seu próprio AdSet.
- **Orçamento:** Definido no nível do AdSet (não da campanha).

#### 2. Campanhas de Venda Direta / TOF (Múltiplos Públicos)
- **Estrutura:** Múltiplos AdSets com públicos diferentes, mesmos anúncios.
- **Públicos obrigatórios:** Mínimo 2-3 segmentações distintas (Broad, Interesses, Lookalike, Custom Audiences).
- **Motivo:** Identificar os melhores públicos para escalar. Todos podem converter, e a diversificação de audiências é essencial para escala.
- **Anúncios:** Podem ser replicados entre AdSets (mesmos criativos em públicos diferentes).

#### 3. Campanhas de Remarketing / BOF
- **Criativos:** OBRIGATORIAMENTE diferentes dos de TOF (ver funnel-matching).
- **Públicos:** Visitantes do site, engajamento, ATC/IC/Checkout, Custom Audiences quentes.
- **Catálogo:** Se houver catálogo conectado, priorizar DPA (Dynamic Product Ads).

### Regra de Multiplicidade
Toda proposta de campanha deve incluir de 2 a 4 variações de criativos visuais, textos principais (primary_texts) e títulos (headlines) para garantir validade de testes A/B.

### Checklist Anti-Regressão
- [ ] Campanhas de teste usam ABO (1 AdSet = 1 Ad)
- [ ] Campanhas de venda direta têm ≥2 AdSets com públicos distintos
- [ ] Campanhas de remarketing nunca reutilizam criativos de TOF
