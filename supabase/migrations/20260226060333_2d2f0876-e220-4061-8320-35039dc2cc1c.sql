
-- ================================================
-- Automation Flow Builder Tables
-- ================================================

-- 1. Flows (definição do fluxo de automação)
CREATE TABLE public.email_automation_flows (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'paused', 'archived')),
  trigger_type TEXT NOT NULL DEFAULT 'list_subscription' CHECK (trigger_type IN (
    'list_subscription', 'tag_added', 'tag_removed', 
    'order_placed', 'order_paid', 'cart_abandoned',
    'manual'
  )),
  trigger_config JSONB NOT NULL DEFAULT '{}',
  stats JSONB DEFAULT '{"enrolled": 0, "completed": 0, "active": 0}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. Nodes (nós do canvas)
CREATE TABLE public.email_automation_nodes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  flow_id UUID NOT NULL REFERENCES public.email_automation_flows(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  node_type TEXT NOT NULL CHECK (node_type IN (
    'trigger', 'send_email', 'delay', 'condition',
    'add_tag', 'remove_tag', 'move_to_list',
    'split_ab', 'end'
  )),
  label TEXT,
  config JSONB NOT NULL DEFAULT '{}',
  position_x DOUBLE PRECISION NOT NULL DEFAULT 0,
  position_y DOUBLE PRECISION NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3. Edges (conexões entre nós)
CREATE TABLE public.email_automation_edges (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  flow_id UUID NOT NULL REFERENCES public.email_automation_flows(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  source_node_id UUID NOT NULL REFERENCES public.email_automation_nodes(id) ON DELETE CASCADE,
  target_node_id UUID NOT NULL REFERENCES public.email_automation_nodes(id) ON DELETE CASCADE,
  source_handle TEXT DEFAULT 'default',
  label TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 4. Enrollments (subscribers ativos no fluxo)
CREATE TABLE public.email_automation_enrollments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  flow_id UUID NOT NULL REFERENCES public.email_automation_flows(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  subscriber_id UUID NOT NULL REFERENCES public.email_marketing_subscribers(id) ON DELETE CASCADE,
  current_node_id UUID REFERENCES public.email_automation_nodes(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed', 'paused', 'failed', 'exited')),
  enrolled_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ,
  next_action_at TIMESTAMPTZ,
  metadata JSONB DEFAULT '{}'
);

-- 5. Execution logs
CREATE TABLE public.email_automation_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  flow_id UUID NOT NULL REFERENCES public.email_automation_flows(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  enrollment_id UUID REFERENCES public.email_automation_enrollments(id) ON DELETE SET NULL,
  node_id UUID REFERENCES public.email_automation_nodes(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  result TEXT,
  details JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX idx_automation_flows_tenant ON public.email_automation_flows(tenant_id);
CREATE INDEX idx_automation_nodes_flow ON public.email_automation_nodes(flow_id);
CREATE INDEX idx_automation_edges_flow ON public.email_automation_edges(flow_id);
CREATE INDEX idx_automation_enrollments_flow ON public.email_automation_enrollments(flow_id);
CREATE INDEX idx_automation_enrollments_status ON public.email_automation_enrollments(status, next_action_at);
CREATE INDEX idx_automation_logs_flow ON public.email_automation_logs(flow_id);

-- RLS
ALTER TABLE public.email_automation_flows ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_automation_nodes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_automation_edges ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_automation_enrollments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_automation_logs ENABLE ROW LEVEL SECURITY;

-- Policies: tenant access via user_roles
CREATE POLICY "Tenant users can manage flows" ON public.email_automation_flows
  FOR ALL USING (public.user_has_tenant_access(tenant_id));

CREATE POLICY "Tenant users can manage nodes" ON public.email_automation_nodes
  FOR ALL USING (public.user_has_tenant_access(tenant_id));

CREATE POLICY "Tenant users can manage edges" ON public.email_automation_edges
  FOR ALL USING (public.user_has_tenant_access(tenant_id));

CREATE POLICY "Tenant users can manage enrollments" ON public.email_automation_enrollments
  FOR ALL USING (public.user_has_tenant_access(tenant_id));

CREATE POLICY "Tenant users can view logs" ON public.email_automation_logs
  FOR SELECT USING (public.user_has_tenant_access(tenant_id));

-- Updated_at trigger
CREATE TRIGGER update_automation_flows_updated_at
  BEFORE UPDATE ON public.email_automation_flows
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
