import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { usePageTemplates, PageTemplate } from '@/hooks/usePageTemplates';
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
import { Plus, Pencil, Trash2, Copy, LayoutTemplate, Star, Eye } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuth } from '@/hooks/useAuth';

export default function PageTemplates() {
  const navigate = useNavigate();
  const { currentTenant } = useAuth();
  const { 
    templates, 
    isLoading, 
    createTemplate, 
    deleteTemplate, 
    duplicateTemplate,
    setDefaultTemplate,
    initializeDefaultTemplate 
  } = usePageTemplates();
  
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
  });

  // Initialize default template if none exists
  useEffect(() => {
    if (!isLoading && templates && templates.length === 0 && currentTenant?.id) {
      initializeDefaultTemplate.mutate();
    }
  }, [isLoading, templates, currentTenant?.id]);

  const resetForm = () => {
    setFormData({ name: '', description: '' });
  };

  const handleSubmit = async () => {
    const newTemplate = await createTemplate.mutateAsync({
      name: formData.name,
      description: formData.description || undefined,
    });
    setIsDialogOpen(false);
    resetForm();
    // Navigate to builder to edit the new template
    if (newTemplate?.id) {
      navigate(`/page-templates/${newTemplate.id}/builder`);
    }
  };

  const handleDelete = async () => {
    if (deleteId) {
      await deleteTemplate.mutateAsync(deleteId);
      setDeleteId(null);
    }
  };

  const handleDuplicate = (template: PageTemplate) => {
    duplicateTemplate.mutate(template);
  };

  const handleSetDefault = (id: string) => {
    setDefaultTemplate.mutate(id);
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
        title="Modelos de Página"
        description="Crie e gerencie modelos (templates) para suas páginas institucionais. Todas as páginas que usam um modelo herdam sua estrutura."
        actions={
          <Dialog open={isDialogOpen} onOpenChange={(open) => { setIsDialogOpen(open); if (!open) resetForm(); }}>
            <DialogTrigger asChild>
              <Button><Plus className="mr-2 h-4 w-4" />Novo Modelo</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Novo Modelo de Página</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div>
                  <Label>Nome do Modelo *</Label>
                  <Input 
                    value={formData.name} 
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })} 
                    placeholder="Ex: Modelo Institucional, FAQ, etc."
                  />
                </div>
                <div>
                  <Label>Descrição (opcional)</Label>
                  <Textarea 
                    value={formData.description} 
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })} 
                    placeholder="Descreva o propósito deste modelo..."
                  />
                </div>
                <Button onClick={handleSubmit} disabled={!formData.name} className="w-full">
                  Criar e Editar no Builder
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
                <TableHead>Nome</TableHead>
                <TableHead>Descrição</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-40">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {templates?.map((template) => (
                <TableRow key={template.id}>
                  <TableCell className="font-medium">
                    <div className="flex items-center gap-2">
                      <LayoutTemplate className="h-4 w-4 text-muted-foreground" />
                      {template.name}
                      {template.is_default && (
                        <Badge variant="secondary" className="ml-2">
                          <Star className="h-3 w-3 mr-1" />
                          Padrão
                        </Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {template.description || '-'}
                  </TableCell>
                  <TableCell>
                    {template.is_system ? (
                      <Badge variant="outline">Sistema</Badge>
                    ) : (
                      <Badge variant="secondary">Personalizado</Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        onClick={() => navigate(`/page-templates/${template.id}/builder`)}
                        title="Editar no Builder Visual"
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        onClick={() => handleDuplicate(template)}
                        title="Duplicar"
                      >
                        <Copy className="h-4 w-4" />
                      </Button>
                      {!template.is_default && (
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          onClick={() => handleSetDefault(template.id)}
                          title="Definir como padrão"
                        >
                          <Star className="h-4 w-4" />
                        </Button>
                      )}
                      {!template.is_system && (
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          onClick={() => setDeleteId(template.id)} 
                          title="Excluir"
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {(!templates || templates.length === 0) && (
                <TableRow>
                  <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                    Nenhum modelo criado. Clique em "Novo Modelo" para começar.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir modelo?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. Páginas que usam este modelo continuarão funcionando, mas não terão mais o layout do modelo.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>Excluir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
