// =============================================
// BLOCK SUGGESTIONS PAGE - Platform Admin
// Manage block implementation requests
// =============================================

import React, { useState } from 'react';
import { useConfirmDialog } from '@/hooks/useConfirmDialog';
import { Navigate } from 'react-router-dom';
import { useBlockSuggestions, BlockRequestStatus, BlockImplementationRequest } from '@/hooks/useBlockSuggestions';
import { usePlatformOperator } from '@/hooks/usePlatformOperator';
import { blockRegistry } from '@/lib/builder/registry';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  Sparkles, 
  Clock, 
  CheckCircle, 
  XCircle, 
  Link as LinkIcon,
  Code,
  Copy,
  ExternalLink,
  Loader2,
  Eye,
} from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from 'sonner';

const statusConfig: Record<BlockRequestStatus, { label: string; color: string; icon: React.ReactNode }> = {
  pending: { label: 'Pendente', color: 'bg-amber-500', icon: <Clock className="w-3 h-3" /> },
  in_progress: { label: 'Em Progresso', color: 'bg-blue-500', icon: <Loader2 className="w-3 h-3 animate-spin" /> },
  implemented: { label: 'Implementado', color: 'bg-green-500', icon: <CheckCircle className="w-3 h-3" /> },
  rejected: { label: 'Rejeitado', color: 'bg-red-500', icon: <XCircle className="w-3 h-3" /> },
  mapped: { label: 'Mapeado', color: 'bg-purple-500', icon: <LinkIcon className="w-3 h-3" /> },
};

