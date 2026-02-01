# Feature Rollout — Regras Obrigatórias

> **Status:** 🟩 Ativo  
> **Última atualização:** 2026-02-01

---

## Regra Principal (PADRÃO)

**TODA** nova funcionalidade, ajuste, correção ou mudança no sistema **DEVE**:

1. Ser implementada para **TODOS os tenants** (incluindo especiais e admin)
2. Não há necessidade de rollout gradual por padrão
3. Todas as lojas recebem a mesma funcionalidade simultaneamente

---

## Exceção: Rollout Específico

Quando o usuário **ESPECIFICAR EXPLICITAMENTE** que uma feature deve ser implementada apenas para um tenant específico:

```
Exemplo de comando do usuário:
"Implementar X apenas no tenant [nome/id]"
"Essa feature é só para a loja respeiteohomem"
"Testar isso apenas no admin"
```

Nesse caso, usar uma das abordagens abaixo:

### Opção 1: Verificação de Operador de Plataforma

```typescript
// Para features apenas para o admin testando
import { usePlatformOperator } from "@/hooks/usePlatformOperator";
import { useAdminMode } from "@/contexts/AdminModeContext";

const { isPlatformOperator } = usePlatformOperator();
const { isStoreMode } = useAdminMode();

// Exibe apenas para operador da plataforma em modo loja
if (isPlatformOperator && isStoreMode) {
  // Mostrar nova feature
}
```

### Opção 2: Feature Flag no Banco

```sql
-- Tabela tenant_features ou similar
INSERT INTO tenant_feature_overrides (tenant_id, feature_key, is_enabled)
VALUES ('tenant-id-especifico', 'new_feature', true);
```

### Opção 3: Lista de Tenants Permitidos

```typescript
const BETA_TENANTS = ['tenant-id-especifico'];

const isBetaTenant = BETA_TENANTS.includes(currentTenant?.id);
if (isBetaTenant) {
  // Mostrar nova feature
}
```

---

## Comandos do Usuário

| Comando | Ação |
|---------|------|
| "Implementar X" | Implementar para **TODOS** os tenants |
| "Ajustar X" | Ajustar para **TODOS** os tenants |
| "Implementar X apenas no tenant Y" | Restringir ao tenant especificado |
| "Testar X apenas no admin" | Restringir ao admin |
| "Disponibilizar para outros" | Remover restrição e liberar globalmente |

---

## Exceções Técnicas

Features que podem ter comportamento diferente por natureza:

- Funcionalidades de **Platform Admin** (Health Monitor, etc.) — sempre restritas via `PlatformAdminGate`
- Funcionalidades por **Plano** — controladas via `useTenantAccess` e `FEATURE_CONFIG`
- Funcionalidades **Especiais** — controladas via `is_special` na tabela tenants

---

## Motivo

Esta regra existe para:

1. **Simplificar o desenvolvimento** — menos condicionais, menos código
2. **Garantir paridade** — todos os clientes têm a mesma experiência
3. **Acelerar entregas** — sem necessidade de rollout gradual
4. **Manter flexibilidade** — rollout específico quando explicitamente solicitado
