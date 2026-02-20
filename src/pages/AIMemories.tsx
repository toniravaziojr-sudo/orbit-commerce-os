import { useState } from "react";
import { Brain, Trash2, Edit2, Check, X, MessageSquare, Sparkles, Shield, Tag, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useAIMemories, AIMemory } from "@/hooks/useAIMemories";
import { Loader2 } from "lucide-react";

const CATEGORY_LABELS: Record<string, { label: string; color: string }> = {
  business_fact: { label: "Fato do Negócio", color: "bg-blue-500/10 text-blue-600" },
  preference: { label: "Preferência", color: "bg-purple-500/10 text-purple-600" },
  decision: { label: "Decisão", color: "bg-amber-500/10 text-amber-600" },
  product_insight: { label: "Insight de Produto", color: "bg-green-500/10 text-green-600" },
  persona: { label: "Persona", color: "bg-pink-500/10 text-pink-600" },
  general: { label: "Geral", color: "bg-muted text-muted-foreground" },
};

const AGENT_LABELS: Record<string, string> = {
  chatgpt: "ChatGPT",
  command_assistant: "Auxiliar de Comando",
  ads_chat: "Ads Chat",
  ai_support: "Atendimento IA",
  all: "Todas as IAs",
};

function ImportanceStars({ value }: { value: number }) {
  const stars = Math.min(Math.ceil(value / 2), 5);
  return (
    <div className="flex gap-0.5">
      {Array.from({ length: 5 }).map((_, i) => (
        <Star
          key={i}
          className={`h-3 w-3 ${i < stars ? "fill-amber-400 text-amber-400" : "text-muted-foreground/30"}`}
        />
      ))}
    </div>
  );
}

