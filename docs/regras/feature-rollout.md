# Feature Rollout — Regras Obrigatórias

> **Status:** 🟩 Ativo  
> **Última atualização:** 2026-01-28

---

## Regra Principal (NÃO NEGOCIÁVEL)

**TODA** nova funcionalidade, ajuste, correção ou mudança no sistema referente aos módulos de usuário/cliente **DEVE**:

1. Ser implementada e testada **EXCLUSIVAMENTE** na conta do admin (`toniravaziojr@gmail.com`) primeiro
2. Permanecer restrita ao admin até aprovação explícita do usuário
3. Só então ser disponibilizada para outros usuários

---

## Fluxo Obrigatório

```
1. Usuário solicita feature/ajuste
   ↓
2. Lovable implementa APENAS no tenant admin
   ↓
3. Usuário testa e valida
   ↓
4. Se OK: Usuário pede "disponibilizar para outros usuários"
   ↓
5. Lovable remove restrição e libera globalmente
```

---

## Implementação Técnica

### Opção 1: Verificação de Operador de Plataforma

```typescript
// Para features que devem aparecer APENAS para o admin testando
import { useIsSpecialTenant } from "@/hooks/useIsSpecialTenant";
import { useAdminMode } from "@/contexts/AdminModeContext";

const { isPlatformOperator } = useIsSpecialTenant();
const { isStoreMode } = useAdminMode();

// Exibe apenas para operador da plataforma em modo loja
if (isPlatformOperator && isStoreMode) {
  // Mostrar nova feature
}
```

### Opção 2: Feature Flag no Banco

```sql
-- Tabela tenant_features ou similar
INSERT INTO tenant_features (tenant_id, feature_key, is_enabled)
VALUES ('admin-tenant-id', 'new_feature', true);
```

### Opção 3: Lista de Tenants Permitidos

```typescript
const BETA_TENANTS = ['admin-tenant-id'];

const isBetaTenant = BETA_TENANTS.includes(currentTenant?.id);
if (isBetaTenant) {
  // Mostrar nova feature
}
```

---

## Identificação do Admin

| Campo | Valor |
|-------|-------|
| Email | `toniravaziojr@gmail.com` |
| Verificação | `isPlatformOperator === true` |
| Modo | `isStoreMode === true` (Minha Loja) |

---

## Proibições

| ❌ Proibido | ✅ Correto |
|-------------|------------|
| Implementar feature diretamente para todos | Implementar apenas para admin primeiro |
| Assumir que feature está OK sem teste | Esperar validação explícita do usuário |
| Liberar para todos sem comando explícito | Aguardar "disponibilizar para outros" |
| Modificar lógica que afeta outros tenants | Isolar mudanças no tenant admin |

---

## Comandos do Usuário

| Comando | Ação |
|---------|------|
| "Implementar X" | Implementar apenas no admin |
| "Testar X" | Executar testes no admin |
| "Disponibilizar para outros" | Remover restrição e liberar globalmente |
| "Ajustar X" | Ajustar apenas no admin até nova validação |

---

## Exceções

Features que **NÃO** precisam seguir este fluxo:

- Correções de bugs críticos que afetam todos
- Atualizações de segurança
- Mudanças em infraestrutura/backend que não afetam UI
- Documentação

---

## Motivo

Esta regra existe para:

1. **Evitar bugs** em produção para clientes reais
2. **Permitir testes** antes de rollout global
3. **Garantir qualidade** das implementações
4. **Dar controle** ao usuário sobre o que é liberado
