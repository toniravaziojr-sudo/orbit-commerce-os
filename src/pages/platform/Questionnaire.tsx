import { useState, useMemo, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { questionnaireBlocks, totalQuestions } from "@/config/questionnaire-data";
import { PageHeader } from "@/components/ui/page-header";
import { Progress } from "@/components/ui/progress";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { FileText, Download, CheckCircle2, Circle, Loader2 } from "lucide-react";
import { toast } from "sonner";

type ResponseMap = Record<string, string>; // key: "block_key:question_number" => answer

export default function Questionnaire() {
  const { currentTenant } = useAuth();
  const queryClient = useQueryClient();
  const [activeBlock, setActiveBlock] = useState(questionnaireBlocks[0].key);
  const [localAnswers, setLocalAnswers] = useState<ResponseMap>({});
  const [savingKeys, setSavingKeys] = useState<Set<string>>(new Set());

  const tenantId = currentTenant?.id;

  // Fetch all saved responses
  const { data: savedResponses, isLoading } = useQuery({
    queryKey: ["questionnaire-responses", tenantId],
    queryFn: async () => {
      if (!tenantId) return {};
      const { data, error } = await supabase
        .from("questionnaire_responses")
        .select("block_key, question_number, answer")
        .eq("tenant_id", tenantId);
      if (error) throw error;
      const map: ResponseMap = {};
      data?.forEach((r: any) => {
        map[`${r.block_key}:${r.question_number}`] = r.answer;
      });
      return map;
    },
    enabled: !!tenantId,
  });

  // Merge saved + local
  const answers = useMemo(() => ({ ...savedResponses, ...localAnswers }), [savedResponses, localAnswers]);

  // Save mutation
  const saveMutation = useMutation({
    mutationFn: async ({ blockKey, questionNumber, answer }: { blockKey: string; questionNumber: number; answer: string }) => {
      if (!tenantId) throw new Error("No tenant");
      const { error } = await supabase
        .from("questionnaire_responses")
        .upsert(
          { tenant_id: tenantId, block_key: blockKey, question_number: questionNumber, answer },
          { onConflict: "tenant_id,block_key,question_number" }
        );
      if (error) throw error;
    },
    onSuccess: (_, vars) => {
      const key = `${vars.blockKey}:${vars.questionNumber}`;
      setSavingKeys((prev) => { const n = new Set(prev); n.delete(key); return n; });
      queryClient.invalidateQueries({ queryKey: ["questionnaire-responses", tenantId] });
    },
    onError: (err, vars) => {
      const key = `${vars.blockKey}:${vars.questionNumber}`;
      setSavingKeys((prev) => { const n = new Set(prev); n.delete(key); return n; });
      toast.error("Erro ao salvar resposta");
    },
  });

  // Debounced save
  const debounceTimers = useMemo(() => new Map<string, NodeJS.Timeout>(), []);

  const handleChange = useCallback(
    (blockKey: string, questionNumber: number, value: string) => {
      const key = `${blockKey}:${questionNumber}`;
      setLocalAnswers((prev) => ({ ...prev, [key]: value }));

      const existing = debounceTimers.get(key);
      if (existing) clearTimeout(existing);

      const timer = setTimeout(() => {
        setSavingKeys((prev) => new Set(prev).add(key));
        saveMutation.mutate({ blockKey, questionNumber, answer: value });
        debounceTimers.delete(key);
      }, 1500);
      debounceTimers.set(key, timer);
    },
    [saveMutation, debounceTimers]
  );

  // Progress calculations
  const answeredCount = useMemo(() => {
    let count = 0;
    questionnaireBlocks.forEach((block) => {
      block.questions.forEach((q) => {
        const key = `${block.key}:${q.number}`;
        if (answers[key]?.trim()) count++;
      });
    });
    return count;
  }, [answers]);

  const blockProgress = useMemo(() => {
    const map: Record<string, { answered: number; total: number }> = {};
    questionnaireBlocks.forEach((block) => {
      let answered = 0;
      block.questions.forEach((q) => {
        if (answers[`${block.key}:${q.number}`]?.trim()) answered++;
      });
      map[block.key] = { answered, total: block.questions.length };
    });
    return map;
  }, [answers]);

  // Export to text (for PDF generation via ChatGPT)
  const handleExport = useCallback(() => {
    const lines: string[] = [
      "QUESTIONÁRIO COMPLETO – COMANDO CENTRAL",
      `Data: ${new Date().toLocaleDateString("pt-BR")}`,
      `Progresso: ${answeredCount}/${totalQuestions} perguntas respondidas`,
      "",
      "═".repeat(60),
      "",
    ];

    questionnaireBlocks.forEach((block) => {
      lines.push(`## ${block.title}`);
      lines.push("");
      block.questions.forEach((q) => {
        const answer = answers[`${block.key}:${q.number}`]?.trim();
        lines.push(`${q.number}. ${q.text}`);
        lines.push(`R: ${answer || "(não respondida)"}`);
        lines.push("");
      });
      lines.push("─".repeat(40));
      lines.push("");
    });

    const blob = new Blob([lines.join("\n")], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `questionario_comando_central_${new Date().toISOString().slice(0, 10)}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success("Questionário exportado com sucesso!");
  }, [answers, answeredCount]);

  const currentBlock = questionnaireBlocks.find((b) => b.key === activeBlock) ?? questionnaireBlocks[0];
  const progressPct = totalQuestions > 0 ? Math.round((answeredCount / totalQuestions) * 100) : 0;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Questionário de Direcionamento"
        description={`${answeredCount} de ${totalQuestions} perguntas respondidas (${progressPct}%)`}
        actions={
          <Button onClick={handleExport} variant="outline" className="gap-2">
            <Download className="h-4 w-4" />
            Exportar .TXT
          </Button>
        }
      />

      {/* Global progress */}
      <div className="space-y-1">
        <Progress value={progressPct} className="h-3" />
        <p className="text-xs text-muted-foreground text-right">{progressPct}% completo</p>
      </div>

      <div className="flex gap-6 min-h-[600px]">
        {/* Sidebar with blocks */}
        <ScrollArea className="w-72 shrink-0 rounded-lg border bg-card">
          <div className="p-3 space-y-1">
            {questionnaireBlocks.map((block) => {
              const bp = blockProgress[block.key];
              const isComplete = bp && bp.answered === bp.total;
              const isActive = block.key === activeBlock;
              return (
                <button
                  key={block.key}
                  onClick={() => setActiveBlock(block.key)}
                  className={cn(
                    "w-full text-left px-3 py-2 rounded-md text-sm transition-colors flex items-center gap-2",
                    isActive
                      ? "bg-primary text-primary-foreground"
                      : "hover:bg-muted text-foreground"
                  )}
                >
                  {isComplete ? (
                    <CheckCircle2 className="h-4 w-4 shrink-0 text-green-500" />
                  ) : (
                    <Circle className="h-4 w-4 shrink-0 opacity-40" />
                  )}
                  <span className="truncate flex-1">{block.title}</span>
                  <span className={cn("text-xs shrink-0", isActive ? "text-primary-foreground/70" : "text-muted-foreground")}>
                    {bp ? `${bp.answered}/${bp.total}` : ""}
                  </span>
                </button>
              );
            })}
          </div>
        </ScrollArea>

        {/* Questions area */}
        <div className="flex-1 min-w-0">
          <div className="rounded-lg border bg-card p-6 space-y-6">
            <div className="flex items-center gap-3">
              <FileText className="h-5 w-5 text-primary" />
              <h2 className="text-lg font-semibold">{currentBlock.title}</h2>
              <span className="text-sm text-muted-foreground ml-auto">
                {blockProgress[currentBlock.key]?.answered ?? 0}/{currentBlock.questions.length} respondidas
              </span>
            </div>

            <div className="space-y-5">
              {currentBlock.questions.map((q) => {
                const key = `${currentBlock.key}:${q.number}`;
                const value = answers[key] ?? "";
                const isSaving = savingKeys.has(key);
                return (
                  <div key={q.number} className="space-y-2">
                    <label className="text-sm font-medium text-foreground flex items-start gap-2">
                      <span className="text-primary font-bold shrink-0">{q.number}.</span>
                      <span>{q.text}</span>
                      {isSaving && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground shrink-0 mt-0.5" />}
                    </label>
                    <Textarea
                      value={value}
                      onChange={(e) => handleChange(currentBlock.key, q.number, e.target.value)}
                      placeholder="Digite sua resposta..."
                      className="min-h-[80px] resize-y"
                    />
                  </div>
                );
              })}
            </div>

            {/* Block navigation */}
            <div className="flex justify-between pt-4 border-t">
              <Button
                variant="outline"
                onClick={() => {
                  const idx = questionnaireBlocks.findIndex((b) => b.key === activeBlock);
                  if (idx > 0) setActiveBlock(questionnaireBlocks[idx - 1].key);
                }}
                disabled={questionnaireBlocks[0].key === activeBlock}
              >
                ← Bloco anterior
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  const idx = questionnaireBlocks.findIndex((b) => b.key === activeBlock);
                  if (idx < questionnaireBlocks.length - 1) setActiveBlock(questionnaireBlocks[idx + 1].key);
                }}
                disabled={questionnaireBlocks[questionnaireBlocks.length - 1].key === activeBlock}
              >
                Próximo bloco →
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
