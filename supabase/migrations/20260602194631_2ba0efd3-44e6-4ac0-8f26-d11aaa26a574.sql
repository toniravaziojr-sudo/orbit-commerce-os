-- Políticas RLS para o bucket privado `shipping-labels`.
-- Acesso só via edge functions (service_role). Membros do tenant podem listar
-- por meio das edges; aqui bloqueamos leitura/escrita direta de usuários.

-- Apenas service_role pode ler/inserir/atualizar.
-- (Não criamos policy para anon/authenticated.)
CREATE POLICY "shipping_labels_service_role_full"
ON storage.objects
FOR ALL
TO service_role
USING (bucket_id = 'shipping-labels')
WITH CHECK (bucket_id = 'shipping-labels');