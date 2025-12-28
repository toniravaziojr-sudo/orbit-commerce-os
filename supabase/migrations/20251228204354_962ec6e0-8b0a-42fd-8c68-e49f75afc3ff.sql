-- Drop existing policies
DROP POLICY IF EXISTS "Tenant admins can manage mailboxes" ON public.mailboxes;
DROP POLICY IF EXISTS "Tenant members can view mailboxes" ON public.mailboxes;

-- Create proper policies with WITH CHECK for INSERT
CREATE POLICY "Tenant members can view mailboxes" 
ON public.mailboxes 
FOR SELECT 
USING (user_belongs_to_tenant(auth.uid(), tenant_id));

CREATE POLICY "Tenant admins can insert mailboxes" 
ON public.mailboxes 
FOR INSERT 
WITH CHECK (
  EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_roles.user_id = auth.uid()
      AND user_roles.tenant_id = mailboxes.tenant_id
      AND user_roles.role IN ('owner', 'admin')
  )
);

CREATE POLICY "Tenant admins can update mailboxes" 
ON public.mailboxes 
FOR UPDATE 
USING (
  EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_roles.user_id = auth.uid()
      AND user_roles.tenant_id = mailboxes.tenant_id
      AND user_roles.role IN ('owner', 'admin')
  )
);

CREATE POLICY "Tenant admins can delete mailboxes" 
ON public.mailboxes 
FOR DELETE 
USING (
  EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_roles.user_id = auth.uid()
      AND user_roles.tenant_id = mailboxes.tenant_id
      AND user_roles.role IN ('owner', 'admin')
  )
);