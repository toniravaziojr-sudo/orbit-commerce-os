// =============================================
// REVIEWS PAGE - Moderate product reviews
// =============================================

import { useState, useEffect, useCallback } from 'react';
import { useConfirmDialog } from '@/hooks/useConfirmDialog';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { PageHeader } from '@/components/ui/page-header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Star, MoreHorizontal, Check, X, Trash2, Search, Loader2, MessageSquare, Plus, Sparkles, Play, Image as ImageIcon, CheckCheck } from 'lucide-react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { AddReviewDialog } from '@/components/reviews/AddReviewDialog';
import { GenerateReviewsDialog } from '@/components/reviews/GenerateReviewsDialog';
import { registerReviewMediaToDrive, ensureReviewFolderAndGetId } from '@/lib/registerReviewMediaToDrive';

interface ProductReview {
  id: string;
  product_id: string;
  customer_name: string;
  customer_email: string | null;
  rating: number;
  title: string | null;
  content: string | null;
  status: 'pending' | 'approved' | 'rejected';
  is_verified_purchase: boolean;
  created_at: string;
  media_urls: string[] | null;
  product?: { id: string; name: string };
}

export default function Reviews() {
  const { currentTenant, user } = useAuth();
  const currentTenantId = currentTenant?.id;
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<string>('pending');
  const [productFilter, setProductFilter] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [lightboxMedia, setLightboxMedia] = useState<string | null>(null);
  const { confirm: confirmAction, ConfirmDialog: ReviewConfirmDialog } = useConfirmDialog();

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Clear selection when tab/filter changes
  useEffect(() => {
    setSelectedIds(new Set());
  }, [activeTab, productFilter, searchTerm]);

  const toggleSelect = useCallback((id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  

  const isVideo = (url: string) => {
    return url.match(/\.(mp4|webm|ogg|mov)$/i);
  };

  // Ensure "Review clientes" folder exists on page load
  useEffect(() => {
    if (currentTenantId && user?.id) {
      ensureReviewFolderAndGetId(currentTenantId, user.id).catch(console.error);
    }
  }, [currentTenantId, user?.id]);

  // Fetch products for filter
  const { data: products = [] } = useQuery({
    queryKey: ['products-for-reviews', currentTenantId],
    queryFn: async () => {
      if (!currentTenantId) return [];
      const { data, error } = await supabase
        .from('products')
        .select('id, name')
        .eq('tenant_id', currentTenantId)
        .order('name');
      if (error) throw error;
      return data || [];
    },
    enabled: !!currentTenantId,
  });

  // Fetch reviews
  const { data: reviews = [], isLoading } = useQuery({
    queryKey: ['product-reviews', currentTenantId, activeTab, productFilter],
    queryFn: async () => {
      if (!currentTenantId) return [];
      
      let query = supabase
        .from('product_reviews')
        .select(`
          *,
          product:product_id(id, name)
        `)
        .eq('tenant_id', currentTenantId)
        .order('created_at', { ascending: false });

      if (activeTab !== 'all') {
        query = query.eq('status', activeTab);
      }
      if (productFilter !== 'all') {
        query = query.eq('product_id', productFilter);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as ProductReview[];
    },
    enabled: !!currentTenantId,
  });

  // Update status mutation
  const updateStatusMutation = useMutation({
    mutationFn: async ({ 
      id, 
      status, 
      productId,
      mediaUrls,
      customerName,
    }: { 
      id: string; 
      status: string; 
      productId: string;
      mediaUrls?: string[] | null;
      customerName?: string;
    }) => {
      const updateData: any = { status };
      if (status === 'approved') {
        updateData.approved_at = new Date().toISOString();
        updateData.approved_by = user?.id;
      }
      
      const { error } = await supabase
        .from('product_reviews')
        .update(updateData)
        .eq('id', id);
      if (error) throw error;
      
      // If approving and has media, register to Drive
      if (status === 'approved' && mediaUrls && mediaUrls.length > 0 && currentTenantId && user?.id) {
        await registerReviewMediaToDrive(
          currentTenantId,
          user.id,
          mediaUrls,
          id,
          customerName || 'Cliente'
        );
      }
      
      return { productId };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['product-reviews'] });
      // Also invalidate product ratings to update stars on product pages
      queryClient.invalidateQueries({ queryKey: ['product-rating', data.productId] });
      queryClient.invalidateQueries({ queryKey: ['product-ratings-batch'] });
      queryClient.invalidateQueries({ queryKey: ['product-reviews-public', data.productId] });
      queryClient.invalidateQueries({ queryKey: ['files'] }); // Refresh Drive files
      toast.success('Status atualizado');
    },
    onError: () => {
      toast.error('Erro ao atualizar status');
    },
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('product_reviews')
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['product-reviews'] });
      toast.success('Avaliação excluída');
    },
    onError: () => {
      toast.error('Erro ao excluir avaliação');
    },
  });

  const filteredReviews = reviews.filter((review) => {
    if (!searchTerm) return true;
    const search = searchTerm.toLowerCase();
    return (
      review.customer_name.toLowerCase().includes(search) ||
      review.title?.toLowerCase().includes(search) ||
      review.content?.toLowerCase().includes(search) ||
      review.product?.name.toLowerCase().includes(search)
    );
  });

  const toggleSelectAll = useCallback(() => {
    if (selectedIds.size === filteredReviews.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredReviews.map(r => r.id)));
    }
  }, [selectedIds.size, filteredReviews]);

  // Bulk status mutation
  const bulkStatusMutation = useMutation({
    mutationFn: async ({ ids, status }: { ids: string[]; status: string }) => {
      const updateData: any = { status };
      if (status === 'approved') {
        updateData.approved_at = new Date().toISOString();
        updateData.approved_by = user?.id;
      }
      const { error } = await supabase
        .from('product_reviews')
        .update(updateData)
        .in('id', ids);
      if (error) throw error;

      // Register media to Drive for approved reviews with media
      if (status === 'approved' && currentTenantId && user?.id) {
        const reviewsWithMedia = reviews.filter(r => ids.includes(r.id) && r.media_urls?.length);
        for (const review of reviewsWithMedia) {
          await registerReviewMediaToDrive(
            currentTenantId,
            user.id,
            review.media_urls!,
            review.id,
            review.customer_name
          ).catch(console.error);
        }
      }
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['product-reviews'] });
      queryClient.invalidateQueries({ queryKey: ['product-ratings-batch'] });
      queryClient.invalidateQueries({ queryKey: ['files'] });
      const count = variables.ids.length;
      setSelectedIds(new Set());
      toast.success(`${count} avaliações atualizadas`);
    },
    onError: () => {
      toast.error('Erro ao atualizar avaliações em massa');
    },
  });

  // Bulk delete mutation
  const bulkDeleteMutation = useMutation({
    mutationFn: async (ids: string[]) => {
      const { error } = await supabase
        .from('product_reviews')
        .delete()
        .in('id', ids);
      if (error) throw error;
      return ids.length;
    },
    onSuccess: (count) => {
      queryClient.invalidateQueries({ queryKey: ['product-reviews'] });
      setSelectedIds(new Set());
      toast.success(`${count} avaliações excluídas`);
    },
    onError: () => {
      toast.error('Erro ao excluir avaliações em massa');
    },
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'approved':
        return <Badge className="bg-green-500">Aprovada</Badge>;
      case 'rejected':
        return <Badge variant="destructive">Rejeitada</Badge>;
      default:
        return <Badge variant="secondary">Pendente</Badge>;
    }
  };

  const renderStars = (rating: number) => {
    return (
      <div className="flex gap-0.5">
        {[1, 2, 3, 4, 5].map((star) => (
          <Star
            key={star}
            className={`h-4 w-4 ${
              star <= rating ? 'fill-yellow-400 text-yellow-400' : 'text-gray-300'
            }`}
          />
        ))}
      </div>
    );
  };

  // Stats
  const stats = {
    total: reviews.length,
    pending: reviews.filter((r) => r.status === 'pending').length,
    approved: reviews.filter((r) => r.status === 'approved').length,
    rejected: reviews.filter((r) => r.status === 'rejected').length,
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        title="Avaliações"
        description="Modere as avaliações de produtos da sua loja"
        actions={
          <div className="flex gap-2">
            <AddReviewDialog />
            <GenerateReviewsDialog />
          </div>
        }
      />

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold">{stats.total}</div>
            <p className="text-sm text-muted-foreground">Total</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-yellow-600">{stats.pending}</div>
            <p className="text-sm text-muted-foreground">Pendentes</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-green-600">{stats.approved}</div>
            <p className="text-sm text-muted-foreground">Aprovadas</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-red-600">{stats.rejected}</div>
            <p className="text-sm text-muted-foreground">Rejeitadas</p>
          </CardContent>
        </Card>
      </div>

      {/* Tabs + Filters */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <div className="flex flex-wrap items-center gap-4 mb-4">
          <TabsList>
            <TabsTrigger value="pending" className="relative">
              Pendentes
              {stats.pending > 0 && (
                <Badge variant="secondary" className="ml-2 h-5 min-w-5 px-1.5">
                  {stats.pending}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="approved">Aprovadas</TabsTrigger>
            <TabsTrigger value="rejected">Rejeitadas</TabsTrigger>
            <TabsTrigger value="all">Todas</TabsTrigger>
          </TabsList>
          
          <div className="flex-1 min-w-[200px]">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por nome, conteúdo..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>
          
          <Select value={productFilter} onValueChange={setProductFilter}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="Produto" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os produtos</SelectItem>
              {products.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

      {/* Bulk Actions Bar */}
      {selectedIds.size > 0 && (
        <div className="flex items-center gap-3 p-3 bg-muted rounded-lg border">
          <span className="text-sm font-medium">
            {selectedIds.size} selecionada{selectedIds.size > 1 ? 's' : ''}
          </span>
          <div className="flex gap-2 ml-auto">
            <Button
              size="sm"
              variant="outline"
              onClick={() => bulkStatusMutation.mutate({ ids: Array.from(selectedIds), status: 'approved' })}
              disabled={bulkStatusMutation.isPending}
            >
              <Check className="h-4 w-4 mr-1 text-green-600" />
              Aprovar
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => bulkStatusMutation.mutate({ ids: Array.from(selectedIds), status: 'rejected' })}
              disabled={bulkStatusMutation.isPending}
            >
              <X className="h-4 w-4 mr-1 text-red-600" />
              Rejeitar
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={async () => {
                const ok = await confirmAction({
                  title: "Excluir avaliações",
                  description: `Excluir ${selectedIds.size} avaliação(ões)? Esta ação não pode ser desfeita.`,
                  confirmLabel: "Excluir",
                  variant: "destructive",
                });
                if (ok) {
                  bulkDeleteMutation.mutate(Array.from(selectedIds));
                }
              }}
              disabled={bulkDeleteMutation.isPending}
              className="text-destructive"
            >
              <Trash2 className="h-4 w-4 mr-1" />
              Excluir
            </Button>
          </div>
        </div>
      )}

      {/* Reviews Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5" />
            Avaliações
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : filteredReviews.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <MessageSquare className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>Nenhuma avaliação encontrada</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10">
                    <Checkbox
                      checked={filteredReviews.length > 0 && selectedIds.size === filteredReviews.length}
                      onCheckedChange={toggleSelectAll}
                    />
                  </TableHead>
                  <TableHead>Produto</TableHead>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Nota</TableHead>
                  <TableHead>Conteúdo</TableHead>
                  <TableHead>Mídia</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Data</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredReviews.map((review) => (
                  <TableRow key={review.id} className={selectedIds.has(review.id) ? 'bg-muted/50' : ''}>
                    <TableCell>
                      <Checkbox
                        checked={selectedIds.has(review.id)}
                        onCheckedChange={() => toggleSelect(review.id)}
                      />
                    </TableCell>
                    <TableCell>
                      <span className="font-medium">{review.product?.name}</span>
                    </TableCell>
                    <TableCell>
                      <div>
                        <p className="font-medium">{review.customer_name}</p>
                        {review.customer_email && (
                          <p className="text-sm text-muted-foreground">{review.customer_email}</p>
                        )}
                        {review.is_verified_purchase && (
                          <Badge variant="outline" className="text-xs mt-1">
                            Compra verificada
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>{renderStars(review.rating)}</TableCell>
                    <TableCell className="max-w-xs">
                      {review.title && (
                        <p className="font-medium text-sm">{review.title}</p>
                      )}
                      {review.content && (
                        <p className="text-sm text-muted-foreground line-clamp-2">
                          {review.content}
                        </p>
                      )}
                    </TableCell>
                    <TableCell>
                      {review.media_urls && review.media_urls.length > 0 ? (
                        <div className="flex gap-1">
                          {review.media_urls.slice(0, 3).map((url, index) => (
                            <button
                              key={index}
                              onClick={() => setLightboxMedia(url)}
                              className="relative w-10 h-10 rounded overflow-hidden border hover:ring-2 hover:ring-primary transition-all"
                            >
                              {isVideo(url) ? (
                                <>
                                  <video src={url} className="w-full h-full object-cover" />
                                  <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                                    <Play className="h-3 w-3 text-white fill-white" />
                                  </div>
                                </>
                              ) : (
                                <img src={url} alt="" className="w-full h-full object-cover" />
                              )}
                            </button>
                          ))}
                          {review.media_urls.length > 3 && (
                            <div className="w-10 h-10 rounded border bg-muted flex items-center justify-center text-xs text-muted-foreground">
                              +{review.media_urls.length - 3}
                            </div>
                          )}
                        </div>
                      ) : (
                        <span className="text-muted-foreground text-sm">-</span>
                      )}
                    </TableCell>
                    <TableCell>{getStatusBadge(review.status)}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {format(new Date(review.created_at), 'dd/MM/yyyy', { locale: ptBR })}
                    </TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          {review.status !== 'approved' && (
                            <DropdownMenuItem
                              onClick={() => updateStatusMutation.mutate({ 
                                id: review.id, 
                                status: 'approved', 
                                productId: review.product_id,
                                mediaUrls: review.media_urls,
                                customerName: review.customer_name,
                              })}
                            >
                              <Check className="h-4 w-4 mr-2 text-green-600" />
                              Aprovar
                            </DropdownMenuItem>
                          )}
                          {review.status !== 'rejected' && (
                            <DropdownMenuItem
                              onClick={() => updateStatusMutation.mutate({ id: review.id, status: 'rejected', productId: review.product_id })}
                            >
                              <X className="h-4 w-4 mr-2 text-red-600" />
                              Rejeitar
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuItem
                            onClick={async () => {
                              const ok = await confirmAction({
                                title: "Excluir avaliação",
                                description: "Tem certeza que deseja excluir esta avaliação? Esta ação não pode ser desfeita.",
                                confirmLabel: "Excluir",
                                variant: "destructive",
                              });
                              if (ok) {
                                deleteMutation.mutate(review.id);
                              }
                            }}
                            className="text-destructive"
                          >
                            <Trash2 className="h-4 w-4 mr-2" />
                            Excluir
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
      </Tabs>

      {/* Media Lightbox */}
      <Dialog open={!!lightboxMedia} onOpenChange={() => setLightboxMedia(null)}>
        <DialogContent className="max-w-3xl p-0 overflow-hidden">
          <button
            onClick={() => setLightboxMedia(null)}
            className="absolute top-2 right-2 z-10 p-2 rounded-full bg-black/50 text-white hover:bg-black/70 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
          {lightboxMedia && (
            isVideo(lightboxMedia) ? (
              <video 
                src={lightboxMedia} 
                controls 
                autoPlay 
                className="w-full max-h-[80vh] object-contain"
              />
            ) : (
              <img 
                src={lightboxMedia} 
                alt="Mídia da avaliação" 
                className="w-full max-h-[80vh] object-contain"
              />
            )
          )}
        </DialogContent>
      </Dialog>
      {ReviewConfirmDialog}
    </div>
  );
}
