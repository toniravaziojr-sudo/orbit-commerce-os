# Memory: features/marketing/ads-chat-v2-internal-drive-logic-v6-11-0
Updated: 2026-03-13

O Ads Chat v2 (v6.12.0) utiliza uma arquitetura de execução direta de ferramentas para gerenciar o 'Meu Drive' (storage interno do sistema). 
1. Identidade do Drive: O sistema proíbe terminantemente qualquer menção ao 'Google Drive' nos prompts e ferramentas. O termo 'Meu Drive' refere-se exclusivamente ao armazenamento de arquivos e mídias do próprio tenant na plataforma. 
2. Acesso Factual: O motor utiliza 'browse_drive', 'search_drive_files' e 'get_product_images' via 'executeToolDirect' como fallback de segurança caso a delegação primária falhe. 
3. Orquestração: Consultas sobre criativos, fotos de produtos ou mídias de campanha são mapeadas para a categoria 'creative', que possui permissão de leitura total sobre a hierarquia de pastas e arquivos para evitar alucinações sobre a ausência de acesso a dados.
4. Busca por Pasta (v6.12.0): `search_drive_files` agora busca em 3 dimensões: (a) nome do arquivo, (b) nome da pasta onde o arquivo está, (c) vínculo metadata.product_id com produtos. Isso resolve sub-contagem quando criativos estão em pastas nomeadas pelo produto mas os arquivos individuais não contêm o nome do produto.
5. Contagem Autoritativa (v6.12.0): O campo `total_found` no retorno é a contagem exata. O system prompt instrui o modelo a NUNCA inventar contagens — deve usar `total_found` literalmente. O campo `total_tenant_files` mostra o total geral de arquivos do tenant para contexto. O campo `matched_folders` lista pastas cujo nome bateu com a query.
