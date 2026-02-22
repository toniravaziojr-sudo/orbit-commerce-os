# Memory: features/marketing/ads-autopilot-implement-campaigns-fix-v1-43
Updated: now

## Fix: IA parava na Fase 2 pedindo aprovação (v1.43.0)

### Problema
Na sessão `implement_campaigns` (Fase 2), a IA gerava um "preview" da campanha e dizia "Aguardando sua aprovação para criar a campanha" em vez de executar diretamente as tools `create_campaign`. Resultado: apenas 1 ação `adjust_budget` era executada, nenhuma campanha nova era criada.

### Causa Raiz
1. **Prompt insuficiente**: O prompt do `implement_campaigns` não enfatizava que a execução era AUTOMÁTICA sem necessidade de aprovação
2. **tool_choice**: O `forceToolChoice = "required"` só era aplicado no round 1, permitindo que nos rounds seguintes a IA respondesse apenas com texto

### Correção (v1.43.0)
1. **Prompt reforçado**: Adicionado bloco `⚠️ EXECUÇÃO OBRIGATÓRIA — SEM PAUSAS, SEM APROVAÇÃO` com instruções explícitas: "NÃO peça aprovação. NÃO exiba previews. EXECUTE TODAS as campanhas IMEDIATAMENTE"
2. **tool_choice forçado em TODOS os rounds**: Para `implement_campaigns`, `tool_choice = "required"` é aplicado em todas as rodadas (não apenas round 1), forçando a IA a sempre chamar tools

### Checklist Anti-Regressão
- [ ] Prompt de `implement_campaigns` contém instrução explícita de execução automática
- [ ] `tool_choice = "required"` é forçado em TODOS os rounds para `implement_campaigns`
- [ ] IA não deve responder apenas com texto em sessões de implementação
