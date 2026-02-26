import { BLOCK_DEFINITIONS, EmailBlockType } from "@/lib/email-builder-utils";
import { Type, Image, MousePointerClick, Minus, Space, Columns2, ShoppingBag } from "lucide-react";
import { cn } from "@/lib/utils";

const ICON_MAP: Record<string, React.ComponentType<any>> = {
  Type, Image, MousePointerClick, Minus, Space, Columns2, ShoppingBag,
};

interface EmailBlocksSidebarProps {
  onAddBlock: (type: EmailBlockType) => void;
}

export function EmailBlocksSidebar({ onAddBlock }: EmailBlocksSidebarProps) {
  const blockTypes = Object.entries(BLOCK_DEFINITIONS) as [EmailBlockType, typeof BLOCK_DEFINITIONS[EmailBlockType]][];

  return (
    <div className="w-56 shrink-0 border-r bg-muted/30 overflow-y-auto">
      <div className="p-3 border-b">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Blocos</p>
      </div>
      <div className="p-2 space-y-1">
        {blockTypes.map(([type, def]) => {
          const Icon = ICON_MAP[def.icon] || Type;
          return (
            <button
              key={type}
              type="button"
              onClick={() => onAddBlock(type)}
              className={cn(
                "flex items-center gap-3 w-full px-3 py-2.5 rounded-md text-sm transition-colors",
                "hover:bg-primary/10 hover:text-primary text-muted-foreground",
                "active:scale-[0.98]"
              )}
            >
              <Icon className="h-4 w-4 shrink-0" />
              <span className="font-medium">{def.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
