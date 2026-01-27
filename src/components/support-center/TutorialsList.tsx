// =============================================
// TUTORIALS LIST COMPONENT
// Lists all available module tutorials
// =============================================

import { PlayCircle, ExternalLink } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { ModuleTutorial } from "@/hooks/useModuleTutorials";

// Module labels for display
const moduleLabels: Record<string, string> = {
  'command-center': 'Central de Execuções',
  'orders': 'Pedidos',
  'abandoned-checkouts': 'Checkouts Abandonados',
  'products': 'Produtos',
  'customers': 'Clientes',
  'storefront': 'Loja Online',
  'categories': 'Categorias',
  'menus': 'Menus',
  'pages': 'Páginas',
  'blog': 'Blog',
  'marketing': 'Marketing',
  'email-marketing': 'Email Marketing',
  'quizzes': 'Quizzes',
  'discounts': 'Descontos',
  'offers': 'Ofertas',
  'reviews': 'Avaliações',
  'media': 'Mídias',
  'campaigns': 'Campanhas',
  'notifications': 'Notificações',
  'support': 'Suporte',
  'emails': 'Emails do Sistema',
  'fiscal': 'Fiscal',
  'finance': 'Financeiro',
  'purchases': 'Compras',
  'shipping': 'Frete e Envio',
  'influencers': 'Influencers',
  'affiliates': 'Afiliados',
  'integrations': 'Integrações',
  'import': 'Importação',
  'users': 'Usuários',
  'files': 'Arquivos',
  'reports': 'Relatórios',
  'support-center': 'Central de Suporte',
};

export function TutorialsList() {
  const [selectedTutorial, setSelectedTutorial] = useState<ModuleTutorial | null>(null);
  
  const { data: tutorials, isLoading } = useQuery({
    queryKey: ['all-tutorials'],
    queryFn: async (): Promise<ModuleTutorial[]> => {
      const { data, error } = await supabase
        .from('module_tutorials')
        .select('*')
        .eq('is_active', true)
        .order('module_key');
      
      if (error) {
        console.error('Error fetching tutorials:', error);
        return [];
      }
      
      return data as ModuleTutorial[];
    },
  });
  
  // Extract video ID for embed (supports YouTube, Vimeo, Loom)
  const getEmbedUrl = (url: string): string => {
    const youtubeMatch = url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/)|youtu\.be\/)([^&?/]+)/);
    if (youtubeMatch) {
      return `https://www.youtube.com/embed/${youtubeMatch[1]}?autoplay=1`;
    }
    
    const vimeoMatch = url.match(/vimeo\.com\/(?:video\/)?(\d+)/);
    if (vimeoMatch) {
      return `https://player.vimeo.com/video/${vimeoMatch[1]}?autoplay=1`;
    }
    
    const loomMatch = url.match(/loom\.com\/share\/([^?]+)/);
    if (loomMatch) {
      return `https://www.loom.com/embed/${loomMatch[1]}?autoplay=1`;
    }
    
    return url;
  };
  
  if (isLoading) {
    return (
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <Card key={i}>
            <CardContent className="p-4">
              <Skeleton className="h-32 w-full mb-3" />
              <Skeleton className="h-5 w-3/4 mb-2" />
              <Skeleton className="h-4 w-full" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }
  
  if (!tutorials || tutorials.length === 0) {
    return (
      <div className="text-center py-12">
        <PlayCircle className="mx-auto h-12 w-12 text-muted-foreground/50 mb-4" />
        <h3 className="text-lg font-medium mb-2">Nenhum tutorial disponível</h3>
        <p className="text-sm text-muted-foreground">
          Os tutoriais serão adicionados em breve. Fique atento!
        </p>
      </div>
    );
  }
  
  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {tutorials.map((tutorial) => (
          <Card 
            key={tutorial.id}
            className="cursor-pointer transition-all hover:shadow-md hover:border-primary/50 group"
            onClick={() => setSelectedTutorial(tutorial)}
          >
            <CardContent className="p-4">
              {/* Thumbnail */}
              <div className="relative aspect-video bg-muted rounded-md mb-3 overflow-hidden">
                {tutorial.thumbnail_url ? (
                  <img 
                    src={tutorial.thumbnail_url} 
                    alt={tutorial.title}
                    className="object-cover w-full h-full"
                  />
                ) : (
                  <div className="flex items-center justify-center h-full bg-gradient-to-br from-primary/20 to-primary/5">
                    <PlayCircle className="h-12 w-12 text-primary/50" />
                  </div>
                )}
                {/* Play overlay */}
                <div className="absolute inset-0 flex items-center justify-center bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity">
                  <div className="h-12 w-12 rounded-full bg-white/90 flex items-center justify-center">
                    <PlayCircle className="h-6 w-6 text-primary" />
                  </div>
                </div>
              </div>
              
              {/* Info */}
              <div className="space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <h4 className="font-medium text-sm line-clamp-2">{tutorial.title}</h4>
                  <Badge variant="secondary" className="shrink-0 text-xs">
                    {moduleLabels[tutorial.module_key] || tutorial.module_key}
                  </Badge>
                </div>
                {tutorial.description && (
                  <p className="text-xs text-muted-foreground line-clamp-2">
                    {tutorial.description}
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
      
      {/* Video Dialog */}
      <Dialog open={!!selectedTutorial} onOpenChange={() => setSelectedTutorial(null)}>
        <DialogContent className="max-w-4xl p-0 overflow-hidden">
          {selectedTutorial && (
            <>
              <DialogHeader className="p-4 pb-0">
                <div className="flex items-center gap-2">
                  <DialogTitle className="text-lg">{selectedTutorial.title}</DialogTitle>
                  <Badge variant="secondary" className="text-xs">
                    {moduleLabels[selectedTutorial.module_key] || selectedTutorial.module_key}
                  </Badge>
                </div>
                {selectedTutorial.description && (
                  <DialogDescription>{selectedTutorial.description}</DialogDescription>
                )}
              </DialogHeader>
              <div className="relative w-full aspect-video bg-black">
                <iframe
                  src={getEmbedUrl(selectedTutorial.video_url)}
                  className="absolute inset-0 w-full h-full"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                />
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
