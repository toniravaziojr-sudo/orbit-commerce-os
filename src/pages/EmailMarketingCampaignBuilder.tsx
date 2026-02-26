import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { CampaignStepBar } from "@/components/email-marketing/campaign-builder/CampaignStepBar";
import { StepConfig } from "@/components/email-marketing/campaign-builder/StepConfig";
import { StepContent } from "@/components/email-marketing/campaign-builder/StepContent";
import { StepReview } from "@/components/email-marketing/campaign-builder/StepReview";
import { useEmailCampaignBuilder } from "@/hooks/useEmailCampaignBuilder";

export default function EmailMarketingCampaignBuilder() {
  const navigate = useNavigate();
  const builder = useEmailCampaignBuilder();

  const canNavigateToStep = (target: number) => {
    if (target <= builder.step) return true;
    // Can only go forward if current steps are valid
    for (let i = 0; i < target; i++) {
      if (i === 0 && (builder.config.name.trim() === "" || builder.config.list_id === "")) return false;
      if (i === 1 && (builder.content.subject.trim() === "" || builder.content.blocks.length === 0)) return false;
    }
    return true;
  };

  return (
    <div className="flex flex-col h-[calc(100vh-64px)] animate-fade-in">
      {/* Header */}
      <div className="border-b bg-background px-4 py-3 shrink-0">
        <div className="flex items-center gap-4 mb-3">
          <Button variant="ghost" size="sm" onClick={() => navigate("/email-marketing")} className="gap-1.5">
            <ArrowLeft className="h-4 w-4" /> Voltar
          </Button>
          <h1 className="text-lg font-semibold">Nova Campanha</h1>
        </div>
        <CampaignStepBar
          currentStep={builder.step}
          onStepClick={builder.setStep}
          canNavigate={canNavigateToStep}
        />
      </div>

      {/* Content */}
      <div className="flex-1 min-h-0 overflow-y-auto">
        {builder.step === 0 && (
          <div className="p-6">
            <StepConfig config={builder.config} onChange={builder.setConfig} />
          </div>
        )}

        {builder.step === 1 && (
          <StepContent
            content={builder.content}
            onContentChange={builder.setContent}
            selectedBlockId={builder.selectedBlockId}
            selectedBlock={builder.selectedBlock}
            onSelectBlock={builder.setSelectedBlockId}
            onAddBlock={builder.addBlock}
            onUpdateBlock={builder.updateBlock}
            onRemoveBlock={builder.removeBlock}
            onDuplicateBlock={builder.duplicateBlock}
            onMoveBlock={builder.moveBlock}
          />
        )}

        {builder.step === 2 && (
          <div className="p-6">
            <StepReview
              config={builder.config}
              content={builder.content}
              html={builder.getHtml()}
              onSend={builder.sendCampaign}
              isSending={builder.isSending}
            />
          </div>
        )}
      </div>

      {/* Footer nav */}
      {builder.step < 2 && (
        <div className="border-t bg-background px-6 py-3 flex justify-between shrink-0">
          <Button
            variant="outline"
            onClick={() => builder.step > 0 ? builder.setStep(builder.step - 1) : navigate("/email-marketing")}
            className="gap-1.5"
          >
            <ArrowLeft className="h-4 w-4" />
            {builder.step === 0 ? "Cancelar" : "Anterior"}
          </Button>
          <Button
            onClick={() => builder.setStep(builder.step + 1)}
            disabled={!builder.canGoNext()}
            className="gap-1.5"
          >
            Próximo <ArrowRight className="h-4 w-4" />
          </Button>
        </div>
      )}
    </div>
  );
}
