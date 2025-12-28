import { useState } from "react";
import { Zap, Plus, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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

interface QuickRepliesDropdownProps {
  onSelect: (content: string) => void;
}

export function QuickRepliesDropdown({ onSelect }: QuickRepliesDropdownProps) {
  const { quickReplies, createQuickReply, incrementUseCount } = useQuickReplies();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [newReply, setNewReply] = useState({
    title: '',
    content: '',
    shortcut: '',
    category: '',
  });

  const filteredReplies = quickReplies.filter(qr => {
    const searchLower = search.toLowerCase();
    return (
      qr.title.toLowerCase().includes(searchLower) ||
      qr.content.toLowerCase().includes(searchLower) ||
      qr.shortcut?.toLowerCase().includes(searchLower)
    );
  });

  // Group by category
  const groupedReplies = filteredReplies.reduce((acc, reply) => {
    const category = reply.category || 'outro';
    if (!acc[category]) acc[category] = [];
    acc[category].push(reply);
    return acc;
  }, {} as Record<string, QuickReply[]>);

  const handleSelect = (reply: QuickReply) => {
    onSelect(reply.content);
    incrementUseCount.mutate(reply.id);
    setOpen(false);
    setSearch('');
  };

  const handleCreate = async () => {
    if (!newReply.title.trim() || !newReply.content.trim()) return;
    
    await createQuickReply.mutateAsync({
      title: newReply.title,
      content: newReply.content,
      shortcut: newReply.shortcut || undefined,
      category: newReply.category || undefined,
    });
    
    setNewReply({ title: '', content: '', shortcut: '', category: '' });
    setCreateDialogOpen(false);
  };

  return (
    <>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button variant="ghost" size="sm" className="gap-1">
            <Zap className="h-4 w-4" />
            Respostas
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-80 p-0" align="start">
          <div className="p-2 border-b">
            <div className="relative">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar ou digitar /atalho"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-8 h-8"
              />
            </div>
          </div>
          
          <ScrollArea className="max-h-[300px]">
            {Object.keys(groupedReplies).length === 0 ? (
              <div className="p-4 text-center text-muted-foreground text-sm">
                {search ? 'Nenhuma resposta encontrada' : 'Nenhuma resposta cadastrada'}
              </div>
            ) : (
              <div className="p-1">
                {Object.entries(groupedReplies).map(([category, replies]) => {
                  const categoryLabel = CATEGORIES.find(c => c.value === category)?.label || category;
                  return (
                    <div key={category}>
                      <div className="px-2 py-1 text-xs font-medium text-muted-foreground">
                        {categoryLabel}
                      </div>
                      {replies.map((reply) => (
                        <button
                          key={reply.id}
                          onClick={() => handleSelect(reply)}
                          className="w-full p-2 text-left hover:bg-muted rounded-md transition-colors"
                        >
                          <div className="flex items-center justify-between mb-1">
                            <span className="font-medium text-sm">{reply.title}</span>
                            {reply.shortcut && (
                              <Badge variant="secondary" className="text-xs">
                                /{reply.shortcut}
                              </Badge>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground line-clamp-2">
                            {reply.content}
                          </p>
                        </button>
                      ))}
                    </div>
                  );
                })}
              </div>
            )}
          </ScrollArea>
          
          <div className="p-2 border-t">
            <Button 
              variant="ghost" 
              size="sm" 
              className="w-full gap-2"
              onClick={() => {
                setOpen(false);
                setCreateDialogOpen(true);
              }}
            >
              <Plus className="h-4 w-4" />
              Criar nova resposta
            </Button>
          </div>
        </PopoverContent>
      </Popover>

      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nova resposta rápida</DialogTitle>
            <DialogDescription>
              Use variáveis como {`{{nome}}`} para personalizar
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Título *</Label>
                <Input
                  placeholder="Ex: Boas vindas"
                  value={newReply.title}
                  onChange={(e) => setNewReply(prev => ({ ...prev, title: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label>Atalho</Label>
                <div className="flex items-center">
                  <span className="text-muted-foreground mr-1">/</span>
                  <Input
                    placeholder="ola"
                    value={newReply.shortcut}
                    onChange={(e) => setNewReply(prev => ({ 
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
                value={newReply.category} 
                onValueChange={(value) => setNewReply(prev => ({ ...prev, category: value }))}
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
                value={newReply.content}
                onChange={(e) => setNewReply(prev => ({ ...prev, content: e.target.value }))}
                rows={4}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateDialogOpen(false)}>
              Cancelar
            </Button>
            <Button 
              onClick={handleCreate}
              disabled={!newReply.title.trim() || !newReply.content.trim() || createQuickReply.isPending}
            >
              {createQuickReply.isPending ? 'Criando...' : 'Criar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
