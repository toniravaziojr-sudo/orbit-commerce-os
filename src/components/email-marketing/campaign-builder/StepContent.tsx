import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { EmailBlocksSidebar } from "./EmailBlocksSidebar";
import { EmailCanvas } from "./EmailCanvas";
import { BlockPropertyEditor } from "./BlockPropertyEditor";
import { CampaignContent } from "@/hooks/useEmailCampaignBuilder";
import { EmailBlock, EmailBlockType } from "@/lib/email-builder-utils";

interface StepContentProps {
  content: CampaignContent;
  onContentChange: (content: CampaignContent) => void;
  selectedBlockId: string | null;
  selectedBlock: EmailBlock | null;
  onSelectBlock: (id: string | null) => void;
  onAddBlock: (type: EmailBlockType) => void;
  onUpdateBlock: (id: string, props: Record<string, any>) => void;
  onRemoveBlock: (id: string) => void;
  onDuplicateBlock: (id: string) => void;
  onMoveBlock: (from: number, to: number) => void;
}

export function StepContent({
  content, onContentChange,
  selectedBlockId, selectedBlock, onSelectBlock,
  onAddBlock, onUpdateBlock, onRemoveBlock, onDuplicateBlock, onMoveBlock,
}: StepContentProps) {
  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Subject row */}
      <div className="border-b bg-background px-4 py-3 flex gap-4 items-end shrink-0">
        <div className="flex-1 space-y-1">
          <Label className="text-xs">Assunto do email *</Label>
          <Input
            value={content.subject}
            onChange={e => onContentChange({ ...content, subject: e.target.value })}
            placeholder="Ex: Promoção exclusiva para você!"
            className="h-9"
          />
        </div>
        <div className="flex-1 space-y-1">
          <Label className="text-xs">Texto de preview</Label>
          <Input
            value={content.previewText}
            onChange={e => onContentChange({ ...content, previewText: e.target.value })}
            placeholder="Texto que aparece na prévia do email"
            className="h-9"
          />
        </div>
      </div>

      {/* Builder area */}
      <div className="flex flex-1 min-h-0 overflow-hidden">
        <EmailBlocksSidebar onAddBlock={onAddBlock} />
        <EmailCanvas
          blocks={content.blocks}
          selectedBlockId={selectedBlockId}
          onSelectBlock={onSelectBlock}
          onRemoveBlock={onRemoveBlock}
          onDuplicateBlock={onDuplicateBlock}
          onMoveBlock={onMoveBlock}
        />
        <BlockPropertyEditor block={selectedBlock} onUpdate={onUpdateBlock} />
      </div>
    </div>
  );
}
