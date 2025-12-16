// =============================================
// REVIEWS PAGE - Moderate product reviews
// =============================================

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { PageHeader } from '@/components/ui/page-header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
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
import { Star, MoreHorizontal, Check, X, Trash2, Search, Loader2, MessageSquare } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

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
  product?: { id: string; name: string };
}

export default function Reviews() {
  const { currentTenant, user } = useAuth();
  const currentTenantId = currentTenant?.id;
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [productFilter, setProductFilter] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');

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
    queryKey: ['product-reviews', currentTenantId, statusFilter, productFilter],
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

      if (statusFilter !== 'all') {
        query = query.eq('status', statusFilter);
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
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
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
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['product-reviews'] });
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

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-wrap gap-4">
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
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[160px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os status</SelectItem>
                <SelectItem value="pending">Pendentes</SelectItem>
                <SelectItem value="approved">Aprovadas</SelectItem>
                <SelectItem value="rejected">Rejeitadas</SelectItem>
              </SelectContent>
            </Select>
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
        </CardContent>
      </Card>

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
                  <TableHead>Produto</TableHead>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Nota</TableHead>
                  <TableHead>Conteúdo</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Data</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredReviews.map((review) => (
                  <TableRow key={review.id}>
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
                              onClick={() => updateStatusMutation.mutate({ id: review.id, status: 'approved' })}
                            >
                              <Check className="h-4 w-4 mr-2 text-green-600" />
                              Aprovar
                            </DropdownMenuItem>
                          )}
                          {review.status !== 'rejected' && (
                            <DropdownMenuItem
                              onClick={() => updateStatusMutation.mutate({ id: review.id, status: 'rejected' })}
                            >
                              <X className="h-4 w-4 mr-2 text-red-600" />
                              Rejeitar
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuItem
                            onClick={() => {
                              if (confirm('Excluir esta avaliação?')) {
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
    </div>
  );
}
