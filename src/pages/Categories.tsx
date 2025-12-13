import { useState } from 'react';
import { useCategories } from '@/hooks/useProducts';
import { PageHeader } from '@/components/ui/page-header';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Plus, Pencil, Trash2, FolderTree } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';

export default function Categories() {
  const { categories, isLoading, createCategory, updateCategory, deleteCategory } = useCategories();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [editingCategory, setEditingCategory] = useState<any>(null);
  const [formData, setFormData] = useState({
    name: '',
    slug: '',
    description: '',
    image_url: '',
    parent_id: '',
    is_active: true,
    sort_order: 0,
    seo_title: '',
    seo_description: '',
  });

  const parentCategories = categories?.filter(c => !c.parent_id) || [];

  const resetForm = () => {
    setFormData({
      name: '', slug: '', description: '', image_url: '', parent_id: '',
      is_active: true, sort_order: 0, seo_title: '', seo_description: '',
    });
    setEditingCategory(null);
  };

  const handleEdit = (category: any) => {
    setEditingCategory(category);
    setFormData({
      name: category.name,
      slug: category.slug,
      description: category.description || '',
      image_url: category.image_url || '',
      parent_id: category.parent_id || '',
      is_active: category.is_active,
      sort_order: category.sort_order || 0,
      seo_title: category.seo_title || '',
      seo_description: category.seo_description || '',
    });
    setIsDialogOpen(true);
  };

  const handleSubmit = async () => {
    const data = {
      ...formData,
      parent_id: formData.parent_id || null,
      slug: formData.slug || formData.name.toLowerCase().replace(/\s+/g, '-'),
    };

    if (editingCategory) {
      await updateCategory.mutateAsync({ id: editingCategory.id, ...data });
    } else {
      await createCategory.mutateAsync(data);
    }
    setIsDialogOpen(false);
    resetForm();
  };

  const handleDelete = async () => {
    if (deleteId) {
      await deleteCategory.mutateAsync(deleteId);
      setDeleteId(null);
    }
  };

  const getCategoryTree = () => {
    const parents = categories?.filter(c => !c.parent_id) || [];
    return parents.map(parent => ({
      ...parent,
      children: categories?.filter(c => c.parent_id === parent.id) || [],
    }));
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
        title="Categorias"
        description="Gerencie as categorias de produtos da sua loja"
        action={
          <Dialog open={isDialogOpen} onOpenChange={(open) => { setIsDialogOpen(open); if (!open) resetForm(); }}>
            <DialogTrigger asChild>
              <Button><Plus className="mr-2 h-4 w-4" />Nova Categoria</Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>{editingCategory ? 'Editar Categoria' : 'Nova Categoria'}</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div><Label>Nome *</Label><Input value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} /></div>
                <div><Label>Slug</Label><Input value={formData.slug} onChange={(e) => setFormData({ ...formData, slug: e.target.value })} placeholder="gerado-automaticamente" /></div>
                <div><Label>Categoria Pai</Label>
                  <Select value={formData.parent_id} onValueChange={(v) => setFormData({ ...formData, parent_id: v === 'none' ? '' : v })}>
                    <SelectTrigger><SelectValue placeholder="Nenhuma (categoria raiz)" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Nenhuma</SelectItem>
                      {parentCategories.filter(c => c.id !== editingCategory?.id).map(c => (
                        <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div><Label>Descrição</Label><Textarea value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })} /></div>
                <div><Label>URL da Imagem</Label><Input value={formData.image_url} onChange={(e) => setFormData({ ...formData, image_url: e.target.value })} /></div>
                <div className="flex items-center gap-2"><Switch checked={formData.is_active} onCheckedChange={(c) => setFormData({ ...formData, is_active: c })} /><Label>Ativa</Label></div>
                <div><Label>Ordem</Label><Input type="number" value={formData.sort_order} onChange={(e) => setFormData({ ...formData, sort_order: parseInt(e.target.value) || 0 })} /></div>
                <div><Label>SEO Título</Label><Input value={formData.seo_title} onChange={(e) => setFormData({ ...formData, seo_title: e.target.value })} /></div>
                <div><Label>SEO Descrição</Label><Textarea value={formData.seo_description} onChange={(e) => setFormData({ ...formData, seo_description: e.target.value })} /></div>
                <Button onClick={handleSubmit} disabled={!formData.name} className="w-full">{editingCategory ? 'Salvar' : 'Criar'}</Button>
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
                <TableHead>Nome</TableHead>
                <TableHead>Slug</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Ordem</TableHead>
                <TableHead className="w-24">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {getCategoryTree().map((category) => (
                <>
                  <TableRow key={category.id}>
                    <TableCell className="font-medium"><FolderTree className="inline h-4 w-4 mr-2 text-muted-foreground" />{category.name}</TableCell>
                    <TableCell className="text-muted-foreground">{category.slug}</TableCell>
                    <TableCell><Badge variant={category.is_active ? 'default' : 'secondary'}>{category.is_active ? 'Ativa' : 'Inativa'}</Badge></TableCell>
                    <TableCell>{category.sort_order}</TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" onClick={() => handleEdit(category)}><Pencil className="h-4 w-4" /></Button>
                        <Button variant="ghost" size="icon" onClick={() => setDeleteId(category.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                      </div>
                    </TableCell>
                  </TableRow>
                  {category.children.map((child: any) => (
                    <TableRow key={child.id} className="bg-muted/30">
                      <TableCell className="font-medium pl-10">↳ {child.name}</TableCell>
                      <TableCell className="text-muted-foreground">{child.slug}</TableCell>
                      <TableCell><Badge variant={child.is_active ? 'default' : 'secondary'}>{child.is_active ? 'Ativa' : 'Inativa'}</Badge></TableCell>
                      <TableCell>{child.sort_order}</TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button variant="ghost" size="icon" onClick={() => handleEdit(child)}><Pencil className="h-4 w-4" /></Button>
                          <Button variant="ghost" size="icon" onClick={() => setDeleteId(child.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </>
              ))}
              {(!categories || categories.length === 0) && (
                <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">Nenhuma categoria cadastrada</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>Excluir categoria?</AlertDialogTitle><AlertDialogDescription>Esta ação não pode ser desfeita.</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter><AlertDialogCancel>Cancelar</AlertDialogCancel><AlertDialogAction onClick={handleDelete}>Excluir</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
