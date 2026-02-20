# Memory: features/marketing/ai-ads-autopilot-remarketing-strategy-rules
Updated: now

## Regras Estratégicas de Remarketing e Composição (v1.26.0)

### Regra de Separação Criativa (INVIOLÁVEL)
Criativos de remarketing (BOF) devem ser **obrigatoriamente diferentes** dos criativos de aquisição (TOF).

**Lógica:** O cliente no remarketing já viu os criativos de venda direta e não converteu. Exibir os mesmos criativos e copys é estrategicamente ineficaz.

### Ângulos Recomendados para BOF
- Prova social / depoimentos
- Urgência / escassez ("últimas unidades", "oferta por tempo limitado")
- Comparativo / antes e depois
- Kits / bundles como upsell/cross-sell
- Objeção reversa ("por que ainda não experimentou?")

### Regras de Composição por Tipo

| Tipo | Estrutura de AdSets | Criativos | Orçamento |
|------|---------------------|-----------|-----------|
| **Teste** | 1 AdSet por Ad (ABO) | Variações independentes | No AdSet |
| **Venda Direta (TOF)** | Múltiplos AdSets (públicos diferentes) | Mesmos ads replicados | CBO ou ABO |
| **Remarketing (BOF)** | Públicos quentes segmentados | Criativos ÚNICOS (≠ TOF) | CBO |

### Regras de Catálogo
- Se houver catálogo conectado, remarketing **prioriza DPA** (Dynamic Product Ads).
- Sem catálogo: gerar múltiplas variações (kits ou ângulos diferentes).
- **Proibido:** campanhas de remarketing com apenas 1 anúncio (single-ad).

### Regras de Teste
- Orçamento distribuído entre ≥2 variações criativas.
- Estrutura ABO obrigatória para isolar performance por criativo.
- Cada anúncio em seu próprio AdSet para garantir distribuição justa.

### Checklist Anti-Regressão
- [ ] BOF nunca usa mesmos criativos/copys que TOF
- [ ] Testes usam ABO com 1 AdSet por Ad
- [ ] Venda direta tem ≥2 públicos em AdSets separados
- [ ] Remarketing sem catálogo tem ≥2 variações
