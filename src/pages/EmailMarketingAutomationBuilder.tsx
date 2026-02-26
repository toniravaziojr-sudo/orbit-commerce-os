import { useParams } from "react-router-dom";
import { useAutomationBuilder } from "@/hooks/useAutomationBuilder";
import { AutomationFlowCanvas } from "@/components/email-marketing/automation-builder/AutomationFlowCanvas";
import { AutomationSidebar } from "@/components/email-marketing/automation-builder/AutomationSidebar";
import { AutomationNodePanel } from "@/components/email-marketing/automation-builder/AutomationNodePanel";
import { AutomationTopBar } from "@/components/email-marketing/automation-builder/AutomationTopBar";
import { ReactFlowProvider } from "@xyflow/react";

export default function EmailMarketingAutomationBuilder() {
  const { flowId } = useParams();
  const builder = useAutomationBuilder(flowId);

  return (
    <ReactFlowProvider>
      <div className="flex flex-col h-[calc(100vh-4rem)] -m-6">
        <AutomationTopBar
          flowConfig={builder.flowConfig}
          onConfigChange={builder.setFlowConfig}
          onSave={() => builder.saveFlow()}
          onActivate={() => builder.saveFlow("active")}
          isSaving={builder.isSaving}
          flowStatus={builder.flowStatus}
        />
        <div className="flex flex-1 min-h-0 overflow-hidden">
          <AutomationSidebar onAddNode={builder.addNode} />
          <AutomationFlowCanvas
            nodes={builder.nodes}
            edges={builder.edges}
            onNodesChange={builder.setNodes}
            onEdgesChange={builder.setEdges}
            onNodeSelect={builder.setSelectedNodeId}
          />
          <AutomationNodePanel
            node={builder.selectedNode}
            onUpdate={builder.updateNodeData}
            onRemove={builder.removeNode}
            onClose={() => builder.setSelectedNodeId(null)}
          />
        </div>
      </div>
    </ReactFlowProvider>
  );
}
