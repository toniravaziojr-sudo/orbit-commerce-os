import { useState } from "react";
import { Plus, Edit, Trash2, GripVertical, AlertTriangle, CheckCircle, MessageCircle, HelpCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { ScrollArea } from "@/components/ui/scroll-area";

export interface AIRule {
  id: string;
  condition: string;
  action: 'respond' | 'transfer' | 'escalate' | 'suggest';
  response?: string;
  priority: number;
  is_active: boolean;
  category: string;
}

interface AIRulesEditorProps {
  rules: AIRule[];
  onChange: (rules: AIRule[]) => void;
}

const RULE_CATEGORIES = [
  { value: 'reclamacao', label: 'Reclamação', icon: AlertTriangle, color: 'text-red-500' },
  { value: 'duvida', label: 'Dúvida', icon: HelpCircle, color: 'text-blue-500' },
  { value: 'elogio', label: 'Elogio', icon: CheckCircle, color: 'text-green-500' },
  { value: 'pedido', label: 'Pedido', icon: MessageCircle, color: 'text-orange-500' },
  { value: 'outro', label: 'Outro', icon: MessageCircle, color: 'text-gray-500' },
];

const ACTION_TYPES = [
  { value: 'respond', label: 'Responder automaticamente' },
  { value: 'transfer', label: 'Transferir para humano' },
  { value: 'escalate', label: 'Escalar como urgente' },
  { value: 'suggest', label: 'Sugerir resposta (aprovação)' },
];

const DEFAULT_RULES: AIRule[] = [
  {
    id: '1',
    condition: 'Cliente menciona palavras como "processo", "procon", "advogado", "justiça"',
    action: 'transfer',
    priority: 1,
    is_active: true,
    category: 'reclamacao',
  },
  {
    id: '2',
    condition: 'Cliente pede reembolso ou devolução',
    action: 'suggest',
    response: 'Entendo sua solicitação. Vou verificar sua situação e encaminhar para nossa equipe responsável. Pode me informar o número do seu pedido?',
    priority: 2,
    is_active: true,
    category: 'reclamacao',
  },
  {
    id: '3',
    condition: 'Cliente faz elogio ao produto ou atendimento',
    action: 'respond',
    response: 'Muito obrigado pelo seu feedback positivo! 😊 Ficamos muito felizes em saber que você está satisfeito. Conte sempre conosco!',
    priority: 3,
    is_active: true,
    category: 'elogio',
  },
  {
    id: '4',
    condition: 'Cliente demonstra impaciência ou irritação',
    action: 'transfer',
    priority: 1,
    is_active: true,
    category: 'reclamacao',
  },
];

export function AIRulesEditor({ rules, onChange }: AIRulesEditorProps) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<AIRule | null>(null);
  const [formData, setFormData] = useState<Omit<AIRule, 'id'>>({
    condition: '',
    action: 'respond',
    response: '',
    priority: 10,
    is_active: true,
    category: 'outro',
  });

  // Use default rules if none provided
  const displayRules = rules.length > 0 ? rules : DEFAULT_RULES;

  const handleOpenCreate = () => {
    setEditingRule(null);
    setFormData({
      condition: '',
      action: 'respond',
      response: '',
      priority: displayRules.length + 1,
      is_active: true,
      category: 'outro',
    });
    setDialogOpen(true);
  };

  const handleOpenEdit = (rule: AIRule) => {
    setEditingRule(rule);
    setFormData({
      condition: rule.condition,
      action: rule.action,
      response: rule.response || '',
      priority: rule.priority,
      is_active: rule.is_active,
      category: rule.category,
    });
    setDialogOpen(true);
  };

  const handleSave = () => {
    if (!formData.condition.trim()) return;

    let newRules: AIRule[];
    
    if (editingRule) {
      newRules = displayRules.map(r => 
        r.id === editingRule.id ? { ...r, ...formData } : r
      );
    } else {
      const newRule: AIRule = {
        id: crypto.randomUUID(),
        ...formData,
      };
      newRules = [...displayRules, newRule];
    }

    onChange(newRules);
    setDialogOpen(false);
  };

  const handleDelete = (id: string) => {
    if (confirm('Tem certeza que deseja remover esta regra?')) {
      onChange(displayRules.filter(r => r.id !== id));
    }
  };

  const handleToggle = (id: string, is_active: boolean) => {
    onChange(displayRules.map(r => 
      r.id === id ? { ...r, is_active } : r
    ));
  };

  // Group rules by category
  const groupedRules = displayRules.reduce((acc, rule) => {
    if (!acc[rule.category]) acc[rule.category] = [];
    acc[rule.category].push(rule);
    return acc;
  }, {} as Record<string, AIRule[]>);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-lg">Regras de Atendimento</CardTitle>
            <CardDescription>
              Defina como a IA deve reagir em situações específicas
            </CardDescription>
          </div>
          <Button onClick={handleOpenCreate} size="sm">
            <Plus className="h-4 w-4 mr-1" />
            Nova regra
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <ScrollArea className="max-h-[400px]">
          <Accordion type="multiple" defaultValue={RULE_CATEGORIES.map(c => c.value)}>
            {RULE_CATEGORIES.map(category => {
              const categoryRules = groupedRules[category.value] || [];
              if (categoryRules.length === 0 && rules.length > 0) return null;
              
              const CategoryIcon = category.icon;
              
              return (
                <AccordionItem key={category.value} value={category.value}>
                  <AccordionTrigger className="hover:no-underline">
                    <div className="flex items-center gap-2">
                      <CategoryIcon className={`h-4 w-4 ${category.color}`} />
                      <span>{category.label}</span>
                      <Badge variant="secondary" className="ml-2">
                        {categoryRules.length}
                      </Badge>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent>
                    {categoryRules.length === 0 ? (
                      <p className="text-sm text-muted-foreground py-2">
                        Nenhuma regra nesta categoria
                      </p>
                    ) : (
                      <div className="space-y-2">
                        {categoryRules.sort((a, b) => a.priority - b.priority).map(rule => (
                          <div 
                            key={rule.id}
                            className="flex items-start gap-3 p-3 border rounded-lg group hover:bg-muted/50"
                          >
                            <GripVertical className="h-4 w-4 mt-1 text-muted-foreground opacity-0 group-hover:opacity-100 cursor-grab" />
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1">
                                <span className="font-medium text-sm">
                                  Quando: {rule.condition}
                                </span>
                              </div>
                              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                <Badge variant={rule.action === 'transfer' ? 'destructive' : rule.action === 'respond' ? 'default' : 'secondary'}>
                                  {ACTION_TYPES.find(a => a.value === rule.action)?.label}
                                </Badge>
                                {rule.response && (
                                  <span className="truncate max-w-[200px]">
                                    → "{rule.response}"
                                  </span>
                                )}
                              </div>
                            </div>
                            <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                              <Switch
                                checked={rule.is_active}
                                onCheckedChange={(checked) => handleToggle(rule.id, checked)}
                              />
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8"
                                onClick={() => handleOpenEdit(rule)}
                              >
                                <Edit className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8"
                                onClick={() => handleDelete(rule.id)}
                              >
                                <Trash2 className="h-4 w-4 text-destructive" />
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </AccordionContent>
                </AccordionItem>
              );
            })}
          </Accordion>
        </ScrollArea>

        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {editingRule ? 'Editar regra' : 'Nova regra de atendimento'}
              </DialogTitle>
              <DialogDescription>
                Configure quando e como a IA deve reagir
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Categoria</Label>
                <Select
                  value={formData.category}
                  onValueChange={(v) => setFormData(prev => ({ ...prev, category: v }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {RULE_CATEGORIES.map(cat => (
                      <SelectItem key={cat.value} value={cat.value}>
                        <div className="flex items-center gap-2">
                          <cat.icon className={`h-4 w-4 ${cat.color}`} />
                          {cat.label}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Quando (condição) *</Label>
                <Textarea
                  placeholder="Ex: Cliente menciona palavras como 'processo', 'advogado', 'procon'"
                  value={formData.condition}
                  onChange={(e) => setFormData(prev => ({ ...prev, condition: e.target.value }))}
                  rows={2}
                />
                <p className="text-xs text-muted-foreground">
                  Descreva a situação que ativa esta regra
                </p>
              </div>

              <div className="space-y-2">
                <Label>Ação</Label>
                <Select
                  value={formData.action}
                  onValueChange={(v) => setFormData(prev => ({ ...prev, action: v as AIRule['action'] }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ACTION_TYPES.map(action => (
                      <SelectItem key={action.value} value={action.value}>
                        {action.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {(formData.action === 'respond' || formData.action === 'suggest') && (
                <div className="space-y-2">
                  <Label>Resposta</Label>
                  <Textarea
                    placeholder="Digite a resposta que a IA deve dar..."
                    value={formData.response || ''}
                    onChange={(e) => setFormData(prev => ({ ...prev, response: e.target.value }))}
                    rows={3}
                  />
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Prioridade</Label>
                  <Input
                    type="number"
                    min={1}
                    max={100}
                    value={formData.priority}
                    onChange={(e) => setFormData(prev => ({ ...prev, priority: parseInt(e.target.value) }))}
                  />
                  <p className="text-xs text-muted-foreground">Menor = mais prioritário</p>
                </div>
                <div className="space-y-2">
                  <Label>Status</Label>
                  <div className="flex items-center gap-2 h-10">
                    <Switch
                      checked={formData.is_active}
                      onCheckedChange={(checked) => setFormData(prev => ({ ...prev, is_active: checked }))}
                    />
                    <span className="text-sm">
                      {formData.is_active ? 'Ativa' : 'Inativa'}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setDialogOpen(false)}>
                Cancelar
              </Button>
              <Button onClick={handleSave} disabled={!formData.condition.trim()}>
                {editingRule ? 'Salvar' : 'Criar'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}
