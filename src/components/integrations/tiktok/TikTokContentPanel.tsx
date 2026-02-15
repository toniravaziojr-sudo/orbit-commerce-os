import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { TikTokContentVideosTab } from './TikTokContentVideosTab';
import { TikTokContentAnalyticsTab } from './TikTokContentAnalyticsTab';

export function TikTokContentPanel() {
  return (
    <div className="space-y-4">
      <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
        Gestão de Conteúdo
      </h3>
      <Tabs defaultValue="videos" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="videos">Vídeos</TabsTrigger>
          <TabsTrigger value="analytics">Analytics</TabsTrigger>
        </TabsList>
        <TabsContent value="videos" className="mt-4">
          <TikTokContentVideosTab />
        </TabsContent>
        <TabsContent value="analytics" className="mt-4">
          <TikTokContentAnalyticsTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
