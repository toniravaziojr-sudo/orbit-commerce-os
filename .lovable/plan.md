# Plano — Naturezas e tributação por Regime Tributário do emitente

## Decisões confirmadas pelo usuário
1. Tratar os 4 regimes: MEI, Simples Nacional, Lucro Presumido, Lucro Real.
2. Para MEI, o sistema disponibiliza por padrão apenas as naturezas que MEI pode usar (as demais ficam ocultas no seletor).
3. Não há NF em uso com natureza que possa ficar incompatível; se aparecer no futuro, deixar o lojista decidir (apenas aviso, sem bloqueio).

## Como vai funcionar
- O **regime tributário** continua sendo definido nas Configurações Fiscais do emitente (campo já existente).
- Cada **Natureza de Operação** declara **quais regimes a aceitam** e, quando necessário, qual o CFOP e o código tributário corretos por regime (overrides).
- No **editor de NF**, o seletor de Natureza mostra apenas as compatíveis com o regime do emitente.
- Ao escolher a Natureza, o sistema preenche automaticamente CFOP (intra/inter pela UF) e o código tributário do item de acordo com o regime do emitente.
- O seletor **"Natureza padrão para vendas automáticas"** das Configurações Fiscais também passa a listar apenas as naturezas compatíveis com o regime atual.
- Override manual por item continua permitido com badge "manual".

## Catálogo padrão (regimes compatíveis e overrides)

| Operação | MEI | Simples | Presumido | Real | Observações |
|---|:-:|:-:|:-:|:-:|---|
| Venda de Mercadoria | ✅ | ✅ | ✅ | ✅ | Simples/MEI: CSOSN 102 · Presumido/Real: CST 00 |
| Venda Produção Própria | ❌ | ✅ | ✅ | ✅ | MEI não industrializa |
| Venda para Entrega Futura | ✅ | ✅ | ✅ | ✅ | |
| Devolução de Venda | ✅ | ✅ | ✅ | ✅ | CSOSN 900 / CST conforme original |
| Devolução de Compra | ✅ | ✅ | ✅ | ✅ | CSOSN 900 / CST conforme original |
| Compra de Mercadoria | ✅ | ✅ | ✅ | ✅ | Entrada |
| Compra Uso/Consumo | ✅ | ✅ | ✅ | ✅ | Entrada |
| Transferência | ❌ | ✅ | ✅ | ✅ | MEI não tem filial |
| Remessa para Conserto | ✅ | ✅ | ✅ | ✅ | MEI: CSOSN 900 · Simples: 400 · Presumido/Real: CST 41 |
| Retorno de Conserto | ✅ | ✅ | ✅ | ✅ | |
| Remessa para Demonstração | ✅ | ✅ | ✅ | ✅ | MEI: CSOSN 900 · Simples: 400 · Presumido/Real: CST 41 |
| Retorno de Demonstração | ✅ | ✅ | ✅ | ✅ | |
| Remessa em Consignação | ❌ | ✅ | ✅ | ✅ | MEI não opera consignação |
| Devolução de Consignação | ❌ | ✅ | ✅ | ✅ | |
| Remessa para Troca | ✅ | ✅ | ✅ | ✅ | MEI: CSOSN 900 |
| Bonificação | ✅ | ✅ | ✅ | ✅ | MEI: CSOSN 900 · Simples: 400 |
| Amostra Grátis | ✅ | ✅ | ✅ | ✅ | MEI: CSOSN 900 · Simples: 400 |
| Simples Remessa | ✅ | ✅ | ✅ | ✅ | MEI: CSOSN 900 · Simples: 400 |

Regra-chave de tributação por regime:
- **MEI (CRT 4)** e **Simples (CRT 1/2)** → usam **CSOSN** (não CST ICMS).
- **Lucro Presumido / Real (CRT 3)** → usam **CST ICMS** (00, 40, 41 conforme operação) e não CSOSN.
- A escolha do código segue a Natureza + regime.

## Mudanças por área
- **Catálogo de Naturezas (banco)**: cada natureza-sistema passa a registrar a lista de regimes aceitos e, quando necessário, o código tributário específico por regime. Backfill aplicado a todos os tenants existentes.
- **Naturezas customizadas do tenant**: ganham seletor visual "Regimes compatíveis" (default: todos).
- **Configurações Fiscais (Emitente)**: aviso resumido do regime atual + seletor de natureza padrão filtrado.
- **Editor de NF**: seletor de natureza filtrado pelo regime; recálculo automático de CFOP e código tributário; badge "manual" quando há override por item.
- **Motor de emissão**: passa o CRT do emitente para a resolução e usa o par CFOP + código tributário correto.
- **Anti-regressão**: memória dedicada — "naturezas e tributação são funções do regime do emitente; é proibido decidir CFOP/CSOSN/CST sem ler o CRT".

## Fases de execução
1. **Banco**: novos atributos no catálogo + atualização do seed-system + backfill.
2. **Resolver**: estende a resolução para devolver também o código tributário considerando CRT.
3. **Motor**: as 3 funções de criação/edição de rascunho passam a aplicar o código tributário do regime.
4. **UI**: filtro de naturezas no editor de NF e no seletor de natureza padrão das Configurações; campo "regimes compatíveis" no formulário de natureza customizada.
5. **Validação**: reemissão da NF 1-341 (Remessa MEI) com o par correto.
6. **Documentação**: atualizar `docs/especificacoes/erp/erp-fiscal.md`, atualizar a memória CFOP existente e criar a memória anti-regressão de tributação por regime.

## O que NÃO muda
- CFOP continua exclusivamente derivado da Natureza (não volta para o produto nem para CFOP global).
- Cadastro de Produto continua sem CFOP.
- Override manual por item continua permitido, com sinalização.
- Catálogo permanece global e idêntico em todos os tenants — só ganha a dimensão "regime".
