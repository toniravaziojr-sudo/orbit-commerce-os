// =============================================
// BLOG ADMIN - Manage blog posts + AI campaigns (tabs)
// =============================================

import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { PageHeader } from '@/components/ui/page-header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Plus, Pencil, Trash2, Eye, LayoutTemplate, FileText, Calendar, AlertCircle, Sparkles, BookOpen, MoreVertical } from 'lucide-react';
import { toast } from 'sonner';
import { usePrimaryPublicHost, buildPublicStorefrontUrl } from '@/hooks/usePrimaryPublicHost';
import { validateSlug, generateSlug } from '@/lib/slugValidation';
import { format, addMonths, startOfMonth, endOfMonth, startOfDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import type { Json } from '@/integrations/supabase/types';
import { GenerateSeoButton } from '@/components/seo/GenerateSeoButton';
import { cn } from '@/lib/utils';
import { useMediaCampaigns, MediaCampaign } from '@/hooks/useMediaCampaigns';

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

// Generate available months for campaign selection
const getAvailableMonths = () => {
  const now = new Date();
  const months = [];
  for (let i = 0; i < 6; i++) {
    const monthDate = addMonths(now, i);
    const monthStart = startOfMonth(monthDate);
    const monthEnd = endOfMonth(monthDate);
    const start = i === 0 ? startOfDay(now) : monthStart;
    months.push({
      value: format(monthDate, "yyyy-MM"),
      label: format(monthDate, "MMMM", { locale: ptBR }),
      shortLabel: format(monthDate, "MMM", { locale: ptBR }),
      fullLabel: format(monthDate, "MMMM yyyy", { locale: ptBR }),
      start,
      end: monthEnd,
      isCurrent: i === 0,
    });
  }
  return months;
};

export default function Blog() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = searchParams.get('tab') || 'posts';
  const queryClient = useQueryClient();
  const { currentTenant } = useAuth();
  // Campaign state
  const { campaigns, isLoading: isCampaignsLoading, createCampaign, deleteCampaign, updateCampaign } = useMediaCampaigns();
  const [isCampaignDialogOpen, setIsCampaignDialogOpen] = useState(false);
  const [campaignDeleteId, setCampaignDeleteId] = useState<string | null>(null);
  const [editingCampaign, setEditingCampaign] = useState<MediaCampaign | null>(null);
  const [campaignFormData, setCampaignFormData] = useState({ name: '', prompt: '', selectedMonth: '' });
  const availableMonths = getAvailableMonths();
  const blogCampaigns = campaigns?.filter(c => c.target_channel === 'blog') || [];

  const { primaryOrigin } = usePrimaryPublicHost(currentTenant?.id, currentTenant?.slug);
  
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [editingPost, setEditingPost] = useState<BlogPost | null>(null);
  const [formData, setFormData] = useState({
    title: '',
    slug: '',
    excerpt: '',
    tags: '',
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
      
      // Import the function that creates template with the title
      const { createBlogPostTemplateWithTitle } = await import('@/lib/builder/defaults');
      
      // Create template with the actual post title
      const contentWithTitle = createBlogPostTemplateWithTitle(data.title);
      
      const { data: newPost, error } = await supabase
        .from('blog_posts')
        .insert([{
          tenant_id: currentTenant.id,
          title: data.title,
          slug: data.slug,
          excerpt: data.excerpt || null,
          seo_title: data.seo_title || null,
          seo_description: data.seo_description || null,
          content: contentWithTitle as unknown as Json,
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
    mutationFn: async (data: { id: string; title?: string; slug?: string; excerpt?: string; status?: string; tags?: string[]; seo_title?: string; seo_description?: string }) => {
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
    setFormData({ title: '', slug: '', excerpt: '', tags: '', seo_title: '', seo_description: '' });
    setEditingPost(null);
  };

  const handleEdit = async (post: BlogPost) => {
    // Fetch full post data including SEO fields and tags
    const { data: fullPost } = await supabase
      .from('blog_posts')
      .select('seo_title, seo_description, tags')
      .eq('id', post.id)
      .single();
    
    setEditingPost(post);
    setFormData({
      title: post.title,
      slug: post.slug,
      excerpt: post.excerpt || '',
      tags: fullPost?.tags?.join(', ') || '',
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
    
    // Parse tags
    const tagsArray = formData.tags
      .split(',')
      .map(t => t.trim())
      .filter(t => t.length > 0);
    
    if (editingPost) {
      await updatePost.mutateAsync({
        id: editingPost.id,
        title: formData.title,
        slug,
        excerpt: formData.excerpt || undefined,
        tags: tagsArray.length > 0 ? tagsArray : undefined,
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

  // ==================== Campaign Methods ====================
  const resetCampaignForm = () => {
    setCampaignFormData({ name: '', prompt: '', selectedMonth: availableMonths[0]?.value || '' });
    setEditingCampaign(null);
  };

  const handleOpenCampaignDialog = () => {
    resetCampaignForm();
    setIsCampaignDialogOpen(true);
  };

  const handleEditCampaign = (campaign: MediaCampaign) => {
    setEditingCampaign(campaign);
    setCampaignFormData({
      name: campaign.name,
      prompt: campaign.prompt || '',
      selectedMonth: format(new Date(campaign.start_date), 'yyyy-MM'),
    });
    setIsCampaignDialogOpen(true);
  };

  const handleCampaignSubmit = async () => {
    const monthData = availableMonths.find(m => m.value === campaignFormData.selectedMonth);
    if (!monthData && !editingCampaign) {
      toast.error('Selecione um mês');
      return;
    }
    try {
      if (editingCampaign) {
        await updateCampaign.mutateAsync({
          id: editingCampaign.id,
          name: campaignFormData.name,
          prompt: campaignFormData.prompt,
        });
        toast.success('Campanha atualizada');
      } else {
        const result = await createCampaign.mutateAsync({
          name: campaignFormData.name,
          prompt: campaignFormData.prompt,
          start_date: format(monthData!.start, 'yyyy-MM-dd'),
          end_date: format(monthData!.end, 'yyyy-MM-dd'),
          days_of_week: [0, 1, 2, 3, 4, 5, 6],
          target_channel: 'blog',
        });
        toast.success('Campanha criada');
        navigate(`/blog/campaigns/${result.id}`);
      }
      setIsCampaignDialogOpen(false);
      resetCampaignForm();
    } catch (error: any) {
      toast.error(error.message || 'Erro ao salvar campanha');
    }
  };

  const handleDeleteCampaign = async () => {
    if (!campaignDeleteId) return;
    try {
      await deleteCampaign.mutateAsync(campaignDeleteId);
      toast.success('Campanha excluída');
      setCampaignDeleteId(null);
    } catch (error: any) {
      toast.error(error.message || 'Erro ao excluir campanha');
    }
  };

  const getCampaignStatusLabel = (status: string) => {
    switch (status) {
      case 'active': return 'Ativa';
      case 'ready': return 'Pronta';
      case 'generating': return 'Gerando';
      case 'completed': return 'Concluída';
      default: return 'Rascunho';
    }
  };

  const getCampaignStatusVariant = (status: string): 'default' | 'secondary' | 'outline' => {
    switch (status) {
      case 'active': case 'ready': return 'default';
      case 'generating': return 'secondary';
      case 'completed': return 'outline';
      default: return 'secondary';
    }
  };

  const handleStatusChange = async (post: BlogPost, newStatus: string) => {
    await updatePost.mutateAsync({ id: post.id, status: newStatus });
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'published': return 'Publicado';
      case 'archived': return 'Arquivado';
      default: return 'Rascunho';
    }
  };

  const getStatusVariant = (status: string): 'default' | 'secondary' | 'outline' => {
    switch (status) {
      case 'published': return 'default';
      case 'archived': return 'outline';
      default: return 'secondary';
    }
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
        description="Crie e gerencie posts e campanhas de conteúdo do blog"
      />

      <Tabs value={activeTab} onValueChange={(v) => setSearchParams({ tab: v })} className="space-y-4">
        <TabsList>
          <TabsTrigger value="posts" className="gap-2">
            <BookOpen className="h-4 w-4" />
            Posts
          </TabsTrigger>
          <TabsTrigger value="campaigns" className="gap-2">
            <Sparkles className="h-4 w-4" />
            Campanhas IA
          </TabsTrigger>
        </TabsList>

        {/* ==================== TAB: POSTS ==================== */}
        <TabsContent value="posts" className="space-y-4">
          <div className="flex justify-end">
            <Dialog open={isDialogOpen} onOpenChange={(open) => { setIsDialogOpen(open); if (!open) resetForm(); }}>
              <DialogTrigger asChild>
                <Button><Plus className="mr-2 h-4 w-4" />Novo Post</Button>
              </DialogTrigger>
              <DialogContent className="max-w-lg flex flex-col max-h-[90vh]">
                <DialogHeader>
                  <DialogTitle>{editingPost ? 'Editar Post do Blog' : 'Criar Novo Post'}</DialogTitle>
                </DialogHeader>
                <div className="flex-1 overflow-y-auto space-y-4 py-4">
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">Título *</Label>
                    <Input 
                      value={formData.title} 
                      onChange={(e) => setFormData({ ...formData, title: e.target.value })} 
                      placeholder="Ex: Como escolher o produto ideal"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">Slug (URL)</Label>
                    <Input 
                      value={formData.slug} 
                      onChange={(e) => setFormData({ ...formData, slug: e.target.value.toLowerCase().replace(/\s+/g, '-') })} 
                      placeholder={formData.title ? generateSlug(formData.title) : 'url-do-post'}
                      className={!validateSlug(formData.slug).isValid && formData.slug ? 'border-destructive' : ''}
                    />
                    {!validateSlug(formData.slug).isValid && formData.slug ? (
                      <p className="text-xs text-destructive flex items-center gap-1">
                        <AlertCircle className="h-3 w-3" />
                        {validateSlug(formData.slug).error}
                      </p>
                    ) : (
                      <p className="text-xs text-muted-foreground">
                        URL final: /blog/{formData.slug || generateSlug(formData.title) || 'slug'}
                      </p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">Resumo</Label>
                    <Textarea 
                      value={formData.excerpt} 
                      onChange={(e) => setFormData({ ...formData, excerpt: e.target.value })} 
                      placeholder="Uma breve descrição que aparecerá na listagem de posts"
                      className="min-h-[80px] resize-none"
                    />
                  </div>
                  {editingPost && (
                    <div className="space-y-2">
                      <Label className="text-sm font-medium">Tags</Label>
                      <Input 
                        value={formData.tags} 
                        onChange={(e) => setFormData({ ...formData, tags: e.target.value })} 
                        placeholder="dicas, tutoriais, novidades"
                      />
                      <p className="text-xs text-muted-foreground">Separe as tags por vírgula</p>
                    </div>
                  )}
                  <div className="border-t pt-4 mt-4 space-y-4">
                    <div className="flex items-center justify-between">
                      <h4 className="text-sm font-medium">Configurações SEO</h4>
                      <GenerateSeoButton
                        input={{ type: 'blog', name: formData.title, excerpt: formData.excerpt, tags: formData.tags ? formData.tags.split(',').map(t => t.trim()).filter(Boolean) : [] }}
                        onGenerated={(result) => setFormData({ ...formData, seo_title: result.seo_title, seo_description: result.seo_description })}
                        disabled={!formData.title}
                      />
                    </div>
                    <div className="space-y-3">
                      <div className="space-y-2">
                        <Label className="text-sm font-medium">Título SEO</Label>
                        <Input value={formData.seo_title} onChange={(e) => setFormData({ ...formData, seo_title: e.target.value })} placeholder={formData.title || 'Título para mecanismos de busca'} maxLength={60} />
                        <p className="text-xs text-muted-foreground">{formData.seo_title.length}/60 caracteres</p>
                      </div>
                      <div className="space-y-2">
                        <Label className="text-sm font-medium">Descrição SEO</Label>
                        <Textarea value={formData.seo_description} onChange={(e) => setFormData({ ...formData, seo_description: e.target.value })} placeholder="Descrição para mecanismos de busca" className="min-h-[60px] resize-none" maxLength={160} />
                        <p className="text-xs text-muted-foreground">{formData.seo_description.length}/160 caracteres</p>
                      </div>
                    </div>
                  </div>
                  {!editingPost && (
                    <div className="bg-muted/50 p-3 rounded-md border border-dashed">
                      <p className="text-sm text-muted-foreground">💡 Após criar, você será redirecionado ao editor para escrever o conteúdo do post.</p>
                    </div>
                  )}
                  <div className="flex gap-2 pt-2">
                    <Button variant="outline" onClick={() => { setIsDialogOpen(false); resetForm(); }} className="flex-1" type="button">Cancelar</Button>
                    <Button onClick={handleSubmit} disabled={!formData.title || createPost.isPending || updatePost.isPending} className="flex-1">
                      {createPost.isPending || updatePost.isPending ? 'Salvando...' : editingPost ? 'Salvar Alterações' : 'Criar Post'}
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          </div>

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
                        <Select value={post.status} onValueChange={(value) => handleStatusChange(post, value)}>
                          <SelectTrigger className="w-[120px] h-8">
                            <Badge variant={getStatusVariant(post.status)} className="font-normal">{getStatusLabel(post.status)}</Badge>
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="draft">Rascunho</SelectItem>
                            <SelectItem value="published">Publicado</SelectItem>
                            <SelectItem value="archived">Arquivado</SelectItem>
                          </SelectContent>
                        </Select>
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
                            <a href={buildPublicStorefrontUrl(primaryOrigin, `/blog/${post.slug}`)} target="_blank" rel="noopener noreferrer">
                              <Button variant="outline" size="icon" title="Visualizar"><Eye className="h-4 w-4" /></Button>
                            </a>
                          )}
                          <Button variant="ghost" size="icon" onClick={() => navigate(`/blog/${post.id}/editor`)} title="Editar no Editor">
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
        </TabsContent>

        {/* ==================== TAB: CAMPANHAS IA ==================== */}
        <TabsContent value="campaigns" className="space-y-4">
          <div className="flex justify-end">
            <Button onClick={handleOpenCampaignDialog}>
              <Plus className="h-4 w-4 mr-2" />
              Nova Campanha
            </Button>
          </div>

          {blogCampaigns.length === 0 ? (
            <Card className="border-dashed">
              <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                <div className="rounded-full bg-primary/10 p-4 mb-4">
                  <Sparkles className="h-8 w-8 text-primary" />
                </div>
                <h3 className="text-lg font-semibold mb-2">Nenhuma campanha de blog</h3>
                <p className="text-muted-foreground max-w-sm mb-4">
                  Crie sua primeira campanha e deixe a IA gerar um calendário completo de artigos para seu blog.
                </p>
                <Button onClick={handleOpenCampaignDialog}>
                  <Plus className="h-4 w-4 mr-2" />
                  Criar primeira campanha
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {blogCampaigns.map((campaign) => (
                <Card
                  key={campaign.id}
                  className="group cursor-pointer hover:border-primary/50 transition-colors"
                  onClick={() => navigate(`/blog/campaigns/${campaign.id}`)}
                >
                  <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2">
                    <div className="flex items-center gap-2">
                      <div className="rounded-lg bg-primary/10 p-2">
                        <BookOpen className="h-4 w-4 text-primary" />
                      </div>
                      <div>
                        <CardTitle className="text-base">{campaign.name}</CardTitle>
                        <CardDescription className="text-xs mt-0.5">
                          {format(new Date(campaign.start_date), 'MMM yyyy', { locale: ptBR })}
                        </CardDescription>
                      </div>
                    </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                        <Button variant="ghost" size="icon" className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity">
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={(e) => { e.stopPropagation(); navigate(`/blog/campaigns/${campaign.id}`); }}>
                          <Calendar className="h-4 w-4 mr-2" />
                          Ver calendário
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleEditCampaign(campaign); }}>
                          <Pencil className="h-4 w-4 mr-2" />
                          Editar
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem className="text-destructive" onClick={(e) => { e.stopPropagation(); setCampaignDeleteId(campaign.id); }}>
                          <Trash2 className="h-4 w-4 mr-2" />
                          Excluir
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </CardHeader>
                  <CardContent>
                    {campaign.prompt && (
                      <p className="text-sm text-muted-foreground line-clamp-2 mb-3">{campaign.prompt}</p>
                    )}
                    <div className="flex items-center justify-between">
                      <Badge variant={getCampaignStatusVariant(campaign.status)}>
                        {getCampaignStatusLabel(campaign.status)}
                      </Badge>
                      <span className="text-xs text-muted-foreground">{campaign.items_count || 0} artigos</span>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Post Delete Confirmation */}
      <AlertDialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir post?</AlertDialogTitle>
            <AlertDialogDescription>Esta ação não pode ser desfeita. O post será removido permanentemente.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => deleteId && deletePost.mutate(deleteId)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Excluir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Campaign Create/Edit Dialog */}
      <Dialog open={isCampaignDialogOpen} onOpenChange={(open) => { setIsCampaignDialogOpen(open); if (!open) resetCampaignForm(); }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingCampaign ? 'Editar Campanha' : 'Nova Campanha de Blog'}</DialogTitle>
            <DialogDescription>{editingCampaign ? 'Atualize os dados da campanha.' : 'Crie uma campanha e a IA vai gerar sugestões de artigos.'}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label>Nome da campanha *</Label>
              <Input value={campaignFormData.name} onChange={(e) => setCampaignFormData({ ...campaignFormData, name: e.target.value })} placeholder="Ex: Conteúdo de Janeiro" />
            </div>
            <div>
              <Label>Direcionamento / Briefing *</Label>
              <Textarea value={campaignFormData.prompt} onChange={(e) => setCampaignFormData({ ...campaignFormData, prompt: e.target.value })} placeholder="Descreva os temas, tom de voz, e objetivos dos artigos..." className="min-h-[100px]" />
            </div>
            {!editingCampaign && (
              <div>
                <Label>Mês da campanha *</Label>
                <div className="flex flex-wrap gap-2 mt-2">
                  {availableMonths.map((month) => (
                    <button
                      key={month.value}
                      type="button"
                      onClick={() => setCampaignFormData({ ...campaignFormData, selectedMonth: month.value })}
                      className={cn(
                        'px-3 py-2 rounded-lg border-2 transition-all text-sm font-medium',
                        'hover:border-primary hover:bg-primary/5',
                        campaignFormData.selectedMonth === month.value
                          ? 'border-primary bg-primary/10 text-primary'
                          : 'border-border'
                      )}
                    >
                      {month.isCurrent ? 'Este mês' : month.shortLabel}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCampaignDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleCampaignSubmit} disabled={!campaignFormData.name || !campaignFormData.prompt || (!editingCampaign && !campaignFormData.selectedMonth)}>
              {editingCampaign ? 'Salvar' : 'Criar Campanha'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Campaign Delete Confirmation */}
      <AlertDialog open={!!campaignDeleteId} onOpenChange={() => setCampaignDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir campanha?</AlertDialogTitle>
            <AlertDialogDescription>Esta ação não pode ser desfeita. Todos os artigos gerados nesta campanha serão removidos.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteCampaign} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Excluir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
