import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { usePrimaryPublicHost } from '@/hooks/usePrimaryPublicHost';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Plus, Search, MoreHorizontal, Pencil, Trash2, Link2, Copy, ExternalLink } from 'lucide-react';
import { EmptyState } from '@/components/ui/empty-state';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';

interface CheckoutLink {
  id: string;
  name: string;
  slug: string;
  product_id: string;
  quantity: number;
  coupon_code: string | null;
  shipping_override: number | null;
  price_override: number | null;
  additional_products: any[];
  is_active: boolean;
  expires_at: string | null;
  click_count: number;
  conversion_count: number;
  created_at: string;
  products?: { name: string; price: number } | null;
}

interface CheckoutLinkListProps {
  onCreateLink: () => void;
  onEditLink: (link: any) => void;
}

export function CheckoutLinkList({ onCreateLink, onEditLink }: CheckoutLinkListProps) {
  const { currentTenant } = useAuth();
  const { primaryOrigin } = usePrimaryPublicHost(currentTenant?.id, currentTenant?.slug);
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');

  const { data: links = [], isLoading } = useQuery({
    queryKey: ['checkout-links', currentTenant?.id],
    queryFn: async () => {
      if (!currentTenant?.id) return [];
      const { data, error } = await supabase
        .from('checkout_links')
        .select('*, products(name, price)')
        .eq('tenant_id', currentTenant.id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as CheckoutLink[];
    },
    enabled: !!currentTenant?.id,
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('checkout_links').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['checkout-links'] });
      toast.success('Link excluído');
    },
    onError: () => toast.error('Erro ao excluir link'),
  });

  const filteredLinks = links.filter(
    (l) => l.name.toLowerCase().includes(search.toLowerCase()) || l.slug.toLowerCase().includes(search.toLowerCase())
  );

  const buildCheckoutUrl = (slug: string) => {
    if (!primaryOrigin) return '';
    return `${primaryOrigin}/checkout?link=${slug}`;
  };

  const copyLink = (slug: string) => {
    const url = buildCheckoutUrl(slug);
    if (url) {
      navigator.clipboard.writeText(url);
      toast.success('Link copiado!');
    }
  };

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-64" />
        {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-16 w-full" />)}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Buscar por nome ou slug..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-10" />
        </div>
        <Button onClick={onCreateLink}>
          <Plus className="mr-2 h-4 w-4" />
          Novo Link
        </Button>
      </div>

      {filteredLinks.length === 0 ? (
        <EmptyState
          icon={Link2}
          title={search ? 'Nenhum link encontrado' : 'Nenhum link de checkout criado'}
          description={search ? 'Tente buscar com outros termos' : 'Crie links personalizados para compartilhar'}
          action={!search ? { label: 'Criar Link', onClick: onCreateLink } : undefined}
        />
      ) : (
        <div className="rounded-md border overflow-x-auto">
          <Table className="min-w-[700px]">
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Produto</TableHead>
                <TableHead>Preço</TableHead>
                <TableHead className="text-center">Cliques</TableHead>
                <TableHead className="text-center">Conversões</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-[50px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredLinks.map((link) => (
                <TableRow key={link.id}>
                  <TableCell>
                    <div className="flex flex-col">
                      <span className="font-medium">{link.name}</span>
                      <span className="text-xs text-muted-foreground font-mono">/{link.slug}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <span className="text-sm">{(link.products as any)?.name || '—'}</span>
                  </TableCell>
                  <TableCell>
                    {link.price_override != null
                      ? formatCurrency(link.price_override)
                      : (link.products as any)?.price
                        ? formatCurrency((link.products as any).price)
                        : '—'}
                    {link.coupon_code && (
                      <Badge variant="secondary" className="ml-2 text-xs">{link.coupon_code}</Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-center">{link.click_count}</TableCell>
                  <TableCell className="text-center">{link.conversion_count}</TableCell>
                  <TableCell>
                    <Badge variant={link.is_active ? 'default' : 'outline'}>
                      {link.is_active ? 'Ativo' : 'Inativo'}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon"><MoreHorizontal className="h-4 w-4" /></Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => copyLink(link.slug)}>
                          <Copy className="mr-2 h-4 w-4" /> Copiar Link
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => window.open(buildCheckoutUrl(link.slug), '_blank')} disabled={!primaryOrigin}>
                          <ExternalLink className="mr-2 h-4 w-4" /> Abrir Link
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={() => onEditLink(link)}>
                          <Pencil className="mr-2 h-4 w-4" /> Editar
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem className="text-destructive" onClick={() => deleteMutation.mutate(link.id)}>
                          <Trash2 className="mr-2 h-4 w-4" /> Excluir
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
