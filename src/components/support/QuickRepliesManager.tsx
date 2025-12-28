import { useState } from "react";
import { Plus, Edit, Trash2, MessageSquareText, Search, Tag } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { EmptyState } from "@/components/ui/empty-state";
import { useQuickReplies, type QuickReply } from "@/hooks/useQuickReplies";

const CATEGORIES = [
  { value: 'saudacao', label: 'Saudação' },
  { value: 'pedido', label: 'Pedido' },
  { value: 'pagamento', label: 'Pagamento' },
  { value: 'envio', label: 'Envio' },
  { value: 'troca', label: 'Troca/Devolução' },
  { value: 'suporte', label: 'Suporte técnico' },
  { value: 'encerramento', label: 'Encerramento' },
  { value: 'outro', label: 'Outro' },
];

interface QuickReplyFormData {
  title: string;
  content: string;
  shortcut: string;
  category: string;
}

const initialFormData: QuickReplyFormData = {
  title: '',
  content: '',
  shortcut: '',
  category: '',
};

export function QuickRepliesManager() {
  const { quickReplies, isLoading, createQuickReply, updateQuickReply, deleteQuickReply } = useQuickReplies();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingReply, setEditingReply] = useState<QuickReply | null>(null);
  const [formData, setFormData] = useState<QuickReplyFormData>(initialFormData);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterCategory, setFilterCategory] = useState<string>('all');

  const handleOpenCreate = () => {
    setEditingReply(null);
    setFormData(initialFormData);
    setDialogOpen(true);
  };

  const handleOpenEdit = (reply: QuickReply) => {
    setEditingReply(reply);
    setFormData({
      title: reply.title,
      content: reply.content,
      shortcut: reply.shortcut || '',
      category: reply.category || '',
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!formData.title.trim() || !formData.content.trim()) return;

    if (editingReply) {
      await updateQuickReply.mutateAsync({
        id: editingReply.id,
        title: formData.title,
        content: formData.content,
        shortcut: formData.shortcut || null,
        category: formData.category || null,
      });
    } else {
      await createQuickReply.mutateAsync({
        title: formData.title,
        content: formData.content,
        shortcut: formData.shortcut || undefined,
        category: formData.category || undefined,
      });
    }

    setDialogOpen(false);
    setFormData(initialFormData);
  };

  const handleDelete = async (id: string) => {
    if (confirm('Tem certeza que deseja remover esta resposta rápida?')) {
      await deleteQuickReply.mutateAsync(id);
    }
  };

  // Extract variables from content
  const extractVariables = (content: string) => {
    const matches = content.match(/\{\{(\w+)\}\}/g);
    return matches ? [...new Set(matches.map(m => m.slice(2, -2)))] : [];
  };

  // Filter replies
  const filteredReplies = quickReplies.filter(reply => {
    const matchesSearch = 
      reply.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      reply.content.toLowerCase().includes(searchQuery.toLowerCase()) ||
      reply.shortcut?.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesCategory = filterCategory === 'all' || reply.category === filterCategory;
    
    return matchesSearch && matchesCategory;
  });

  // Group by category
  const groupedReplies = filteredReplies.reduce((acc, reply) => {
    const category = reply.category || 'outro';
    if (!acc[category]) acc[category] = [];
    acc[category].push(reply);
    return acc;
  }, {} as Record<string, QuickReply[]>);

  const currentVariables = extractVariables(formData.content);

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold">Respostas Rápidas</h2>
          <p className="text-muted-foreground text-sm">
            Crie respostas pré-definidas para agilizar o atendimento
          </p>
        </div>
        <Button onClick={handleOpenCreate}>
          <Plus className="h-4 w-4 mr-2" />
          Nova resposta
        </Button>
      </div>

      {/* Filters */}
      <div className="flex gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar respostas..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={filterCategory} onValueChange={setFilterCategory}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="Categoria" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas categorias</SelectItem>
            {CATEGORIES.map(cat => (
              <SelectItem key={cat.value} value={cat.value}>{cat.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* List */}
      {isLoading ? (
        <div className="text-center py-8 text-muted-foreground">Carregando...</div>
      ) : filteredReplies.length === 0 ? (
      <EmptyState
          icon={MessageSquareText}
          title="Nenhuma resposta rápida"
          description={searchQuery ? "Nenhum resultado para sua busca" : "Crie respostas rápidas para agilizar o atendimento"}
          action={!searchQuery ? {
            label: "Criar primeira resposta",
            onClick: handleOpenCreate,
          } : undefined}
        />
      ) : (
        <ScrollArea className="h-[calc(100vh-320px)]">
          <div className="space-y-6">
            {Object.entries(groupedReplies).map(([category, replies]) => {
              const categoryLabel = CATEGORIES.find(c => c.value === category)?.label || category;
              return (
                <div key={category}>
                  <h3 className="text-sm font-medium text-muted-foreground mb-3 flex items-center gap-2">
                    <Tag className="h-4 w-4" />
                    {categoryLabel} ({replies.length})
                  </h3>
                  <div className="grid gap-3">
                    {replies.map(reply => (
                      <Card key={reply.id} className="group">
                        <CardContent className="p-4">
                          <div className="flex items-start justify-between gap-4">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1">
                                <h4 className="font-medium">{reply.title}</h4>
                                {reply.shortcut && (
                                  <Badge variant="secondary" className="text-xs">
                                    /{reply.shortcut}
                                  </Badge>
                                )}
                              </div>
                              <p className="text-sm text-muted-foreground line-clamp-2">
                                {reply.content}
                              </p>
                              <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                                <span>Usado {reply.use_count}x</span>
                                {reply.variables?.length > 0 && (
                                  <span>
                                    Variáveis: {reply.variables.map(v => `{{${v}}}`).join(', ')}
                                  </span>
                                )}
                              </div>
                            </div>
                            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleOpenEdit(reply)}
                              >
                                <Edit className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleDelete(reply.id)}
                              >
                                <Trash2 className="h-4 w-4 text-destructive" />
                              </Button>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </ScrollArea>
      )}

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editingReply ? 'Editar resposta rápida' : 'Nova resposta rápida'}
            </DialogTitle>
            <DialogDescription>
              Use variáveis como {`{{nome}}`} ou {`{{pedido}}`} para personalizar
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Título *</Label>
                <Input
                  placeholder="Ex: Boas vindas"
                  value={formData.title}
                  onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label>Atalho</Label>
                <div className="flex items-center">
                  <span className="text-muted-foreground mr-1">/</span>
                  <Input
                    placeholder="ola"
                    value={formData.shortcut}
                    onChange={(e) => setFormData(prev => ({ 
                      ...prev, 
                      shortcut: e.target.value.toLowerCase().replace(/[^a-z0-9]/g, '') 
                    }))}
                  />
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Categoria</Label>
              <Select 
                value={formData.category} 
                onValueChange={(value) => setFormData(prev => ({ ...prev, category: value }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione uma categoria" />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map(cat => (
                    <SelectItem key={cat.value} value={cat.value}>{cat.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Conteúdo *</Label>
              <Textarea
                placeholder="Olá {{nome}}! Como posso ajudar?"
                value={formData.content}
                onChange={(e) => setFormData(prev => ({ ...prev, content: e.target.value }))}
                rows={4}
              />
              {currentVariables.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-2">
                  <span className="text-xs text-muted-foreground">Variáveis detectadas:</span>
                  {currentVariables.map(v => (
                    <Badge key={v} variant="outline" className="text-xs">
                      {`{{${v}}}`}
                    </Badge>
                  ))}
                </div>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancelar
            </Button>
            <Button 
              onClick={handleSave}
              disabled={!formData.title.trim() || !formData.content.trim()}
            >
              {editingReply ? 'Salvar' : 'Criar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