export default function BlockSuggestions() {
  const { isPlatformOperator, isLoading: authLoading } = usePlatformOperator();
  
  const { 
    requests, 
    isLoading, 
    counts, 
    markImplemented, 
    mapToExisting, 
    rejectRequest,
    updateStatus,
  } = useBlockSuggestions();
  
  const [activeTab, setActiveTab] = useState<BlockRequestStatus | 'all'>('pending');
  const [selectedRequest, setSelectedRequest] = useState<BlockImplementationRequest | null>(null);
  const [showDetailDialog, setShowDetailDialog] = useState(false);
  const [showImplementDialog, setShowImplementDialog] = useState(false);
  const [showMapDialog, setShowMapDialog] = useState(false);
  
  // Form state for implement dialog
  const [implementedAs, setImplementedAs] = useState('');
  const [implementNotes, setImplementNotes] = useState('');
  
  // Form state for map dialog
  const [mapToBlock, setMapToBlock] = useState('');
  const [mapNotes, setMapNotes] = useState('');

  // Block access for non-platform operators
  if (authLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!isPlatformOperator) {
    return <Navigate to="/" replace />;
  }

  // Get existing block types for mapping
  const existingBlockTypes = blockRegistry.getAll().map(b => ({ type: b.type, label: b.label }));

  // Filter requests by tab
  const filteredRequests = requests?.filter(r => {
    if (activeTab === 'all') return true;
    return r.status === activeTab;
  }) || [];

  const handleCopyHtml = (html: string) => {
    navigator.clipboard.writeText(html);
    toast.success('HTML copiado!');
  };

  const handleCopyCss = (css: string) => {
    navigator.clipboard.writeText(css || '');
    toast.success('CSS copiado!');
  };

  const handleImplement = () => {
    if (!selectedRequest || !implementedAs.trim()) return;
    
    markImplemented.mutate({
      requestId: selectedRequest.id,
      implementedAs: implementedAs.trim(),
      notes: implementNotes.trim() || undefined,
    }, {
      onSuccess: () => {
        setShowImplementDialog(false);
        setImplementedAs('');
        setImplementNotes('');
        setSelectedRequest(null);
      },
    });
  };

  const handleMap = () => {
    if (!selectedRequest || !mapToBlock) return;
    
    mapToExisting.mutate({
      requestId: selectedRequest.id,
      existingBlockType: mapToBlock,
      notes: mapNotes.trim() || undefined,
    }, {
      onSuccess: () => {
        setShowMapDialog(false);
        setMapToBlock('');
        setMapNotes('');
        setSelectedRequest(null);
      },
    });
  };

  const { confirm: confirmAction, ConfirmDialog: BlockConfirmDialog } = useConfirmDialog();

  const handleReject = async (request: BlockImplementationRequest) => {
    const ok = await confirmAction({
      title: "Rejeitar sugestão",
      description: "Tem certeza que deseja rejeitar esta sugestão?",
      confirmLabel: "Rejeitar",
      variant: "destructive",
    });
    if (!ok) return;
    
    rejectRequest.mutate({
      requestId: request.id,
      notes: 'Rejeitado pelo admin',
    });
  };

  const handleStartProgress = (request: BlockImplementationRequest) => {
    updateStatus.mutate({
      requestId: request.id,
      status: 'in_progress',
    });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Sparkles className="w-8 h-8 text-primary" />
            Sugestões de Blocos
          </h1>
          <p className="text-muted-foreground mt-1">
            Padrões detectados durante importações que podem virar blocos oficiais
          </p>
        </div>
        
        <Badge variant="secondary" className="text-lg px-4 py-2">
          {counts.pending} pendente{counts.pending !== 1 ? 's' : ''}
        </Badge>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)}>
        <TabsList>
          <TabsTrigger value="pending" className="gap-1">
            <Clock className="w-4 h-4" />
            Pendentes ({counts.pending})
          </TabsTrigger>
          <TabsTrigger value="in_progress" className="gap-1">
            <Loader2 className="w-4 h-4" />
            Em Progresso ({counts.in_progress})
          </TabsTrigger>
          <TabsTrigger value="implemented" className="gap-1">
            <CheckCircle className="w-4 h-4" />
            Implementados ({counts.implemented})
          </TabsTrigger>
          <TabsTrigger value="mapped" className="gap-1">
            <LinkIcon className="w-4 h-4" />
            Mapeados ({counts.mapped})
          </TabsTrigger>
          <TabsTrigger value="rejected" className="gap-1">
            <XCircle className="w-4 h-4" />
            Rejeitados ({counts.rejected})
          </TabsTrigger>
          <TabsTrigger value="all">
            Todos ({counts.total})
          </TabsTrigger>
        </TabsList>

        <TabsContent value={activeTab} className="mt-6">
          {filteredRequests.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center text-muted-foreground">
                Nenhuma sugestão {activeTab !== 'all' ? `com status "${statusConfig[activeTab as BlockRequestStatus]?.label}"` : ''}.
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {filteredRequests.map(request => (
                <RequestCard
                  key={request.id}
                  request={request}
                  onViewDetails={() => {
                    setSelectedRequest(request);
                    setShowDetailDialog(true);
                  }}
                  onImplement={() => {
                    setSelectedRequest(request);
                    setShowImplementDialog(true);
                  }}
                  onMap={() => {
                    setSelectedRequest(request);
                    setShowMapDialog(true);
                  }}
                  onReject={() => handleReject(request)}
                  onStartProgress={() => handleStartProgress(request)}
                />
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Detail Dialog */}
      <Dialog open={showDetailDialog} onOpenChange={setShowDetailDialog}>
        <DialogContent className="max-w-4xl max-h-[90vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Code className="w-5 h-5" />
              {selectedRequest?.pattern_name}
            </DialogTitle>
            <DialogDescription>
              Detectado em {selectedRequest?.source_platform || 'plataforma desconhecida'}
            </DialogDescription>
          </DialogHeader>
          
          <ScrollArea className="max-h-[60vh]">
            <div className="space-y-4">
              {/* Preview */}
              <div>
                <Label className="text-sm font-medium mb-2 block">Preview Visual</Label>
                <div className="border rounded-lg p-4 bg-white">
                  <div 
                    dangerouslySetInnerHTML={{ __html: selectedRequest?.html_sample || '' }}
                    className="max-h-64 overflow-auto"
                  />
                </div>
              </div>

              {/* HTML */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <Label className="text-sm font-medium">HTML</Label>
                  <Button 
                    variant="ghost" 
                    size="sm"
                    onClick={() => handleCopyHtml(selectedRequest?.html_sample || '')}
                  >
                    <Copy className="w-4 h-4 mr-1" />
                    Copiar
                  </Button>
                </div>
                <pre className="text-xs bg-muted p-3 rounded overflow-auto max-h-48">
                  {selectedRequest?.html_sample}
                </pre>
              </div>

              {/* CSS */}
              {selectedRequest?.css_sample && (
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <Label className="text-sm font-medium">CSS</Label>
                    <Button 
                      variant="ghost" 
                      size="sm"
                      onClick={() => handleCopyCss(selectedRequest?.css_sample || '')}
                    >
                      <Copy className="w-4 h-4 mr-1" />
                      Copiar
                    </Button>
                  </div>
                  <pre className="text-xs bg-muted p-3 rounded overflow-auto max-h-48">
                    {selectedRequest?.css_sample}
                  </pre>
                </div>
              )}

              {/* Metadata */}
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <Label className="text-muted-foreground">Tenant</Label>
                  <p>{selectedRequest?.tenant?.name || '-'}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Ocorrências</Label>
                  <p>{selectedRequest?.occurrences_count}x detectado</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Plataforma</Label>
                  <p>{selectedRequest?.source_platform || '-'}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Data</Label>
                  <p>
                    {selectedRequest?.created_at && 
                      format(new Date(selectedRequest.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                  </p>
                </div>
              </div>

              {/* Source URL */}
              {selectedRequest?.source_url && (
                <div>
                  <Label className="text-muted-foreground">URL de Origem</Label>
                  <a 
                    href={selectedRequest.source_url} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-primary hover:underline flex items-center gap-1"
                  >
                    {selectedRequest.source_url}
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              )}
            </div>
          </ScrollArea>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDetailDialog(false)}>
              Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Implement Dialog */}
      <Dialog open={showImplementDialog} onOpenChange={setShowImplementDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Marcar como Implementado</DialogTitle>
            <DialogDescription>
              Informe o tipo do bloco oficial que foi criado para este padrão.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div>
              <Label htmlFor="implementedAs">Tipo do Bloco Criado</Label>
              <Input
                id="implementedAs"
                placeholder="Ex: HeroWithVideo, FAQAccordion"
                value={implementedAs}
                onChange={(e) => setImplementedAs(e.target.value)}
              />
              <p className="text-xs text-muted-foreground mt-1">
                Use PascalCase, ex: HeroWithVideo
              </p>
            </div>
            
            <div>
              <Label htmlFor="implementNotes">Notas (opcional)</Label>
              <Textarea
                id="implementNotes"
                placeholder="Observações sobre a implementação..."
                value={implementNotes}
                onChange={(e) => setImplementNotes(e.target.value)}
                rows={3}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowImplementDialog(false)}>
              Cancelar
            </Button>
            <Button 
              onClick={handleImplement}
              disabled={!implementedAs.trim() || markImplemented.isPending}
            >
              {markImplemented.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Confirmar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Map Dialog */}
      <Dialog open={showMapDialog} onOpenChange={setShowMapDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Mapear para Bloco Existente</DialogTitle>
            <DialogDescription>
              Associe este padrão a um bloco oficial já existente.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div>
              <Label htmlFor="mapToBlock">Bloco Existente</Label>
              <Select value={mapToBlock} onValueChange={setMapToBlock}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione um bloco..." />
                </SelectTrigger>
                <SelectContent>
                  {existingBlockTypes.map(block => (
                    <SelectItem key={block.type} value={block.type}>
                      {block.label} ({block.type})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div>
              <Label htmlFor="mapNotes">Notas (opcional)</Label>
              <Textarea
                id="mapNotes"
                placeholder="Por que este padrão corresponde ao bloco selecionado..."
                value={mapNotes}
                onChange={(e) => setMapNotes(e.target.value)}
                rows={3}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowMapDialog(false)}>
              Cancelar
            </Button>
            <Button 
              onClick={handleMap}
              disabled={!mapToBlock || mapToExisting.isPending}
            >
              {mapToExisting.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Confirmar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {BlockConfirmDialog}
    </div>
  );
}

// Request Card Component
function RequestCard({
  request,
  onViewDetails,
  onImplement,
  onMap,
  onReject,
  onStartProgress,
}: {
  request: BlockImplementationRequest;
  onViewDetails: () => void;
  onImplement: () => void;
  onMap: () => void;
  onReject: () => void;
  onStartProgress: () => void;
}) {
  const statusInfo = statusConfig[request.status];

  return (
    <Card className="overflow-hidden">
      {/* Preview thumbnail */}
      <div className="h-32 bg-muted border-b overflow-hidden">
        <div 
          dangerouslySetInnerHTML={{ __html: request.html_sample }}
          className="transform scale-50 origin-top-left w-[200%] h-[200%] pointer-events-none"
        />
      </div>

      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-2">
          <CardTitle className="text-base line-clamp-1">
            {request.pattern_name}
          </CardTitle>
          <Badge className={`${statusInfo.color} text-white gap-1`}>
            {statusInfo.icon}
            {statusInfo.label}
          </Badge>
        </div>
        <CardDescription className="line-clamp-1">
          {request.tenant?.name || 'Tenant'} · {request.source_platform || 'Importação'}
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-3">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span>{request.occurrences_count}x detectado</span>
          <span>·</span>
          <span>
            {format(new Date(request.created_at), "dd/MM/yy", { locale: ptBR })}
          </span>
        </div>

        <div className="flex gap-2">
          <Button variant="outline" size="sm" className="flex-1" onClick={onViewDetails}>
            <Eye className="w-4 h-4 mr-1" />
            Detalhes
          </Button>
          
          {request.status === 'pending' && (
            <Button variant="outline" size="sm" onClick={onStartProgress}>
              Iniciar
            </Button>
          )}
        </div>

        {(request.status === 'pending' || request.status === 'in_progress') && (
          <div className="flex gap-2">
            <Button size="sm" className="flex-1" onClick={onImplement}>
              Implementar
            </Button>
            <Button variant="secondary" size="sm" onClick={onMap}>
              Mapear
            </Button>
            <Button variant="ghost" size="sm" onClick={onReject}>
              <XCircle className="w-4 h-4" />
            </Button>
          </div>
        )}

        {request.status === 'implemented' && request.implemented_as && (
          <div className="text-xs text-muted-foreground">
            Implementado como: <code className="bg-muted px-1 rounded">{request.implemented_as}</code>
          </div>
        )}

        {request.status === 'mapped' && request.mapped_to_block && (
          <div className="text-xs text-muted-foreground">
            Mapeado para: <code className="bg-muted px-1 rounded">{request.mapped_to_block}</code>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
