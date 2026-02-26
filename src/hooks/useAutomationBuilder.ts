import { useState, useCallback, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useEmailMarketing } from "@/hooks/useEmailMarketing";
import { toast } from "sonner";
import type { Node, Edge } from "@xyflow/react";

export type AutomationNodeType =
  | "trigger"
  | "send_email"
  | "delay"
  | "condition"
  | "add_tag"
  | "remove_tag"
  | "move_to_list"
  | "split_ab"
  | "end";

export interface AutomationNodeData {
  label: string;
  nodeType: AutomationNodeType;
  config: Record<string, any>;
  [key: string]: unknown;
}

export type AutomationNode = Node<AutomationNodeData>;
export type AutomationEdge = Edge;

export interface FlowConfig {
  name: string;
  description: string;
  trigger_type: string;
  trigger_config: Record<string, any>;
}

const DEFAULT_TRIGGER_NODE: AutomationNode = {
  id: "trigger-1",
  type: "automationNode",
  position: { x: 250, y: 50 },
  data: {
    label: "Quando entrar na lista",
    nodeType: "trigger",
    config: {},
  },
};

export function useAutomationBuilder(flowId?: string) {
  const navigate = useNavigate();
  const { tenantId } = useEmailMarketing();
  const [nodes, setNodes] = useState<AutomationNode[]>([DEFAULT_TRIGGER_NODE]);
  const [edges, setEdges] = useState<AutomationEdge[]>([]);
  const [flowConfig, setFlowConfig] = useState<FlowConfig>({
    name: "",
    description: "",
    trigger_type: "list_subscription",
    trigger_config: {},
  });
  const [isSaving, setIsSaving] = useState(false);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [flowStatus, setFlowStatus] = useState<string>("draft");

  const selectedNode = nodes.find((n) => n.id === selectedNodeId) || null;

  // Load existing flow
  useEffect(() => {
    if (!flowId || !tenantId) return;
    const load = async () => {
      const { data: flow } = await supabase
        .from("email_automation_flows")
        .select("*")
        .eq("id", flowId)
        .single();
      if (!flow) return;

      setFlowConfig({
        name: flow.name,
        description: flow.description || "",
        trigger_type: flow.trigger_type,
        trigger_config: (flow.trigger_config as Record<string, any>) || {},
      });
      setFlowStatus(flow.status);

      const { data: dbNodes } = await supabase
        .from("email_automation_nodes")
        .select("*")
        .eq("flow_id", flowId);

      const { data: dbEdges } = await supabase
        .from("email_automation_edges")
        .select("*")
        .eq("flow_id", flowId);

      if (dbNodes?.length) {
        setNodes(
          dbNodes.map((n: any) => ({
            id: n.id,
            type: "automationNode",
            position: { x: n.position_x, y: n.position_y },
            data: {
              label: n.label || n.node_type,
              nodeType: n.node_type as AutomationNodeType,
              config: (n.config as Record<string, any>) || {},
            },
          }))
        );
      }

      if (dbEdges?.length) {
        setEdges(
          dbEdges.map((e: any) => ({
            id: e.id,
            source: e.source_node_id,
            target: e.target_node_id,
            sourceHandle: e.source_handle || "default",
            label: e.label || undefined,
          }))
        );
      }
    };
    load();
  }, [flowId, tenantId]);

  const addNode = useCallback(
    (type: AutomationNodeType, position?: { x: number; y: number }) => {
      const labels: Record<AutomationNodeType, string> = {
        trigger: "Trigger",
        send_email: "Enviar Email",
        delay: "Aguardar",
        condition: "Condição",
        add_tag: "Adicionar Tag",
        remove_tag: "Remover Tag",
        move_to_list: "Mover para Lista",
        split_ab: "Split A/B",
        end: "Fim do Fluxo",
      };

      const defaultConfigs: Record<AutomationNodeType, Record<string, any>> = {
        trigger: {},
        send_email: { template_id: "", subject: "" },
        delay: { value: 1, unit: "days" },
        condition: { field: "opened_email", operator: "equals", value: "true" },
        add_tag: { tag_id: "" },
        remove_tag: { tag_id: "" },
        move_to_list: { list_id: "" },
        split_ab: { variant_a_pct: 50 },
        end: {},
      };

      const newNode: AutomationNode = {
        id: crypto.randomUUID(),
        type: "automationNode",
        position: position || { x: 250, y: nodes.length * 150 + 50 },
        data: {
          label: labels[type],
          nodeType: type,
          config: defaultConfigs[type],
        },
      };

      setNodes((prev) => [...prev, newNode]);
      setSelectedNodeId(newNode.id);
      return newNode;
    },
    [nodes.length]
  );

  const updateNodeData = useCallback(
    (nodeId: string, data: Partial<AutomationNodeData>) => {
      setNodes((prev) =>
        prev.map((n) =>
          n.id === nodeId ? { ...n, data: { ...n.data, ...data } } : n
        )
      );
    },
    []
  );

  const removeNode = useCallback((nodeId: string) => {
    setNodes((prev) => prev.filter((n) => n.id !== nodeId));
    setEdges((prev) =>
      prev.filter((e) => e.source !== nodeId && e.target !== nodeId)
    );
    setSelectedNodeId((prev) => (prev === nodeId ? null : prev));
  }, []);

  const saveFlow = useCallback(
    async (status?: string) => {
      if (!tenantId) return;
      setIsSaving(true);
      try {
        const flowData = {
          tenant_id: tenantId,
          name: flowConfig.name,
          description: flowConfig.description || null,
          trigger_type: flowConfig.trigger_type,
          trigger_config: flowConfig.trigger_config,
          status: status || flowStatus,
        };

        let savedFlowId = flowId;

        if (flowId) {
          const { error } = await supabase
            .from("email_automation_flows")
            .update(flowData)
            .eq("id", flowId);
          if (error) throw error;
        } else {
          const { data, error } = await supabase
            .from("email_automation_flows")
            .insert(flowData)
            .select("id")
            .single();
          if (error) throw error;
          savedFlowId = data.id;
        }

        // Delete existing nodes/edges and recreate
        if (flowId) {
          await supabase
            .from("email_automation_edges")
            .delete()
            .eq("flow_id", flowId);
          await supabase
            .from("email_automation_nodes")
            .delete()
            .eq("flow_id", flowId);
        }

        // Map old IDs to new UUIDs for edges
        const idMap = new Map<string, string>();
        const dbNodes = nodes.map((n) => {
          const newId = crypto.randomUUID();
          idMap.set(n.id, newId);
          return {
            id: newId,
            flow_id: savedFlowId!,
            tenant_id: tenantId,
            node_type: n.data.nodeType,
            label: n.data.label,
            config: n.data.config,
            position_x: n.position.x,
            position_y: n.position.y,
          };
        });

        if (dbNodes.length) {
          const { error } = await supabase
            .from("email_automation_nodes")
            .insert(dbNodes);
          if (error) throw error;
        }

        const dbEdges = edges.map((e) => ({
          id: crypto.randomUUID(),
          flow_id: savedFlowId!,
          tenant_id: tenantId,
          source_node_id: idMap.get(e.source) || e.source,
          target_node_id: idMap.get(e.target) || e.target,
          source_handle: (e as any).sourceHandle || "default",
          label: (e.label as string) || null,
        }));

        if (dbEdges.length) {
          const { error } = await supabase
            .from("email_automation_edges")
            .insert(dbEdges);
          if (error) throw error;
        }

        toast.success("Automação salva com sucesso!");
        if (!flowId) {
          navigate(`/email-marketing/automation/${savedFlowId}`);
        }
      } catch (err: any) {
        console.error("Save flow error:", err);
        toast.error(err.message || "Erro ao salvar automação");
      } finally {
        setIsSaving(false);
      }
    },
    [tenantId, flowId, flowConfig, flowStatus, nodes, edges, navigate]
  );

  return {
    nodes,
    setNodes,
    edges,
    setEdges,
    flowConfig,
    setFlowConfig,
    selectedNodeId,
    setSelectedNodeId,
    selectedNode,
    flowStatus,
    setFlowStatus,
    addNode,
    updateNodeData,
    removeNode,
    saveFlow,
    isSaving,
  };
}
