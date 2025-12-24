import { Mail, MessageSquare } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import type { NotificationChannel } from "@/hooks/useNotificationRulesV2";

interface ChannelSelectorProps {
  value: NotificationChannel[];
  onChange: (channels: NotificationChannel[]) => void;
}

const channels: { value: NotificationChannel; label: string; icon: typeof Mail }[] = [
  { value: 'whatsapp', label: 'WhatsApp', icon: MessageSquare },
  { value: 'email', label: 'E-mail', icon: Mail },
];

export function ChannelSelector({ value, onChange }: ChannelSelectorProps) {
  const handleToggle = (channel: NotificationChannel) => {
    if (value.includes(channel)) {
      // Don't allow removing the last channel
      if (value.length === 1) return;
      onChange(value.filter(c => c !== channel));
    } else {
      onChange([...value, channel]);
    }
  };

  return (
    <div className="space-y-2">
      <Label>Canais Ativos *</Label>
      <div className="flex gap-4">
        {channels.map((channel) => {
          const Icon = channel.icon;
          const isSelected = value.includes(channel.value);
          
          return (
            <label
              key={channel.value}
              className={cn(
                "flex items-center gap-2 p-3 rounded-lg border cursor-pointer transition-all",
                isSelected 
                  ? "border-primary bg-primary/5" 
                  : "border-border hover:border-primary/50"
              )}
            >
              <Checkbox 
                checked={isSelected}
                onCheckedChange={() => handleToggle(channel.value)}
              />
              <Icon className={cn(
                "h-4 w-4",
                isSelected ? "text-primary" : "text-muted-foreground"
              )} />
              <span className={cn(
                "text-sm font-medium",
                isSelected ? "text-primary" : "text-foreground"
              )}>
                {channel.label}
              </span>
            </label>
          );
        })}
      </div>
    </div>
  );
}
