# Memory: features/marketing/ads-chat-orchestration-and-governance-v6
Updated: 2026-03-13

O Ads Chat (v6.11.0) utiliza uma arquitetura de orquestração factual avançada com um sistema de execução de ferramentas em dois níveis (Two-Tier Tool Execution). 
1. Delegação: O sistema tenta delegar a execução de ferramentas para o motor legado ('ads-chat' v1).
2. Fallback Direto: Se a delegação falhar ou não for suportada, o 'ads-chat-v2' executa as ferramentas ('browse_drive', 'search_drive_files', 'get_product_images') diretamente via 'executeToolDirect' para garantir acesso ininterrupto a arquivos e dados do catálogo. 
3. Modo Híbrido: Mantém o isolamento de contexto onde consultas factuais precedem propostas estratégicas, exigindo aprovação do usuário para ações de escrita ('submit_strategic_proposal'). 
4. Drill-Down: Permite navegação profunda (campanha -> adset -> anúncio) preservando filtros e IDs entre turnos.
5. Drive Interno (v6.11.0): Todos os system prompts (factual, conversacional, estratégico) explicitam que "Drive" = Drive INTERNO do sistema ("Meu Drive"), NÃO Google Drive. As descrições das ferramentas `browse_drive` e `search_drive_files` também incluem "NÃO é Google Drive" para evitar confusão do modelo. A IA NUNCA deve mencionar Google Drive — o sistema não o utiliza.
