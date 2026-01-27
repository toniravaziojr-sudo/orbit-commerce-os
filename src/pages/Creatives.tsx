/**
 * Gestão de Criativos — Página Principal
 * 
 * Módulo para geração de criativos com IA (vídeos e imagens)
 * 5 abas: UGC Cliente, UGC 100% IA, Vídeos Curtos, Vídeos Tech, Imagens Produto
 */

import { useState } from 'react';
import { PageHeader } from '@/components/ui/page-header';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  Video, 
  Image, 
  Sparkles, 
  Bot, 
  Mic, 
  Cpu, 
  User,
  FolderOpen,
  Info,
  Loader2,
} from 'lucide-react';
import { useCreativeStats, useCreativesFolder } from '@/hooks/useCreatives';
import { UGCClientTab } from '@/components/creatives/UGCClientTab';
import { UGCAITab } from '@/components/creatives/UGCAITab';
import { ShortVideoTab } from '@/components/creatives/ShortVideoTab';
import { TechProductTab } from '@/components/creatives/TechProductTab';
import { ProductImageTab } from '@/components/creatives/ProductImageTab';
import type { CreativeType } from '@/types/creatives';

const TABS: { id: CreativeType; label: string; icon: React.ElementType; description: string }[] = [
  {
    id: 'ugc_client_video',
    label: 'UGC: Cliente Gravou',
    icon: User,
    description: 'Transformar pessoa/rosto, fundo e voz de vídeo existente',
  },
  {
    id: 'ugc_ai_video',
    label: 'UGC 100% IA',
    icon: Bot,
    description: 'Avatar/ator IA falando como se fosse uma pessoa real',
  },
  {
    id: 'short_video',
    label: 'Vídeos Curtos',
    icon: Mic,
    description: 'Pessoa falando sobre um assunto (review, explicativo)',
  },
  {
    id: 'tech_product_video',
    label: 'Vídeos Tech',
    icon: Cpu,
    description: 'Vídeos cinematográficos de produtos (sem pessoas)',
  },
  {
    id: 'product_image',
    label: 'Imagens Produto',
    icon: Image,
    description: 'Pessoas reais segurando o produto',
  },
];

export default function Creatives() {
  const [activeTab, setActiveTab] = useState<CreativeType>('ugc_client_video');
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
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as CreativeType)} className="space-y-6">
        <TabsList className="grid w-full grid-cols-5 h-auto">
          {TABS.map((tab) => {
            const Icon = tab.icon;
            const count = stats?.byType?.[tab.id] || 0;
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

        <TabsContent value="short_video" className="mt-6">
          <ShortVideoTab />
        </TabsContent>

        <TabsContent value="tech_product_video" className="mt-6">
          <TechProductTab />
        </TabsContent>

        <TabsContent value="product_image" className="mt-6">
          <ProductImageTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
