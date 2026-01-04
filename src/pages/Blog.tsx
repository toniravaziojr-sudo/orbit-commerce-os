// =============================================
// BLOG ADMIN - Manage blog posts
// =============================================

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { PageHeader } from '@/components/ui/page-header';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Plus, Pencil, Trash2, Eye, LayoutTemplate, FileText, Calendar, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import { usePrimaryPublicHost, buildPublicStorefrontUrl } from '@/hooks/usePrimaryPublicHost';
import { validateSlug, generateSlug } from '@/lib/slugValidation';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import type { Json } from '@/integrations/supabase/types';

interface BlogPost {
  id: string;
  tenant_id: string;
  title: string;
  slug: string;
  excerpt: string | null;
  featured_image_url: string | null;
  status: string;
  published_at: string | null;
  created_at: string;
  updated_at: string;
  view_count: number | null;
  read_time_minutes: number | null;
  tags: string[] | null;
}

export default function Blog() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { currentTenant } = useAuth();
  const { primaryOrigin } = usePrimaryPublicHost(currentTenant?.id, currentTenant?.slug);
  
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [editingPost, setEditingPost] = useState<BlogPost | null>(null);
  const [formData, setFormData] = useState({
    title: '',
    slug: '',
    excerpt: '',
    seo_title: '',
    seo_description: '',
  });

  // Fetch blog posts
  const { data: posts, isLoading } = useQuery({
    queryKey: ['blog-posts', currentTenant?.id],
    queryFn: async () => {
      if (!currentTenant?.id) return [];
      const { data, error } = await supabase
        .from('blog_posts')
        .select('*')
        .eq('tenant_id', currentTenant.id)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data as BlogPost[];
    },
    enabled: !!currentTenant?.id,
  });

  // Check if slug already exists
  const checkSlugExists = async (slug: string, excludeId?: string): Promise<boolean> => {
    if (!currentTenant?.id) return false;
    
    let query = supabase
      .from('blog_posts')
      .select('id')
      .eq('tenant_id', currentTenant.id)
      .eq('slug', slug);
    
    if (excludeId) {
      query = query.neq('id', excludeId);
    }
    
    const { data } = await query.maybeSingle();
    return !!data;
  };

  // Create post mutation
  const createPost = useMutation({
    mutationFn: async (data: { title: string; slug: string; excerpt?: string; seo_title?: string; seo_description?: string }) => {
      if (!currentTenant?.id) throw new Error('No tenant');
      
      // Check slug uniqueness before insert
      const slugExists = await checkSlugExists(data.slug);
      if (slugExists) {
        throw new Error('Este slug já está em uso. Escolha outro.');
      }
      
      const { defaultNeutralPageTemplate } = await import('@/lib/builder/defaults');
      
      const { data: newPost, error } = await supabase
        .from('blog_posts')
        .insert([{
          tenant_id: currentTenant.id,
          title: data.title,
          slug: data.slug,
          excerpt: data.excerpt || null,
          seo_title: data.seo_title || null,
          seo_description: data.seo_description || null,
          content: defaultNeutralPageTemplate as unknown as Json,
          status: 'draft',
        }])
        .select()
        .single();
      
      if (error) throw error;
      return newPost;
    },
    onSuccess: (newPost) => {
      queryClient.invalidateQueries({ queryKey: ['blog-posts'] });
      toast.success('Post criado com sucesso');
      navigate(`/blog/${newPost.id}/editor`);
    },
    onError: (error: any) => {
      toast.error(error.message || 'Erro ao criar post');
    },
  });

  // Update post mutation
  const updatePost = useMutation({
    mutationFn: async (data: { id: string; title?: string; slug?: string; excerpt?: string; status?: string; seo_title?: string; seo_description?: string }) => {
      // Check slug uniqueness before update (if slug is being changed)
      if (data.slug) {
        const slugExists = await checkSlugExists(data.slug, data.id);
        if (slugExists) {
          throw new Error('Este slug já está em uso. Escolha outro.');
        }
      }
      
      const updateData: any = { ...data };
      delete updateData.id;
      
      if (data.status === 'published') {
        updateData.published_at = new Date().toISOString();
      }
      
      const { error } = await supabase
        .from('blog_posts')
        .update(updateData)
        .eq('id', data.id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['blog-posts'] });
      toast.success('Post atualizado');
    },
    onError: (error: any) => {
      toast.error(error.message || 'Erro ao atualizar');
    },
  });

  // Delete post mutation
  const deletePost = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('blog_posts')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['blog-posts'] });
      toast.success('Post excluído');
      setDeleteId(null);
    },
    onError: (error: any) => {
      toast.error(error.message || 'Erro ao excluir');
    },
  });

  const resetForm = () => {
    setFormData({ title: '', slug: '', excerpt: '', seo_title: '', seo_description: '' });
    setEditingPost(null);
  };

  const handleEdit = async (post: BlogPost) => {
    // Fetch full post data including SEO fields
    const { data: fullPost } = await supabase
      .from('blog_posts')
      .select('seo_title, seo_description')
      .eq('id', post.id)
      .single();
    
    setEditingPost(post);
    setFormData({
      title: post.title,
      slug: post.slug,
      excerpt: post.excerpt || '',
      seo_title: fullPost?.seo_title || '',
      seo_description: fullPost?.seo_description || '',
    });
    setIsDialogOpen(true);
  };

  const handleSubmit = async () => {
    const slug = formData.slug || generateSlug(formData.title);
    const validation = validateSlug(slug);
    
    if (!validation.isValid) {
      toast.error(validation.error || 'Slug inválido');
      return;
    }
    
    if (editingPost) {
      await updatePost.mutateAsync({
        id: editingPost.id,
        title: formData.title,
        slug,
        excerpt: formData.excerpt || undefined,
        seo_title: formData.seo_title || undefined,
        seo_description: formData.seo_description || undefined,
      });
      setIsDialogOpen(false);
      resetForm();
    } else {
      await createPost.mutateAsync({
        title: formData.title,
        slug,
        excerpt: formData.excerpt || undefined,
        seo_title: formData.seo_title || undefined,
        seo_description: formData.seo_description || undefined,
      });
    }
  };

  const handleToggleStatus = async (post: BlogPost) => {
    const newStatus = post.status === 'published' ? 'draft' : 'published';
    await updatePost.mutateAsync({ id: post.id, status: newStatus });
  };

  if (isLoading) {
    return (
      <div className="p-6 space-y-4">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <PageHeader
        title="Blog"
        description="Crie e gerencie posts do blog da sua loja"
        actions={
          <Dialog open={isDialogOpen} onOpenChange={(open) => { setIsDialogOpen(open); if (!open) resetForm(); }}>
            <DialogTrigger asChild>
              <Button><Plus className="mr-2 h-4 w-4" />Novo Post</Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle>{editingPost ? 'Editar Post' : 'Novo Post'}</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div>
                  <Label>Título *</Label>
                  <Input 
                    value={formData.title} 
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })} 
                    placeholder="Título do post"
                  />
                </div>
                <div>
                  <Label>Slug *</Label>
                  <Input 
                    value={formData.slug} 
                    onChange={(e) => setFormData({ ...formData, slug: e.target.value.toLowerCase().replace(/\s+/g, '-') })} 
                    placeholder={formData.title ? generateSlug(formData.title) : 'url-do-post'}
                    className={!validateSlug(formData.slug).isValid && formData.slug ? 'border-destructive' : ''}
                  />
                  {!validateSlug(formData.slug).isValid && formData.slug ? (
                    <p className="text-xs text-destructive flex items-center gap-1 mt-1">
                      <AlertCircle className="h-3 w-3" />
                      {validateSlug(formData.slug).error}
                    </p>
                  ) : (
                    <p className="text-xs text-muted-foreground mt-1">
                      URL: /blog/{formData.slug || generateSlug(formData.title) || 'slug'}
                    </p>
                  )}
                </div>
                <div>
                  <Label>Resumo</Label>
                  <Textarea 
                    value={formData.excerpt} 
                    onChange={(e) => setFormData({ ...formData, excerpt: e.target.value })} 
                    placeholder="Breve descrição do post"
                    className="min-h-[80px]"
                  />
                </div>
                
                {/* SEO Fields */}
                <div className="border-t pt-4 mt-4">
                  <p className="text-sm font-medium mb-3">SEO</p>
                  <div className="space-y-3">
                    <div>
                      <Label>Título SEO</Label>
                      <Input 
                        value={formData.seo_title} 
                        onChange={(e) => setFormData({ ...formData, seo_title: e.target.value })} 
                        placeholder={formData.title || 'Título para mecanismos de busca'}
                        maxLength={60}
                      />
                      <p className="text-xs text-muted-foreground mt-1">
                        {formData.seo_title.length}/60 caracteres
                      </p>
                    </div>
                    <div>
                      <Label>Descrição SEO</Label>
                      <Textarea 
                        value={formData.seo_description} 
                        onChange={(e) => setFormData({ ...formData, seo_description: e.target.value })} 
                        placeholder="Descrição para mecanismos de busca"
                        className="min-h-[60px]"
                        maxLength={160}
                      />
                      <p className="text-xs text-muted-foreground mt-1">
                        {formData.seo_description.length}/160 caracteres
                      </p>
                    </div>
                  </div>
                </div>
                
                <Button
                  onClick={handleSubmit} 
                  disabled={!formData.title || createPost.isPending || updatePost.isPending} 
                  className="w-full"
                >
                  {editingPost ? 'Salvar' : 'Criar e Abrir Editor'}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        }
      />

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Título</TableHead>
                <TableHead>Slug</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Data</TableHead>
                <TableHead className="w-32">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {posts?.map((post) => (
                <TableRow key={post.id}>
                  <TableCell className="font-medium">
                    <div className="flex items-center gap-2">
                      <FileText className="h-4 w-4 text-muted-foreground" />
                      {post.title}
                    </div>
                  </TableCell>
                  <TableCell className="text-muted-foreground">/blog/{post.slug}</TableCell>
                  <TableCell>
                    <Badge 
                      variant={post.status === 'published' ? 'default' : 'secondary'}
                      className="cursor-pointer"
                      onClick={() => handleToggleStatus(post)}
                    >
                      {post.status === 'published' ? 'Publicado' : 'Rascunho'}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    <div className="flex items-center gap-1 text-sm">
                      <Calendar className="h-3 w-3" />
                      {format(new Date(post.created_at), 'dd/MM/yyyy', { locale: ptBR })}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      {primaryOrigin && post.slug && post.status === 'published' && (
                        <a 
                          href={buildPublicStorefrontUrl(primaryOrigin, `/blog/${post.slug}`)} 
                          target="_blank" 
                          rel="noopener noreferrer"
                        >
                          <Button variant="outline" size="icon" title="Visualizar">
                            <Eye className="h-4 w-4" />
                          </Button>
                        </a>
                      )}
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        onClick={() => navigate(`/blog/${post.id}/editor`)}
                        title="Editar no Editor"
                      >
                        <LayoutTemplate className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => handleEdit(post)} title="Editar Metadados">
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => setDeleteId(post.id)} title="Excluir">
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {(!posts || posts.length === 0) && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                    <FileText className="h-12 w-12 mx-auto mb-3 opacity-50" />
                    <p>Nenhum post encontrado</p>
                    <p className="text-sm">Crie seu primeiro post para começar</p>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir post?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. O post será removido permanentemente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction 
              onClick={() => deleteId && deletePost.mutate(deleteId)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
