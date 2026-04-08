import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Video, BarChart3, User, CalendarClock } from 'lucide-react';
import { TikTokContentVideosTab } from './TikTokContentVideosTab';
import { TikTokContentAnalyticsTab } from './TikTokContentAnalyticsTab';
import { TikTokContentProfileTab } from './TikTokContentProfileTab';
import { TikTokContentScheduleTab } from './TikTokContentScheduleTab';

export function TikTokContentPanel() {
  return (
    <div className="space-y-4">
      <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
        Gestão de Conteúdo
      </h3>
      <Tabs defaultValue="profile" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="profile" className="gap-1 text-[10px]">
            <User className="h-3 w-3" />
            Perfil
          </TabsTrigger>
          <TabsTrigger value="videos" className="gap-1 text-[10px]">
            <Video className="h-3 w-3" />
            Vídeos
          </TabsTrigger>
          <TabsTrigger value="schedule" className="gap-1 text-[10px]">
            <CalendarClock className="h-3 w-3" />
            Agendar
          </TabsTrigger>
          <TabsTrigger value="analytics" className="gap-1 text-[10px]">
            <BarChart3 className="h-3 w-3" />
            Analytics
          </TabsTrigger>
        </TabsList>
        <TabsContent value="profile" className="mt-4">
          <TikTokContentProfileTab />
        </TabsContent>
        <TabsContent value="videos" className="mt-4">
          <TikTokContentVideosTab />
        </TabsContent>
        <TabsContent value="schedule" className="mt-4">
          <TikTokContentScheduleTab />
        </TabsContent>
        <TabsContent value="analytics" className="mt-4">
          <TikTokContentAnalyticsTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
