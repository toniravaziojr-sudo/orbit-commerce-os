import { useCallback, useMemo } from "react";
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  addEdge,
  useNodesState,
  useEdgesState,
  type OnConnect,
  type NodeTypes,
  BackgroundVariant,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import AutomationNodeComponent from "./AutomationNodeComponent";
import type { AutomationNode, AutomationEdge } from "@/hooks/useAutomationBuilder";

interface AutomationFlowCanvasProps {
  nodes: AutomationNode[];
  edges: AutomationEdge[];
  onNodesChange: React.Dispatch<React.SetStateAction<AutomationNode[]>>;
  onEdgesChange: React.Dispatch<React.SetStateAction<AutomationEdge[]>>;
  onNodeSelect: (id: string | null) => void;
}

export function AutomationFlowCanvas({
  nodes,
  edges,
  onNodesChange,
  onEdgesChange,
  onNodeSelect,
}: AutomationFlowCanvasProps) {
  const [rfNodes, setRfNodes, onRfNodesChange] = useNodesState(nodes);
  const [rfEdges, setRfEdges, onRfEdgesChange] = useEdgesState(edges);

  // Sync external state → internal state
  useMemo(() => {
    setRfNodes(nodes);
  }, [nodes, setRfNodes]);

  useMemo(() => {
    setRfEdges(edges);
  }, [edges, setRfEdges]);

  const nodeTypes: NodeTypes = useMemo(
    () => ({
      automationNode: AutomationNodeComponent,
    }),
    []
  );

  const onConnect: OnConnect = useCallback(
    (connection) => {
      const newEdge: AutomationEdge = {
        id: `e-${connection.source}-${connection.target}-${Date.now()}`,
        source: connection.source,
        target: connection.target,
        sourceHandle: connection.sourceHandle || undefined,
        targetHandle: connection.targetHandle || undefined,
        type: "smoothstep",
      };
      setRfEdges((eds) => addEdge(newEdge, eds));
      onEdgesChange((prev) => [...prev, newEdge]);
    },
    [setRfEdges, onEdgesChange]
  );

  const handleNodesChange = useCallback(
    (changes: any) => {
      onRfNodesChange(changes);
      // Sync position changes back
      setTimeout(() => {
        setRfNodes((current) => {
          onNodesChange(current as AutomationNode[]);
          return current;
        });
      }, 0);
    },
    [onRfNodesChange, setRfNodes, onNodesChange]
  );

  const handleNodeClick = useCallback(
    (_: any, node: any) => {
      onNodeSelect(node.id);
    },
    [onNodeSelect]
  );

  const handlePaneClick = useCallback(() => {
    onNodeSelect(null);
  }, [onNodeSelect]);

  return (
    <div className="flex-1 h-full">
      <ReactFlow
        nodes={rfNodes}
        edges={rfEdges}
        onNodesChange={handleNodesChange}
        onEdgesChange={onRfEdgesChange}
        onConnect={onConnect}
        onNodeClick={handleNodeClick}
        onPaneClick={handlePaneClick}
        nodeTypes={nodeTypes}
        defaultEdgeOptions={{
          type: "smoothstep",
          animated: true,
          style: { strokeWidth: 2 },
        }}
        fitView
        fitViewOptions={{ padding: 0.3 }}
        className="bg-muted/20"
        proOptions={{ hideAttribution: true }}
      >
        <Background variant={BackgroundVariant.Dots} gap={20} size={1} />
        <Controls showInteractive={false} />
        <MiniMap
          nodeColor={(n) => {
            const type = (n.data as any)?.nodeType;
            const colors: Record<string, string> = {
              trigger: "#8b5cf6",
              send_email: "#3b82f6",
              delay: "#f59e0b",
              condition: "#f97316",
              add_tag: "#22c55e",
              remove_tag: "#ef4444",
              move_to_list: "#a855f7",
              split_ab: "#ec4899",
              end: "#6b7280",
            };
            return colors[type] || "#6b7280";
          }}
          className="!bg-background/80 !border !border-border rounded-lg"
        />
      </ReactFlow>
    </div>
  );
}
