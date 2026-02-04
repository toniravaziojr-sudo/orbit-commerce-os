/**
 * Gestão de Criativos — Página Principal
 * 
 * Módulo para geração de criativos com IA (vídeos e imagens)
 * 3 abas: Vídeos (unificada), Imagens, Galeria
 * 
 * Stack de Vídeo v2.0:
 * - Runway ML (geração de vídeo)
 * - ElevenLabs (TTS PT-BR)
 * - Sync Labs (lipsync)
 * - Akool (face swap)
 * - HeyGen (avatares)
 */

import { useState } from 'react';
import { PageHeader } from '@/components/ui/page-header';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  Video, 
  Image, 
  FolderOpen,
  Info,
  Loader2,
  LayoutGrid,
} from 'lucide-react';
import { useCreativeStats, useCreativesFolder } from '@/hooks/useCreatives';
import { UnifiedVideoTab } from '@/components/creatives/UnifiedVideoTab';
import { ProductImageTab } from '@/components/creatives/ProductImageTab';
import { CreativeGallery } from '@/components/creatives/CreativeGallery';

type TabId = 'videos' | 'images' | 'gallery';

const TABS: { id: TabId; label: string; icon: React.ElementType; description: string }[] = [
  {
    id: 'videos',
    label: 'Vídeos',
    icon: Video,
    description: 'UGC, vídeos de produto e avatares com IA',
  },
  {
    id: 'images',
    label: 'Imagens',
    icon: Image,
    description: 'Imagens de produto com cenários e pessoas',
  },
  {
    id: 'gallery',
    label: 'Galeria',
    icon: LayoutGrid,
    description: 'Visualizar todos os criativos gerados',
  },
];

export default function Creatives() {
  // Default to videos tab
  const [activeTab, setActiveTab] = useState<TabId>('videos');
  const { data: stats } = useCreativeStats();
  const { isLoading: folderLoading } = useCreativesFolder();

  return (
    <div className="space-y-8 animate-fade-in">
      <PageHeader
        title="Gestão de Criativos"
        description="Crie vídeos e imagens profissionais com IA para suas campanhas"
      />

      {/* Stats Overview */}
      <div className="grid gap-4 md:grid-cols-5">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Gerados</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.total || 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Na Fila</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-amber-600">{stats?.queued || 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Processando</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-primary">{stats?.running || 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Concluídos</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-emerald-600">{stats?.succeeded || 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Custo Total</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {((stats?.totalCost || 0) / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Info Alert */}
      <Alert>
        <Info className="h-4 w-4" />
        <AlertDescription className="flex items-center justify-between">
          <span>
            Todos os criativos gerados são salvos automaticamente na pasta{' '}
            <strong className="inline-flex items-center gap-1">
              <FolderOpen className="h-3 w-3" /> Criativos com IA
            </strong>{' '}
            do seu Meu Drive.
          </span>
          {folderLoading && <Loader2 className="h-4 w-4 animate-spin" />}
        </AlertDescription>
      </Alert>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as TabId)} className="space-y-6">
        <TabsList className="grid w-full grid-cols-3 h-auto">
          {TABS.map((tab) => {
            const Icon = tab.icon;
            const count = tab.id === 'gallery' ? (stats?.succeeded || 0) : 0;
            return (
              <TabsTrigger
                key={tab.id}
                value={tab.id}
                className="flex flex-col items-center gap-1 py-3 px-2 data-[state=active]:bg-primary/10"
              >
                <div className="flex items-center gap-2">
                  <Icon className="h-4 w-4" />
                  <span className="text-sm font-medium">{tab.label}</span>
                </div>
                {count > 0 && (
                  <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                    {count}
                  </Badge>
                )}
              </TabsTrigger>
            );
          })}
        </TabsList>

        {/* Tab Descriptions */}
        <Card className="border-dashed">
          <CardHeader className="py-3">
            <div className="flex items-center gap-3">
              {TABS.find(t => t.id === activeTab)?.icon && (
                <div className="p-2 rounded-lg bg-primary/10">
                  {(() => {
                    const Icon = TABS.find(t => t.id === activeTab)!.icon;
                    return <Icon className="h-5 w-5 text-primary" />;
                  })()}
                </div>
              )}
              <div>
                <CardTitle className="text-base">
                  {TABS.find(t => t.id === activeTab)?.label}
                </CardTitle>
                <CardDescription>
                  {TABS.find(t => t.id === activeTab)?.description}
                </CardDescription>
              </div>
            </div>
          </CardHeader>
        </Card>

        {/* Tab Contents */}
        <TabsContent value="videos" className="mt-6">
          <UnifiedVideoTab />
        </TabsContent>

        <TabsContent value="images" className="mt-6">
          <ProductImageTab />
        </TabsContent>

        <TabsContent value="gallery" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Galeria de Criativos</CardTitle>
              <CardDescription>
                Todos os criativos gerados em formato visual. Use os filtros para encontrar rapidamente.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <CreativeGallery showFilters />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
