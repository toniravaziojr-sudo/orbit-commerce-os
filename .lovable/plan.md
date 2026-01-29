

# Plano de Correção Definitiva: Tela Cinza Durante OAuth

## Problema Identificado

### Causa Raiz
A tela cinza ocorre porque o **ProtectedRoute.tsx** possui **3 pontos de bloqueio** (loaders de tela cheia) que podem ser ativados durante operações de refetch ou quando o Google Tradutor modifica o DOM:

1. **Linha 53-59**: Loader durante `isLoading || platformLoading || inviteLoading`
2. **Linha 77-83**: Loader quando `!hasWaitedForData && userRoles.length === 0`  
3. **Linha 101-107**: Loader quando `!currentTenant && tenants.length > 0`

### Por que o Google Tradutor piora o problema
- O Google Tradutor **modifica o DOM agressivamente**
- Isso pode causar **remontagem de componentes React**
- Estados como `initialLoadComplete` e `hasWaitedForData` podem ser **resetados**
- A comunicação `window.opener` e `postMessage` são **bloqueadas ou corrompidas**

### Fluxo atual problemático

```text
1. Usuário está em /integrations
2. Clica em "Conectar Meta"
3. Popup abre para OAuth do Facebook
4. Enquanto popup está aberto, TanStack Query pode fazer refetch de background
5. isLoading, platformLoading ou inviteLoading ficam true momentaneamente
6. Google Tradutor pode causar remontagem do React
7. initialLoadComplete é resetado para false
8. Loader de tela cheia aparece (TELA CINZA)
9. Popup termina OAuth, tenta fechar
10. Janela pai está "travada" com loader
```

---

## Solução Proposta

### Estratégia: "Latch Pattern" Persistente

Implementar um padrão de "trava" (`latch`) que **NUNCA** seja resetado após a primeira carga. Utilizaremos **refs estáticas** e **sessionStorage** para garantir persistência mesmo com remontagens do React.

### Mudanças Específicas

#### 1. **ProtectedRoute.tsx** - Correção Principal

Aplicar o mesmo padrão `initialLoadComplete` em **TODOS os 3 loaders**, e persistir o estado em `sessionStorage` para sobreviver a remontagens:

```typescript
// Usar ref + sessionStorage para persistência absoluta
const initialLoadCompleteRef = useRef(
  sessionStorage.getItem('auth_initial_load_complete') === 'true'
);
const [initialLoadComplete, setInitialLoadComplete] = useState(
  initialLoadCompleteRef.current
);

// Marcar carga inicial como completa (irreversível nesta sessão)
useEffect(() => {
  if (!isLoading && !platformLoading && !inviteLoading && !initialLoadCompleteRef.current) {
    initialLoadCompleteRef.current = true;
    sessionStorage.setItem('auth_initial_load_complete', 'true');
    setInitialLoadComplete(true);
  }
}, [isLoading, platformLoading, inviteLoading]);
```

E proteger **TODOS** os loaders:

```typescript
// Loader 1: Loading inicial (JÁ PROTEGIDO, mas reforçar)
if ((isLoading || platformLoading || inviteLoading) && !initialLoadComplete) {
  return <Loader />;
}

// Loader 2: Aguardando roles (ADICIONAR proteção)
if (!hasWaitedForData && userRoles.length === 0 && !hasPendingInvite && !initialLoadComplete) {
  return <Loader />;
}

// Loader 3: Aguardando tenant (ADICIONAR proteção)
if (requireTenant && !currentTenant && tenants.length > 0 && !initialLoadComplete) {
  return <Loader />;
}
```

#### 2. **MetaOAuthCallback.tsx** - Reforçar Resiliência

Adicionar flag em `sessionStorage` para indicar que OAuth está em progresso, permitindo que a janela pai saiba que deve ignorar loaders:

```typescript
// Antes de redirecionar, limpar a flag
sessionStorage.removeItem('oauth_in_progress');

// E no redirect, usar tanto navigation quanto href:
const redirectUrl = success
  ? `${baseUrl}/integrations?meta_connected=true&t=${Date.now()}`
  : `${baseUrl}/integrations?meta_error=${encodeURIComponent(error || 'Erro')}&t=${Date.now()}`;
```

#### 3. **useMetaConnection.ts** - Marcar OAuth em Progresso

Antes de abrir o popup, marcar que OAuth está ativo:

```typescript
onSuccess: (data) => {
  // Marcar que OAuth está em progresso (protege contra loaders)
  sessionStorage.setItem('oauth_in_progress', 'true');
  
  // Abrir popup...
}
```

---

## Resumo de Arquivos a Modificar

| Arquivo | Mudança |
|---------|---------|
| `src/components/auth/ProtectedRoute.tsx` | Persistir `initialLoadComplete` em sessionStorage; Proteger TODOS os loaders com a mesma condição |
| `src/hooks/useMetaConnection.ts` | Adicionar flag `oauth_in_progress` no sessionStorage antes de abrir popup |
| `src/pages/MetaOAuthCallback.tsx` | Limpar flag `oauth_in_progress` antes de redirecionar |

---

## Resultado Esperado

1. **Primeira carga** da aplicação mostra loader (normal)
2. **Após carga inicial**, loaders de tela cheia **NUNCA** mais aparecem
3. Durante OAuth, a tela de integrações permanece **100% visível**
4. Se Google Tradutor causar remontagem, o `sessionStorage` preserva o estado
5. Callback OAuth funciona independentemente de `window.opener`

---

## Detalhes Técnicos

### Por que sessionStorage ao invés de apenas ref?

- **Refs** são resetadas quando o componente é completamente desmontado e remontado
- **sessionStorage** persiste durante toda a sessão do navegador
- O Google Tradutor pode causar remontagem completa da árvore React
- Com sessionStorage, mesmo uma remontagem total preserva o estado

### Por que não localStorage?

- **sessionStorage** é limpo quando o navegador fecha (comportamento desejado)
- Queremos que uma nova sessão comece "fresh"
- Evita estados "travados" de sessões antigas

