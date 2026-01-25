// =============================================
// PLATFORM ALERTS COMPONENT
// Shows color-coded platform announcements in the header
// =============================================

import { AlertCircle, AlertTriangle, CheckCircle, Info, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { usePlatformAnnouncements, PlatformAnnouncement } from "@/hooks/usePlatformAnnouncements";
import { cn } from "@/lib/utils";

const variantStyles: Record<PlatformAnnouncement['variant'], { bg: string; text: string; icon: typeof Info }> = {
  info: { 
    bg: 'bg-info/10 hover:bg-info/20', 
    text: 'text-info', 
    icon: Info 
  },
  warning: { 
    bg: 'bg-warning/10 hover:bg-warning/20', 
    text: 'text-warning', 
    icon: AlertTriangle 
  },
  error: { 
    bg: 'bg-destructive/10 hover:bg-destructive/20', 
    text: 'text-destructive', 
    icon: AlertCircle 
  },
  success: { 
    bg: 'bg-success/10 hover:bg-success/20', 
    text: 'text-success', 
    icon: CheckCircle 
  },
};

export function PlatformAlerts() {
  const { data: announcements, isLoading } = usePlatformAnnouncements();
  
  if (isLoading || !announcements?.length) {
    return null;
  }
  
  return (
    <div className="flex items-center gap-2">
      {announcements.slice(0, 3).map((announcement) => {
        const style = variantStyles[announcement.variant] || variantStyles.info;
        const Icon = style.icon;
        
        return (
          <Button
            key={announcement.id}
            variant="ghost"
            size="sm"
            className={cn(
              "gap-1.5 h-8 text-xs font-medium transition-colors",
              style.bg,
              style.text
            )}
            onClick={() => {
              if (announcement.link_url) {
                window.open(announcement.link_url, '_blank');
              }
            }}
          >
            <Icon className="h-3.5 w-3.5" />
            <span className="hidden md:inline max-w-32 truncate">{announcement.title}</span>
            {announcement.link_url && (
              <ExternalLink className="h-3 w-3 opacity-70" />
            )}
          </Button>
        );
      })}
    </div>
  );
}
