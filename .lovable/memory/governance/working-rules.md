---
name: working-rules
description: Os 6 lembretes obrigatórios de comportamento da IA neste projeto
type: preference
---

# Regras de Trabalho

Estes são os 6 lembretes permanentes de COMO devo trabalhar neste projeto. Não descrevem o sistema — descrevem meu comportamento.

## 1. Seguir o Knowledge à risca
O Knowledge (Custom Instructions) é a Layer 1 e tem autoridade sobre meu comportamento. Toda resposta começa com o checklist de conformidade obrigatório quando há análise, correção, ajuste ou implementação.

## 2. Comunicação simples e não técnica
Falar com o usuário em linguagem clara de negócio, simples, objetiva e executiva. Não usar nomes de arquivos, tabelas, campos, hooks, queries, edge functions ou sintaxe técnica no corpo principal. Detalhes técnicos só em bloco separado e opcional, depois de confirmação ou quando o usuário pedir. Idioma: português do Brasil.

## 3. Documentar tudo nos docs do sistema
Toda nova implementação, atualização de função, UI, regra ou fluxo DEVE ser documentada nos docs apropriados:
- Regras macro → `docs/REGRAS-DO-SISTEMA.md`
- Especificações por módulo → `docs/especificacoes/<módulo>/`
- Mapa da UI (rotas/sidebar/telas) → `docs/especificacoes/transversais/mapa-ui.md`
- Padrões transversais → `docs/especificacoes/transversais/padroes-operacionais.md`
- Lições técnicas → `docs/tecnico/base-de-conhecimento-tecnico.md`

A memória NÃO é doc. A memória só serve para reforçar meu comportamento. Regras do sistema ficam apenas nos docs.

## 4. Validação técnica obrigatória ao final
Toda entrega que altere comportamento DEVE terminar com uma validação técnica real (consulta SQL, chamada de Edge, leitura de log, verificação de build, validação de HTML real via `?cb=`). Sem validação técnica, o status máximo é "Ajuste aplicado — pendente de validação". Formato obrigatório:

```
🔍 VALIDAÇÃO TÉCNICA EXECUTADA:
- [o que foi testado]
- [resultado: ✅ passou | ❌ falhou — detalhe]
- [o que depende de validação do usuário, se aplicável]
```

## 5. Testar no tenant `respeiteohomem` sempre que possível
Para cada novo ajuste ou implementação, executar pelo menos uma validação técnica usando o tenant `respeiteohomem` como ambiente de homologação informal. Se o cenário não permitir teste seguro, declarar o motivo explicitamente.

## 6. Ler os docs ANTES de propor qualquer ajuste ou ação
Antes de propor qualquer correção, ajuste, implementação ou ação, é obrigatório ler os docs formais do tema/módulo afetado (Layer 2/3/4). Memória ativa ou contexto da conversa NÃO substituem leitura de docs. Se o doc não existir, declarar lacuna documental no checklist. Nunca propor solução baseada em suposição ou em conhecimento prévio sem confirmar nos docs vigentes.
