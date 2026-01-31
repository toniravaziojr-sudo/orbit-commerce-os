/**
 * Gestão de Criativos — Página Principal
 * 
 * Módulo para geração de criativos com IA (vídeos e imagens)
 * 5 abas: UGC Real, UGC 100% IA, Vídeos de Produto, Imagens Produto, Avatar Mascote, Galeria
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
  Bot, 
  User,
  FolderOpen,
  Info,
  Loader2,
  LayoutGrid,
  Wand2,
  Package,
} from 'lucide-react';
import { useCreativeStats, useCreativesFolder } from '@/hooks/useCreatives';
import { UGCClientTab } from '@/components/creatives/UGCClientTab';
import { UGCAITab } from '@/components/creatives/UGCAITab';
import { ProductVideoTab } from '@/components/creatives/ProductVideoTab';
import { ProductImageTab } from '@/components/creatives/ProductImageTab';
import { AvatarMascotTab } from '@/components/creatives/AvatarMascotTab';
import { CreativeGallery } from '@/components/creatives/CreativeGallery';
import type { CreativeType } from '@/types/creatives';

type TabId = CreativeType | 'gallery';

const TABS: { id: TabId; label: string; icon: React.ElementType; description: string }[] = [
  {
    id: 'ugc_client_video',
    label: 'UGC Real',
    icon: User,
    description: 'Transformar vídeo gravado (rosto, fundo, voz opcionais)',
  },
  {
    id: 'ugc_ai_video',
    label: 'UGC 100% IA',
    icon: Bot,
    description: 'Avatar IA com produto do catálogo',
  },
  {
    id: 'product_video',
    label: 'Vídeos Produto',
    icon: Package,
    description: 'Vídeos SEM pessoas (rotação, efeitos, close-ups)',
  },
  {
    id: 'product_image',
    label: 'Imagens',
    icon: Image,
    description: 'Pessoas + cenário + produto do catálogo',
  },
  {
    id: 'avatar_mascot',
    label: 'Mascote',
    icon: Wand2,
    description: 'Mascote animado falando (tipo Lu Magalu)',
  },
  {
    id: 'gallery',
    label: 'Galeria',
    icon: LayoutGrid,
    description: 'Visualizar todos os criativos gerados',
  },
];

export default function Creatives() {
  const [activeTab, setActiveTab] = useState<TabId>('ugc_client_video');
  const { data: stats, isLoading: statsLoading } = useCreativeStats();
  const { data: folderId, isLoading: folderLoading } = useCreativesFolder();

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
            <div className="text-2xl font-bold text-yellow-600">{stats?.queued || 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Processando</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">{stats?.running || 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Concluídos</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{stats?.succeeded || 0}</div>
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
        <TabsList className="grid w-full grid-cols-6 h-auto">
          {TABS.map((tab) => {
            const Icon = tab.icon;
            const count = tab.id === 'gallery' 
              ? (stats?.succeeded || 0) 
              : (stats?.byType?.[tab.id as CreativeType] || 0);
            return (
              <TabsTrigger
                key={tab.id}
                value={tab.id}
                className="flex flex-col items-center gap-1 py-3 px-2 data-[state=active]:bg-primary/10"
              >
                <div className="flex items-center gap-2">
                  <Icon className="h-4 w-4" />
                  <span className="text-xs font-medium hidden lg:inline">{tab.label}</span>
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
        <TabsContent value="ugc_client_video" className="mt-6">
          <UGCClientTab />
        </TabsContent>

        <TabsContent value="ugc_ai_video" className="mt-6">
          <UGCAITab />
        </TabsContent>

        <TabsContent value="product_video" className="mt-6">
          <ProductVideoTab />
        </TabsContent>

        <TabsContent value="product_image" className="mt-6">
          <ProductImageTab />
        </TabsContent>

        <TabsContent value="avatar_mascot" className="mt-6">
          <AvatarMascotTab />
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
