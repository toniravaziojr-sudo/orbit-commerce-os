-- Limpeza de usuários e tenant de teste (autorizada pelo usuário)
-- 1. Remove vínculo de shyyxn9@gmail.com com Respeite o Homem (mantém em Comando Central)
DELETE FROM public.user_roles 
WHERE id = '6b0e34e1-ae10-4f72-bf2e-f08ac820952b';

-- 2. Remove user_role do tenant órfão "Respeite o Homem Admin"
DELETE FROM public.user_roles 
WHERE tenant_id = '38c8a488-01da-4f4c-8ae7-238c1e56b0e1';

-- 3. Deleta o tenant "Respeite o Homem Admin" (vazio, validado)
DELETE FROM public.tenants 
WHERE id = '38c8a488-01da-4f4c-8ae7-238c1e56b0e1';

-- 4. Deleta usuários auth órfãos
DELETE FROM auth.users WHERE id = 'a32feb30-90b3-4aab-9ea4-88208718a854'; -- shyyxn9_admin
DELETE FROM auth.users WHERE id = '3bad32d6-1fbf-49e8-8054-b890b004ff32'; -- shyyxn9_admin2