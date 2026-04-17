import { useEffect } from "react";
import { ReactFlowProvider } from "@xyflow/react";
import { useAutomationBuilder } from "@/hooks/useAutomationBuilder";
import { AutomationFlowCanvas } from "@/components/email-marketing/automation-builder/AutomationFlowCanvas";
import { AutomationSidebar } from "@/components/email-marketing/automation-builder/AutomationSidebar";
import { AutomationNodePanel } from "@/components/email-marketing/automation-builder/AutomationNodePanel";
import { Button } from "@/components/ui/button";
import { Save, CheckCircle2 } from "lucide-react";

interface Props {
  campaignName: string;
  listId: string;
  currentFlowId?: string;
  onFlowSaved: (flowId: string) => void;
}

function InnerBuilder({ campaignName, listId, currentFlowId, onFlowSaved }: Props) {
  const builder = useAutomationBuilder(currentFlowId);

  // Sincroniza nome da campanha → nome do fluxo (se ainda vazio)
  useEffect(() => {
    if (campaignName && !builder.flowConfig.name) {
      builder.setFlowConfig({
        ...builder.flowConfig,
        name: campaignName,
        trigger_config: { ...builder.flowConfig.trigger_config, list_id: listId },
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [campaignName, listId]);

  const handleSave = async () => {
    await builder.saveFlow("draft");
    // O hook navega para /email-marketing/automation/:id ao salvar — interceptamos via flowId pelo retorno do hook,
    // que após save passa a expor através do effect de load. Aqui usamos a estratégia de re-renderização: o usuário
    // clica salvar; ao receber um id na URL via navegação, o componente externo persiste em currentFlowId.
    // Como o hook navega para outra rota, evitamos isso passando flowId via callback abaixo.
  };

  return (
    <div className="flex flex-col h-[calc(100vh-280px)] border rounded-lg overflow-hidden">
      <div className="flex items-center justify-between px-4 py-2 border-b bg-muted/30">
        <div className="flex items-center gap-2 text-sm">
          <span className="font-medium">Construtor Visual</span>
          {currentFlowId && (
            <span className="flex items-center gap-1 text-xs text-primary">
              <CheckCircle2 className="h-3.5 w-3.5" /> Fluxo vinculado
            </span>
          )}
        </div>
        <Button
          size="sm"
          onClick={async () => {
            const id = await builder.saveFlow("draft", { skipNavigate: true, onSaved: onFlowSaved });
            if (id) onFlowSaved(id);
          }}
          disabled={builder.isSaving || !builder.flowConfig.name}
          className="gap-1.5"
        >
          <Save className="h-4 w-4" />
          {builder.isSaving ? "Salvando..." : "Salvar fluxo"}
        </Button>
      </div>

      <div className="flex flex-1 min-h-0">
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
  );
}

export function VisualAutomationStep(props: Props) {
  return (
    <div className="p-4">
      <ReactFlowProvider>
        <InnerBuilder {...props} />
      </ReactFlowProvider>
    </div>
  );
}
