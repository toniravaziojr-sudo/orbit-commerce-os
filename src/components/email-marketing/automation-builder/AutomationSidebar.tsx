import { 
  Mail, Clock, GitBranch, Tag, TagIcon, ArrowRightLeft, 
  Percent, StopCircle, Zap 
} from "lucide-react";
import type { AutomationNodeType } from "@/hooks/useAutomationBuilder";

interface AutomationSidebarProps {
  onAddNode: (type: AutomationNodeType) => void;
}

const NODE_CATEGORIES = [
  {
    label: "Ações",
    items: [
      { type: "send_email" as const, label: "Enviar Email", icon: Mail, color: "text-blue-500" },
      { type: "delay" as const, label: "Aguardar", icon: Clock, color: "text-amber-500" },
      { type: "add_tag" as const, label: "Adicionar Tag", icon: Tag, color: "text-green-500" },
      { type: "remove_tag" as const, label: "Remover Tag", icon: TagIcon, color: "text-red-500" },
      { type: "move_to_list" as const, label: "Mover p/ Lista", icon: ArrowRightLeft, color: "text-purple-500" },
    ],
  },
  {
    label: "Condições",
    items: [
      { type: "condition" as const, label: "Condição If/Else", icon: GitBranch, color: "text-orange-500" },
      { type: "split_ab" as const, label: "Split A/B", icon: Percent, color: "text-pink-500" },
    ],
  },
  {
    label: "Controle",
    items: [
      { type: "end" as const, label: "Fim do Fluxo", icon: StopCircle, color: "text-muted-foreground" },
    ],
  },
];

export function AutomationSidebar({ onAddNode }: AutomationSidebarProps) {
  return (
    <div className="w-56 border-r bg-muted/30 overflow-y-auto shrink-0">
      <div className="p-3 border-b">
        <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
          <Zap className="h-4 w-4" />
          Blocos
        </div>
      </div>
      
      {NODE_CATEGORIES.map((cat) => (
        <div key={cat.label} className="p-3">
          <h4 className="text-xs font-medium text-muted-foreground mb-2 uppercase tracking-wider">
            {cat.label}
          </h4>
          <div className="space-y-1">
            {cat.items.map((item) => (
              <button
                key={item.type}
                onClick={() => onAddNode(item.type)}
                className="w-full flex items-center gap-2 px-3 py-2 text-sm rounded-md
                  hover:bg-accent hover:text-accent-foreground transition-colors
                  border border-transparent hover:border-border cursor-grab"
              >
                <item.icon className={`h-4 w-4 ${item.color}`} />
                <span>{item.label}</span>
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
