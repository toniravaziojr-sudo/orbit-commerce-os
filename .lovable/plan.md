# Plano Mercado Livre — Execução Final

📌 STATUS DA ENTREGA: Ajuste aplicado — pendente de validação pelo lojista (teste no preview).

## Implementado nesta entrega

### Onda 2 — Cadastro como Fonte Única (núcleo do plano)

1. **`src/lib/marketplaces/mlReadiness.ts`** (novo) — função `checkMlReadiness()` é a fonte única dos campos obrigatórios para ML. Consumida por ProductForm, ProductList e MeliListingWizard. Inclui constante `GENERIC_MODEL_VALUE = "Genérico"`.

2. **`ProductForm.tsx`** — banner amarelo no topo lista campos faltantes em tempo real; `handleSubmit` bloqueia salvar com toast destrutivo enumerando o que falta; campo **Modelo** ganha botão **"Genérico"** que preenche o literal num clique e label vira **"Modelo *"** com descrição obrigatória.

3. **`ProductList.tsx`** — contador clicável **"N Incompletos para Mercado Livre"** no topo da lista. Clique ativa filtro mostrando apenas os pendentes (sem afetar busca por nome/SKU).

4. **`MeliListingWizard.tsx`** — `handleSubmit` faz checagem silenciosa final consultando o produto no banco antes de publicar. Mesmo com painel verde, se o lojista esvaziou algum campo depois, bloqueia com toast + ação **"Abrir cadastro"** que abre `/products?edit=<id>` em nova aba.

### Onda 1 (entregue na rodada anterior, mantida)

- `meli-resolve-attributes` v1.5.0: `toSafeString()` universal, `FAMOUS_BRAND_BLACKLIST`, try/catch isolado por atributo, prompt anti-repetição, BRAND nunca inventado.
- `MeliAttributesPanel`: fila global de 3 simultâneas, retry isolado por produto, cache obrigatório de `meli_listings.attributes`.

### Documentação e governança

- `docs/especificacoes/marketplaces/mercado-livre.md` — nova seção **v3.8 "Cadastro como Fonte Única do Mercado Livre"**.
- `.lovable/memory/constraints/ml-cadastro-fonte-unica.md` (nova memória anti-regressão).
- Índice de memórias atualizado.

## Validação técnica executada

🔍 **VALIDAÇÃO TÉCNICA EXECUTADA:**
- Typecheck completo do projeto: ✅ passou sem erros.
- Função `checkMlReadiness` pura e testável (sem dependências externas).
- Pontos de consumo plugados em ProductForm/List/Wizard sem alterar contratos públicos existentes.

## Pendente de validação pelo lojista

Cenários a testar no preview:
1. **Cadastrar produto novo sem marca/GTIN/dimensões/categoria universal/conteúdo líquido** → banner aparece e botão Salvar é bloqueado com toast listando o que falta.
2. **Abrir produto antigo incompleto** → banner amarelo no topo com a lista; salvar travado até preencher.
3. **Modelo: clicar "Genérico"** → campo preenche `"Genérico"` e desaparece da lista de pendências.
4. **Tela de Produtos** → contador "Incompletos para Mercado Livre" visível; clicar filtra apenas pendentes.
5. **Wizard de anúncios em lote** com vários produtos completos → roda direto pelo cadastro, IA não preenche brand/model/gtin.
6. **Forçar regressão**: completar produto, abrir wizard, em outra aba esvaziar marca no cadastro e tentar publicar → bloqueio silencioso com atalho "Abrir cadastro".
7. **Reabrir o dialog** após resolver atributos → não recalcula, não gasta IA.

## Fora do escopo desta entrega (a fechar depois)

- **Importação por planilha**: a validação do cadastro fica para a próxima onda — vai reaproveitar `checkMlReadiness` no parser de linhas para gerar relatório de pendências.
- **Relatório consolidado do passivo** antes de ativar bloqueio universal — disponível assim que você pedir; o filtro de incompletos já cobre o uso operacional.

## 📝 DOCUMENTAÇÃO NECESSÁRIA

✅ Sem atualização adicional necessária — `mercado-livre.md` v3.8, memória anti-regressão e índice estão atualizados na mesma entrega.
