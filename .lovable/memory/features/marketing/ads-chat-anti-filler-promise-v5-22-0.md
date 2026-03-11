# Memory: features/marketing/ads-chat-anti-filler-promise-v5-22-0-and-progress-v5-23-0
Updated: 2026-03-11

## Fix: IA prometia ação sem executar ferramentas (v5.22.0)

### Problema
A IA do Chat de Tráfego respondia com "Aguarde enquanto preparo a criação das primeiras campanhas!" mas NÃO chamava nenhuma ferramenta (create_meta_campaign, generate_creative_image, etc.). A resposta terminava com uma promessa vazia — o usuário ficava esperando uma ação que nunca acontecia.

### Causa Raiz
1. **Prompt insuficiente**: As regras anti-alucinação (linha 4244) proibiam dizer "Estou criando" sem chamar ferramenta, mas NÃO proibiam explicitamente frases no futuro como "Aguarde enquanto preparo" ou "Vou começar a criar".
2. **Sem detecção de filler**: Quando a IA respondia com texto direto (sem tool calls), o sistema simplesmente retornava o texto — sem validar se continha promessas vazias.

### Correção (v5.22.0)
1. **System Prompt reforçado**: Novo bloco `⚠️ REGRA ANTI-PROMESSA VAZIA` com lista explícita de frases proibidas:
   - "Aguarde enquanto preparo/crio/gero..."
   - "Vou começar a criar..."
   - "Estou preparando..."
   - Qualquer frase no futuro sem tool call correspondente
2. **Filler Phrase Detection**: No path de resposta direta (sem tool calls), regex patterns detectam promessas vazias e forçam um retry com `tool_choice: "required"`, injetando mensagem de sistema: "Você prometeu executar ações mas NÃO chamou nenhuma ferramenta. EXECUTE AGORA."
3. **Retry Loop**: Se o retry produz tool calls, executa o loop normal de ferramentas. Se falha, retorna o texto original como fallback.

### Padrões de Filler Detectados
- `/aguarde\s+(enquanto|enquanto\s+eu)/i`
- `/vou\s+(começar|criar|gerar|preparar|disparar|montar|buscar)/i`
- `/estou\s+(preparando|criando|gerando|montando|buscando)/i`
- `/dê-me\s+um\s+momento/i`
- `/vou\s+focar\s+em\s+criar/i`

### Checklist Anti-Regressão
- [ ] Prompt contém bloco ANTI-PROMESSA VAZIA
- [ ] Filler detection ativo no path de texto direto
- [ ] Retry com tool_choice=required quando filler detectado
- [ ] Fallback para texto original se retry falhar
