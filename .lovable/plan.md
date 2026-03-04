

# Correção Cirúrgica: Header/Footer + DB Defaults

## Diagnóstico Confirmado

### Problema #1: DB defaults estão `true` para `show_header` e `show_footer`
A tabela `ai_landing_pages` tem `column_default: true` para ambas as colunas. O `CreateLandingPageDialog.tsx` (linha 186) não define esses campos no insert — então toda LP nova nasce com header/footer ligados. O editor (linha 140) também faz fallback `?? true`.

### Problema #2: Imagem quebrada do imgur
O t11 ainda mostra uma imagem do imgur quebrada ("The image you are requesting does not exist"). Isso confirma que a IA ainda está gerando URLs externas apesar da proibição no prompt. O hard check `has_no_external_images` foi adicionado ao `engine-plan.ts` mas apenas gera warning — não faz strip automático das URLs proibidas.

### Problema #3: Imagens de oferta usando catálogo errado
Nos cards de oferta/kit (Tratamento 4/6/12 meses), a IA está usando imagens aleatórias (before/after, catálogo genérico) em vez da imagem principal do produto. O prompt diz para usar catálogo "apenas em grids de produto", mas não especifica que cards de oferta/pricing DEVEM usar a imagem principal (`is_primary`) de cada produto.

---

## Correções Planejadas

### Correção 1: Alterar DB defaults para `false`
**Tipo:** Migration SQL

Alterar os defaults das colunas `show_header` e `show_footer` de `true` para `false`. Isso garante que novas LPs nasçam sem header/footer por padrão.

### Correção 2: Atualizar t11 no banco
**Tipo:** SQL direto

Setar `show_header: false` e `show_footer: false` no registro t11 para validação imediata.

### Correção 3: Editor fallback `?? false`
**Arquivo:** `src/pages/LandingPageEditor.tsx` (linha 140-141)

Trocar:
```typescript
setShowHeader(landingPage.show_header ?? true);
setShowFooter(landingPage.show_footer ?? true);
```
Para:
```typescript
setShowHeader(landingPage.show_header ?? false);
setShowFooter(landingPage.show_footer ?? false);
```

### Correção 4: Regra de imagem por slot no prompt
**Arquivo:** `supabase/functions/ai-landing-page-generate/index.ts`

Adicionar ao prompt (seção de IMAGENS ou ANTI-PADRÕES) uma regra de slot:

```
### POLÍTICA DE IMAGEM POR TIPO DE SEÇÃO:
- HERO: Use criativo gerado (prioridade) ou lifestyle. NUNCA catálogo com fundo branco.
- OFERTA / PRICING / KITS: Use OBRIGATORIAMENTE a imagem principal (is_primary) de cada produto do catálogo.
- PROVA SOCIAL / BEFORE-AFTER: Apenas imagens aprovadas de transformação.
- BENEFÍCIOS / FEATURES: Ícones CSS ou imagens secundárias.
- NUNCA misture: before/after em card de oferta, catálogo em hero, lifestyle em pricing.
```

### Correção 5: Sanitizer strip de URLs externas proibidas
**Arquivo:** `src/lib/sanitizeAILandingPageHtml.ts`

Adicionar regex que remove `<img>` tags com src apontando para hosts proibidos (imgur.com, postimg.cc, imgbb.com, cloudinary.com), substituindo por string vazia ou placeholder transparente. Isso é defesa de runtime, além do warning do hard check.

### Correção 6: Deploy edge function

---

## Arquivos Afetados

| Arquivo | Mudança |
|---------|---------|
| Migration SQL | Alterar defaults de `show_header`/`show_footer` para `false` |
| `src/pages/LandingPageEditor.tsx` | Fallback `?? false` |
| `supabase/functions/ai-landing-page-generate/index.ts` | Regra de imagem por slot |
| `src/lib/sanitizeAILandingPageHtml.ts` | Strip de URLs externas proibidas |

## O que NÃO muda
- Arquitetura V4.2 (body-only, pipeline compartilhada, hard checks)
- Componente `StorefrontAILandingPage.tsx` (já está correto, respeita os flags)
- Lógica de `buildDocumentShell` / `aiLandingPageShell.ts`

