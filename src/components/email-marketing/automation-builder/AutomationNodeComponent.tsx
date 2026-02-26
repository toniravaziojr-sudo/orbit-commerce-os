import { memo } from "react";
import { Handle, Position } from "@xyflow/react";
import { 
  Mail, Clock, GitBranch, Tag, TagIcon, ArrowRightLeft, 
  Percent, StopCircle, Zap 
} from "lucide-react";
import type { AutomationNodeData, AutomationNodeType } from "@/hooks/useAutomationBuilder";

const NODE_ICONS: Record<AutomationNodeType, React.ElementType> = {
  trigger: Zap,
  send_email: Mail,
  delay: Clock,
  condition: GitBranch,
  add_tag: Tag,
  remove_tag: TagIcon,
  move_to_list: ArrowRightLeft,
  split_ab: Percent,
  end: StopCircle,
};

const NODE_COLORS: Record<AutomationNodeType, { bg: string; border: string; icon: string }> = {
  trigger: { bg: "bg-violet-50 dark:bg-violet-950/40", border: "border-violet-300 dark:border-violet-700", icon: "text-violet-600 dark:text-violet-400" },
  send_email: { bg: "bg-blue-50 dark:bg-blue-950/40", border: "border-blue-300 dark:border-blue-700", icon: "text-blue-600 dark:text-blue-400" },
  delay: { bg: "bg-amber-50 dark:bg-amber-950/40", border: "border-amber-300 dark:border-amber-700", icon: "text-amber-600 dark:text-amber-400" },
  condition: { bg: "bg-orange-50 dark:bg-orange-950/40", border: "border-orange-300 dark:border-orange-700", icon: "text-orange-600 dark:text-orange-400" },
  add_tag: { bg: "bg-green-50 dark:bg-green-950/40", border: "border-green-300 dark:border-green-700", icon: "text-green-600 dark:text-green-400" },
  remove_tag: { bg: "bg-red-50 dark:bg-red-950/40", border: "border-red-300 dark:border-red-700", icon: "text-red-600 dark:text-red-400" },
  move_to_list: { bg: "bg-purple-50 dark:bg-purple-950/40", border: "border-purple-300 dark:border-purple-700", icon: "text-purple-600 dark:text-purple-400" },
  split_ab: { bg: "bg-pink-50 dark:bg-pink-950/40", border: "border-pink-300 dark:border-pink-700", icon: "text-pink-600 dark:text-pink-400" },
  end: { bg: "bg-muted", border: "border-border", icon: "text-muted-foreground" },
};

function AutomationNodeComponent({ data, selected }: { data: AutomationNodeData; selected?: boolean }) {
  const nodeType = data.nodeType;
  const Icon = NODE_ICONS[nodeType] || Zap;
  const colors = NODE_COLORS[nodeType] || NODE_COLORS.trigger;
  const isCondition = nodeType === "condition" || nodeType === "split_ab";

  return (
    <div
      className={`
        px-4 py-3 rounded-lg border-2 shadow-sm min-w-[180px] max-w-[220px]
        ${colors.bg} ${colors.border}
        ${selected ? "ring-2 ring-primary ring-offset-2" : ""}
        transition-all
      `}
    >
      {nodeType !== "trigger" && (
        <Handle
          type="target"
          position={Position.Top}
          className="!w-3 !h-3 !bg-foreground/50 !border-2 !border-background"
        />
      )}

      <div className="flex items-center gap-2">
        <div className={`p-1.5 rounded-md ${colors.bg}`}>
          <Icon className={`h-4 w-4 ${colors.icon}`} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-xs font-semibold text-foreground truncate">
            {data.label}
          </div>
          {data.config?.subject && (
            <div className="text-[10px] text-muted-foreground truncate mt-0.5">
              {data.config.subject}
            </div>
          )}
          {nodeType === "delay" && data.config?.value && (
            <div className="text-[10px] text-muted-foreground mt-0.5">
              {data.config.value} {data.config.unit === "hours" ? "hora(s)" : "dia(s)"}
            </div>
          )}
        </div>
      </div>

      {isCondition ? (
        <>
          <Handle
            type="source"
            position={Position.Bottom}
            id="yes"
            className="!w-3 !h-3 !bg-green-500 !border-2 !border-background !left-[30%]"
          />
          <Handle
            type="source"
            position={Position.Bottom}
            id="no"
            className="!w-3 !h-3 !bg-red-500 !border-2 !border-background !left-[70%]"
          />
        </>
      ) : nodeType !== "end" ? (
        <Handle
          type="source"
          position={Position.Bottom}
          id="default"
          className="!w-3 !h-3 !bg-foreground/50 !border-2 !border-background"
        />
      ) : null}
    </div>
  );
}

export default memo(AutomationNodeComponent);
