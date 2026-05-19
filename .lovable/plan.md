## Contexto

Hoje o sistema oferece 3 opções de regime tributário na configuração fiscal: Simples Nacional, Simples Nacional (excesso) e Regime Normal (Lucro Presumido/Real). Falta o **MEI**, que é um regime próprio com código fiscal específico (código 4 na SEFAZ). Lojistas MEI hoje marcam "Simples Nacional" por engano, o sistema envia o código 1 e a SEFAZ rejeita por divergência cadastral — foi exatamente o que aconteceu na NF 1-289 da loja "Respeite o Homem".

O ajuste é exclusivamente fiscal e não muda a experiência de uso: adiciona uma 4ª opção no seletor de regime na tela de Configurações Fiscais.

## O que será feito

### 1. Nova opção "MEI" no seletor de Regime Tributário
- A tela de Configurações Fiscais → Parâmetros Fiscais passa a oferecer 4 opções:
  - **MEI (Microempreendedor Individual)** ← nova
  - Simples Nacional
  - Simples Nacional (excesso de sublimite)
  - Regime Normal (Lucro Presumido/Real)
- Quando o lojista escolher MEI, o sistema envia para a SEFAZ o código correto (4 — "Simples Nacional MEI"), eliminando a rejeição por divergência cadastral.

### 2. Tratamento fiscal correto para MEI nas notas
- MEI segue as mesmas regras práticas do Simples Nacional na NF: **sem destaque de PIS, COFINS e ICMS**, usando código de situação tributária CSOSN (padrão 102 — "Sem permissão de crédito"), idêntico ao já aplicado para Simples comum.
- Observação obrigatória do Simples Nacional permanece sendo aplicada automaticamente.
- Nenhum campo novo precisa ser preenchido pelo lojista MEI além de escolher o regime.

### 3. Migração de dados
- Lojistas que hoje estão como "Simples Nacional" continuam como estão. **Não há reclassificação automática** — cada lojista decide se é MEI ou Simples comum (são coisas diferentes na Receita).
- Comunicação proativa fica fora deste escopo (pode virar uma campanha de aviso depois, se você quiser).

### 4. Atualização da documentação fiscal
- Atualizar o doc oficial do módulo Fiscal registrando a nova opção, o código enviado para SEFAZ e a regra de tratamento.
- Atualizar o mapa de UI registrando a nova opção no seletor.

## Como você valida

1. Abrir Configurações Fiscais da loja "Respeite o Homem".
2. Trocar o Regime Tributário para **MEI** e salvar.
3. Reemitir a NF 1-289 (ou criar uma nova).
4. Esperado: SEFAZ autoriza a nota sem a mensagem de divergência de regime.

## Risco e segurança

- **Risco de regressão:** Baixo. Lojistas existentes não têm o regime alterado; só ganham uma opção adicional.
- **Segurança:** A mudança é restrita ao cadastro fiscal do próprio tenant (isolamento por loja preservado).
- **Reversibilidade:** Se algum lojista marcar MEI por engano, basta voltar para Simples Nacional na mesma tela.

---

### Bloco técnico (opcional, para registro)

- Banco: ampliar o CHECK de `fiscal_settings.regime_tributario` para aceitar `'mei'` além dos 3 atuais. Campo `crt` (int) passa a aceitar valor `4`.
- Adapter Focus NFe (`focus-nfe-adapter.ts`): incluir mapeamento `'4' → 4` em `CRT_TO_REGIME`.
- Calculadora de tributos (`fiscal-tax-calculator.ts`): tratar `regime_tributario IN ('simples_nacional','mei')` no mesmo caminho (sem destaque, CSOSN padrão 102).
- UI: incluir opção `{ value: '4', label: '4 - Simples Nacional - MEI' }` em `CRT_OPTIONS` nos 4 arquivos que o declaram (`EmitenteSettings.tsx`, `FiscalSettingsContent.tsx`, `OperationNaturesContent.tsx`, `OperationNaturesSettings.tsx`) e auto-sincronizar `regime_tributario='mei'` quando `crt=4` for selecionado.
- Tipos do hook `useFiscal.ts`: expandir union `regime_tributario` para incluir `'mei'`.
- Sem alteração de fluxo de emissão, webhook, fila ou trigger — apenas extensão de enum/opção.
