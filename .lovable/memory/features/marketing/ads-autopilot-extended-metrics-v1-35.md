# Memory: features/marketing/ads-autopilot-extended-metrics-v1-35
Updated: now

O Motor Estrategista (v1.35.0+) coleta e injeta métricas estendidas em TODOS os tipos de análise (start, weekly, monthly):

### Métricas Expandidas (aplicadas a todos os triggers)
1. **Frequência**: Média de impressões por pessoa. >3 = fadiga, >5 = crítico (pausar/renovar criativo).
2. **CPM**: Custo por mil impressões (R$). Indica competitividade do leilão e qualidade do anúncio.
3. **CTR**: Taxa de clique. <1% = criativo fraco, >2% = excelente.
4. **Visualizações de Página (PV)**: Tráfego qualificado para a página do produto.
5. **Adição ao Carrinho (ATC)**: Intenção de compra. PV alto + ATC baixo = página ruim.
6. **Checkout Iniciado (IC)**: ATC alto + IC baixo = problema no checkout.
7. **Video Views 25/50/95%**: Retenção de vídeo. VV25 alto + VV95 baixo = gancho bom, conteúdo fraco.

### Escopo por Trigger (v1.36.0 — REGRA INVIOLÁVEL)
| Funcionalidade | Start (1ª ativação) | Monthly (Mensal) | Weekly (Semanal) |
|---------------|---------------------|------------------|------------------|
| Métricas expandidas | ✅ Todas | ✅ Todas | ✅ Todas |
| Deep Historical (lifetime) | ✅ Obrigatório | ❌ Não consulta | ❌ Não consulta |
| Estratégia de Replicação Inteligente | ✅ Obrigatória (4 níveis) | ❌ Não aplicável | ❌ Não aplicável |
| Liberdade para testar novos públicos | ❌ Prioriza histórico | ✅ Total | ✅ Total |
| Janela de dados | Lifetime | Últimos 30 dias | Últimos 7 dias |

### Estratégia de Replicação Inteligente (SOMENTE no trigger `start`)
Hierarquia obrigatória de 4 níveis:
1. **Duplicação Exata**: Reviver assets pausados com ROAS ≥ meta (mesma config, ajustar budget/datas)
2. **Replicação com Variação**: Usar criativos/copys com CTR >2% como referência para novas variações
3. **Expansão de Público**: Testar anúncios vencedores em públicos similares/novos
4. **Teste Genuíno**: Criar do zero APENAS se não houver histórico suficiente

### Arquivos Relacionados
- `supabase/functions/ads-autopilot-strategist/index.ts` — Prompt condicional por trigger