function MemoryCard({ memory, onDelete, onUpdate }: { 
  memory: AIMemory; 
  onDelete: (id: string) => void;
  onUpdate: (data: { id: string; content: string; importance: number; category: string }) => void;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState(memory.content);
  const [editImportance, setEditImportance] = useState(memory.importance);
  const [editCategory, setEditCategory] = useState(memory.category);

  const cat = CATEGORY_LABELS[memory.category] || CATEGORY_LABELS.general;
  const scope = memory.user_id ? "Pessoal" : "Negócio";

  const handleSave = () => {
    onUpdate({ id: memory.id, content: editContent, importance: editImportance, category: editCategory });
    setIsEditing(false);
  };

  return (
    <div className="group flex gap-3 p-3 rounded-lg border bg-card hover:bg-accent/30 transition-colors">
      <div className="flex-1 min-w-0 space-y-1.5">
        <div className="flex items-center gap-2 flex-wrap">
          <Badge variant="outline" className={cat.color}>{cat.label}</Badge>
          <Badge variant="outline" className="text-[10px]">{scope}</Badge>
          <Badge variant="outline" className="text-[10px]">{AGENT_LABELS[memory.ai_agent] || memory.ai_agent}</Badge>
          <ImportanceStars value={memory.importance} />
        </div>
        {isEditing ? (
          <div className="space-y-2">
            <Input value={editContent} onChange={e => setEditContent(e.target.value)} className="text-sm" />
            <div className="flex gap-2">
              <Select value={editCategory} onValueChange={setEditCategory}>
                <SelectTrigger className="w-40 h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(CATEGORY_LABELS).map(([k, v]) => (
                    <SelectItem key={k} value={k}>{v.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={String(editImportance)} onValueChange={v => setEditImportance(Number(v))}>
                <SelectTrigger className="w-24 h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {[1,2,3,4,5,6,7,8,9,10].map(n => (
                    <SelectItem key={n} value={String(n)}>{n}/10</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button size="sm" variant="ghost" onClick={handleSave} className="h-8 w-8 p-0">
                <Check className="h-3.5 w-3.5 text-green-500" />
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setIsEditing(false)} className="h-8 w-8 p-0">
                <X className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        ) : (
          <p className="text-sm text-foreground">{memory.content}</p>
        )}
        <p className="text-[10px] text-muted-foreground">
          {new Date(memory.created_at).toLocaleDateString("pt-BR")} · {new Date(memory.created_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
        </p>
      </div>
      {!isEditing && (
        <div className="flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => setIsEditing(true)}>
            <Edit2 className="h-3 w-3" />
          </Button>
          <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-destructive" onClick={() => onDelete(memory.id)}>
            <Trash2 className="h-3 w-3" />
          </Button>
        </div>
      )}
    </div>
  );
}

export default function AIMemories() {
  const { memories, summaries, isLoadingMemories, isLoadingSummaries, deleteMemory, updateMemory, deleteSummary } = useAIMemories();
  const [agentFilter, setAgentFilter] = useState<string>("all");

  const filteredMemories = agentFilter === "all" 
    ? memories 
    : memories.filter(m => m.ai_agent === agentFilter || m.ai_agent === "all");

  const filteredSummaries = agentFilter === "all"
    ? summaries
    : summaries.filter(s => s.ai_agent === agentFilter);

  const tenantMemories = filteredMemories.filter(m => !m.user_id);
  const userMemories = filteredMemories.filter(m => m.user_id);

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Brain className="h-5 w-5 text-purple-500" />
          <h1 className="text-lg font-semibold">Memória da IA</h1>
          <Badge variant="secondary" className="text-xs">{memories.length} memórias</Badge>
        </div>
        <Select value={agentFilter} onValueChange={setAgentFilter}>
          <SelectTrigger className="w-48 h-8 text-xs">
            <SelectValue placeholder="Filtrar por IA" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas as IAs</SelectItem>
            <SelectItem value="chatgpt">ChatGPT</SelectItem>
            <SelectItem value="command_assistant">Auxiliar de Comando</SelectItem>
            <SelectItem value="ads_chat">Ads Chat</SelectItem>
            <SelectItem value="ai_support">Atendimento IA</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Tabs defaultValue="memories" className="w-full">
        <TabsList>
          <TabsTrigger value="memories" className="gap-1.5">
            <Brain className="h-3.5 w-3.5" />
            Memórias ({filteredMemories.length})
          </TabsTrigger>
          <TabsTrigger value="summaries" className="gap-1.5">
            <MessageSquare className="h-3.5 w-3.5" />
            Resumos ({filteredSummaries.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="memories" className="mt-3 space-y-4">
          {isLoadingMemories ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : filteredMemories.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                <Brain className="h-10 w-10 text-muted-foreground/40 mb-3" />
                <p className="text-sm text-muted-foreground">Nenhuma memória salva ainda.</p>
                <p className="text-xs text-muted-foreground mt-1">As memórias são extraídas automaticamente das conversas com as IAs.</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 lg:grid-cols-2">
              {tenantMemories.length > 0 && (
                <Card>
                  <CardHeader className="py-3 px-4">
                    <CardTitle className="text-sm flex items-center gap-1.5">
                      <Shield className="h-3.5 w-3.5 text-blue-500" />
                      Fatos do Negócio
                      <Badge variant="secondary" className="text-[10px] ml-auto">{tenantMemories.length}</Badge>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="px-4 pb-4 pt-0">
                    <ScrollArea className="max-h-[500px]">
                      <div className="space-y-2">
                        {tenantMemories.map(m => (
                          <MemoryCard key={m.id} memory={m} onDelete={deleteMemory} onUpdate={updateMemory} />
                        ))}
                      </div>
                    </ScrollArea>
                  </CardContent>
                </Card>
              )}
              {userMemories.length > 0 && (
                <Card>
                  <CardHeader className="py-3 px-4">
                    <CardTitle className="text-sm flex items-center gap-1.5">
                      <Tag className="h-3.5 w-3.5 text-purple-500" />
                      Preferências Pessoais
                      <Badge variant="secondary" className="text-[10px] ml-auto">{userMemories.length}</Badge>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="px-4 pb-4 pt-0">
                    <ScrollArea className="max-h-[500px]">
                      <div className="space-y-2">
                        {userMemories.map(m => (
                          <MemoryCard key={m.id} memory={m} onDelete={deleteMemory} onUpdate={updateMemory} />
                        ))}
                      </div>
                    </ScrollArea>
                  </CardContent>
                </Card>
              )}
            </div>
          )}
        </TabsContent>

        <TabsContent value="summaries" className="mt-3">
          {isLoadingSummaries ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : filteredSummaries.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                <MessageSquare className="h-10 w-10 text-muted-foreground/40 mb-3" />
                <p className="text-sm text-muted-foreground">Nenhum resumo de conversa ainda.</p>
                <p className="text-xs text-muted-foreground mt-1">Os resumos são gerados automaticamente após conversas significativas.</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-2">
              {filteredSummaries.map(s => (
                <div key={s.id} className="group flex gap-3 p-3 rounded-lg border bg-card hover:bg-accent/30 transition-colors">
                  <div className="flex-1 min-w-0 space-y-1.5">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-[10px]">{AGENT_LABELS[s.ai_agent] || s.ai_agent}</Badge>
                      {s.key_topics?.map((t, i) => (
                        <Badge key={i} variant="secondary" className="text-[10px]">{t}</Badge>
                      ))}
                    </div>
                    <p className="text-sm">{s.summary}</p>
                    {s.key_decisions && Array.isArray(s.key_decisions) && s.key_decisions.length > 0 && (
                      <div className="text-xs text-muted-foreground">
                        <strong>Decisões:</strong> {s.key_decisions.map((d: any) => d.decision || d).join("; ")}
                      </div>
                    )}
                    <p className="text-[10px] text-muted-foreground">
                      {new Date(s.created_at).toLocaleDateString("pt-BR")} · {s.message_count || "?"} mensagens
                    </p>
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 w-7 p-0 opacity-0 group-hover:opacity-100 text-destructive"
                    onClick={() => deleteSummary(s.id)}
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
