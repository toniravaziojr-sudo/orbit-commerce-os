import { Clock, RefreshCw, Send, CheckCircle, XCircle, Ban } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import type { NotificationsStats } from "@/hooks/useNotifications";

interface NotificationsStatsCardsProps {
  stats: NotificationsStats;
}

const statusConfig = [
  { key: 'scheduled', label: 'Agendadas', icon: Clock, color: 'text-blue-500' },
  { key: 'retrying', label: 'Retrying', icon: RefreshCw, color: 'text-warning' },
  { key: 'sending', label: 'Enviando', icon: Send, color: 'text-info' },
  { key: 'sent', label: 'Enviadas', icon: CheckCircle, color: 'text-success' },
  { key: 'failed', label: 'Falhas', icon: XCircle, color: 'text-destructive' },
  { key: 'canceled', label: 'Canceladas', icon: Ban, color: 'text-muted-foreground' },
] as const;

export function NotificationsStatsCards({ stats }: NotificationsStatsCardsProps) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
      {statusConfig.map(({ key, label, icon: Icon, color }) => (
        <Card key={key}>
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-3">
              <Icon className={`h-5 w-5 ${color}`} />
              <div>
                <p className="text-2xl font-bold">{stats[key]}</p>
                <p className="text-xs text-muted-foreground">{label}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
