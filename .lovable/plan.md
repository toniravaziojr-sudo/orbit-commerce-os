
# Plano: Configurações Independentes de Header/Footer no Checkout

## Resumo do Problema

O sistema atual tem dificuldades em manter as configurações do Header e Footer do checkout **independentes** do layout global. Quando o usuário edita essas configurações na página do Checkout dentro do Builder, as alterações não persistem corretamente ou conflitam com as configurações globais.

---

## Análise Técnica

### Arquitetura Atual

```text
┌─────────────────────────────────────────────────────────────────────────┐
│                          storefront_global_layout                        │
├─────────────────────────────────────────────────────────────────────────┤
│  header_config (global)     │  checkout_header_config (exclusivo)       │
│  footer_config (global)     │  checkout_footer_config (exclusivo)       │
└─────────────────────────────────────────────────────────────────────────┘
```

O banco de dados **já suporta** a separação. O problema está no **fluxo de edição e renderização**.

### Pontos de Falha Identificados

| Componente | Problema |
|------------|----------|
| `HeaderFooterPropsEditor.tsx` | Quando `isCheckoutPage=true`, delega para `PropsEditor` genérico em vez de mostrar UI customizada com seções |
| `PropsEditor.tsx` | Renderiza baseado no schema do registry, não inclui toggles específicos como `showFooter1`, `showSac` |
| `StorefrontCheckout.tsx` | Aplica defaults hardcoded antes das props salvas, potencialmente sobrescrevendo |
| `useGlobalLayoutIntegration.ts` | Defaults são aplicados corretamente, mas não há validação de props existentes |

---

## Solução Proposta

### 1. Criar UI Dedicada para Checkout no HeaderFooterPropsEditor

**Arquivo:** `src/components/builder/HeaderFooterPropsEditor.tsx`

Atualmente (linhas 702-737), quando `isCheckoutPage=true`:
```typescript
if (isCheckoutPage) {
  return (
    <PropsEditor  // ❌ Delega para editor genérico
      isCheckoutContext={true}
      ...
    />
  );
}
```

**Correção:** Criar seções colapsáveis customizadas para checkout, similares às da Home, mas com:
- Toggles específicos: `showSearch`, `showCart`, `showHeaderMenu`, `customerAreaEnabled`
- Cores independentes: `headerBgColor`, `headerTextColor`
- Para Footer: `showFooter1`, `showFooter2`, `showSac`, `showSocial`, `showCopyright`, `showLogo`

### 2. Garantir Independência Total nas Props

**Arquivo:** `src/pages/storefront/StorefrontCheckout.tsx`

O merge atual (linhas 41-123) aplica:
1. Props visuais globais como fallback
2. Defaults hardcoded
3. Props do checkout

**Correção:** Inverter a ordem para:
1. Props visuais globais como fallback (apenas se checkout não tem)
2. Props do checkout DIRETAMENTE (sem defaults intermediários)

### 3. Verificar Fluxo de Salvamento

**Arquivo:** `src/components/builder/VisualBuilder.tsx`

O salvamento (linhas 515-523) já está correto - usa `updateCheckoutHeader/updateCheckoutFooter`. Apenas garantir que o estado não está sendo sobrescrito pelo `useEffect` de sincronização.

---

## Detalhes de Implementação

### Passo 1: Criar UI do Checkout no HeaderFooterPropsEditor

Adicionar novo bloco de código para `isCheckoutPage` que renderiza:

**Para Header do Checkout:**
```text
┌─────────────────────────────────────────┐
│ 🛒 Header do Checkout                   │
│   Badge: "Checkout - Layout Exclusivo"  │
├─────────────────────────────────────────┤
│ ▼ Cores do Cabeçalho                    │
│   • Cor de Fundo                        │
│   • Cor do Texto                        │
│   • Cor dos Ícones                      │
├─────────────────────────────────────────┤
│ ▼ Elementos                             │
│   ○ Mostrar Busca          [toggle]     │
│   ○ Mostrar Carrinho       [toggle]     │
│   ○ Menu de Navegação      [toggle]     │
│   ○ Área do Cliente        [toggle]     │
│   ○ Fixar ao Rolar         [toggle]     │
└─────────────────────────────────────────┘
```

**Para Footer do Checkout:**
```text
┌─────────────────────────────────────────┐
│ 🛒 Footer do Checkout                   │
│   Badge: "Checkout - Layout Exclusivo"  │
├─────────────────────────────────────────┤
│ ▼ Cores do Rodapé                       │
│   • Cor de Fundo                        │
│   • Cor do Texto                        │
├─────────────────────────────────────────┤
│ ▼ Elementos Visíveis                    │
│   ○ Mostrar Logo           [toggle]     │
│   ○ Mostrar Copyright      [toggle]     │
│   ○ Mostrar SAC            [toggle]     │
│   ○ Mostrar Redes Sociais  [toggle]     │
│   ○ Mostrar Footer 1       [toggle]     │
│   ○ Mostrar Footer 2       [toggle]     │
│   ○ Mostrar Info da Loja   [toggle]     │
└─────────────────────────────────────────┘
```

### Passo 2: Simplificar Merge no StorefrontCheckout

```typescript
const checkoutHeaderConfig = useMemo((): BlockNode => {
  const checkoutProps = globalLayout?.checkout_header_config?.props || {};
  const globalProps = globalLayout?.header_config?.props || {};
  
  // REGRA: Props do checkout TÊM PRIORIDADE ABSOLUTA
  // Herança visual apenas para props NÃO definidas no checkout
  const visualPropsToInherit = ['headerBgColor', 'headerTextColor', 'logoUrl'];
  
  const mergedProps: Record<string, unknown> = {};
  
  // Herdar props visuais APENAS se não existem no checkout
  for (const key of visualPropsToInherit) {
    if (checkoutProps[key] === undefined && globalProps[key]) {
      mergedProps[key] = globalProps[key];
    }
  }
  
  // Aplicar TODAS as props do checkout (prioridade máxima)
  Object.assign(mergedProps, checkoutProps);
  
  return { id: 'checkout-header', type: 'Header', props: mergedProps };
}, [globalLayout]);
```

### Passo 3: Garantir Persistência no VisualBuilder

Verificar que o `useEffect` de sincronização (linhas 360-412) NÃO sobrescreve as props do checkout quando o usuário está editando:

```typescript
// Quando isDirty E isCheckoutPage, usar checkout configs SEM merge
if (isCheckoutPage) {
  headerConfig = globalLayout.checkout_header_config;  // DIRETO
  footerConfig = globalLayout.checkout_footer_config;  // DIRETO
}
```

---

## Arquivos a Modificar

| Arquivo | Alteração |
|---------|-----------|
| `src/components/builder/HeaderFooterPropsEditor.tsx` | Criar UI dedicada para checkout (seções colapsáveis com toggles) |
| `src/pages/storefront/StorefrontCheckout.tsx` | Simplificar merge para prioridade absoluta das props do checkout |
| `src/components/builder/VisualBuilder.tsx` | Garantir que sincronização não sobrescreve edições do checkout |

---

## Comportamento Esperado Após Implementação

1. **No Builder (página Checkout):**
   - Clicar no Header → Painel lateral mostra "Header do Checkout" com badge amarelo
   - Toggles de `showSearch`, `showCart`, etc. funcionam e persistem
   - Cores podem ser alteradas independentemente do global

2. **Na Loja Pública (página de checkout):**
   - Header/Footer renderizam com as configurações exclusivas do checkout
   - Se uma cor não foi definida no checkout, herda do global
   - Toggles funcionais (mostrar/ocultar) refletem exatamente o configurado

3. **Nas Outras Páginas:**
   - Header/Footer continuam usando `header_config`/`footer_config` global
   - Sem impacto nas alterações feitas no checkout

---

## Riscos e Mitigações

| Risco | Mitigação |
|-------|-----------|
| Perda de dados salvos anteriormente | Manter compatibilidade com props existentes |
| Conflito de herança de cores | Testar cenários onde checkout tem cor definida vs. herança |
| Regressão em outras páginas | Testes end-to-end em home, categoria, produto |

---

## Documentação a Atualizar

Após implementação, atualizar `docs/regras/checkout.md` com:
- Lista completa de props editáveis no checkout
- Regras de herança visual
- Exemplo de configuração

