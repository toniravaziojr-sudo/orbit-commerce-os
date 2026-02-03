import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  Video,
  Loader2,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Trash2,
  ChevronRight,
  RefreshCw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { useState } from "react";
import {
  useMediaVideoJobs,
  useMediaVideoCandidates,
  useDeleteMediaVideoJob,
  type MediaVideoJob,
} from "@/hooks/useMediaVideoCreatives";

const STAGE_LABELS: Record<string, string> = {
  pending: "Aguardando",
  preprocess: "Pré-processando",
  rewrite: "Otimizando Prompt",
  generate_candidates: "Gerando Variações",
  qa_select: "Avaliação QA",
  retry: "Tentativa Extra",
  fallback: "Composição Fallback",
  completed: "Concluído",
  failed: "Falhou",
};

const STAGE_PROGRESS: Record<string, number> = {
  pending: 0,
  preprocess: 15,
  rewrite: 30,
  generate_candidates: 50,
  qa_select: 75,
  retry: 85,
  fallback: 90,
  completed: 100,
  failed: 100,
};

interface MediaVideoJobsListProps {
  campaignId?: string;
  onRefresh?: () => void;
}

export function MediaVideoJobsList({ campaignId, onRefresh }: MediaVideoJobsListProps) {
  const { data: jobs, isLoading, refetch } = useMediaVideoJobs(campaignId);
  const deleteJob = useDeleteMediaVideoJob();
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [jobToDelete, setJobToDelete] = useState<MediaVideoJob | null>(null);
  const [expandedJob, setExpandedJob] = useState<string | null>(null);

  const handleDelete = () => {
    if (jobToDelete) {
      deleteJob.mutate(jobToDelete.id);
      setDeleteDialogOpen(false);
      setJobToDelete(null);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!jobs || jobs.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <Video className="h-12 w-12 mx-auto mb-4 opacity-50" />
        <h3 className="text-lg font-medium mb-2">Nenhum vídeo gerado</h3>
        <p className="text-sm">Os vídeos gerados aparecerão aqui.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-medium">Histórico de Gerações</h3>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            refetch();
            onRefresh?.();
          }}
        >
          <RefreshCw className="h-4 w-4 mr-2" />
          Atualizar
        </Button>
      </div>

      <div className="space-y-3">
        {jobs.map((job) => (
          <JobCard
            key={job.id}
            job={job}
            isExpanded={expandedJob === job.id}
            onToggleExpand={() => setExpandedJob(expandedJob === job.id ? null : job.id)}
            onDelete={() => {
              setJobToDelete(job);
              setDeleteDialogOpen(true);
            }}
          />
        ))}
      </div>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir job de vídeo?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. O job e todas as suas variações serão excluídos
              permanentemente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
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

interface JobCardProps {
  job: MediaVideoJob;
  isExpanded: boolean;
  onToggleExpand: () => void;
  onDelete: () => void;
}

function JobCard({ job, isExpanded, onToggleExpand, onDelete }: JobCardProps) {
  const isProcessing = !["completed", "failed"].includes(job.status);
  const progress = STAGE_PROGRESS[job.status] ?? 0;

  return (
    <Collapsible open={isExpanded} onOpenChange={onToggleExpand}>
      <Card className={isProcessing ? "border-primary/50" : undefined}>
        <CardHeader className="pb-2">
          <div className="flex items-start justify-between">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <CollapsibleTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-6 w-6 -ml-1">
                    <ChevronRight
                      className={`h-4 w-4 transition-transform ${isExpanded ? "rotate-90" : ""}`}
                    />
                  </Button>
                </CollapsibleTrigger>
                <CardTitle className="text-sm truncate">
                  {job.original_prompt.slice(0, 60)}
                  {job.original_prompt.length > 60 ? "..." : ""}
                </CardTitle>
              </div>
              <p className="text-xs text-muted-foreground mt-1 ml-7">
                {format(new Date(job.created_at), "dd MMM 'às' HH:mm", { locale: ptBR })}
              </p>
            </div>

            <div className="flex items-center gap-2">
              <JobStatusBadge job={job} />
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete();
                }}
              >
                <Trash2 className="h-4 w-4 text-muted-foreground" />
              </Button>
            </div>
          </div>
        </CardHeader>

        <CardContent className="pt-2">
          {isProcessing && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>{STAGE_LABELS[job.status]}</span>
                <span>{progress}%</span>
              </div>
              <Progress value={progress} className="h-1.5" />
            </div>
          )}

          <CollapsibleContent className="pt-4 space-y-4">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-muted-foreground">Nicho:</span>{" "}
                <span className="font-medium">{job.niche}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Duração:</span>{" "}
                <span className="font-medium">{job.duration_seconds}s</span>
              </div>
              <div>
                <span className="text-muted-foreground">Variações:</span>{" "}
                <span className="font-medium">{job.variation_count}</span>
              </div>
              <div>
                <span className="text-muted-foreground">QA Threshold:</span>{" "}
                <span className="font-medium">{(job.qa_threshold * 100).toFixed(0)}%</span>
              </div>
            </div>

            {job.qa_passed !== null && (
              <div className="flex items-center gap-2 text-sm">
                {job.qa_passed ? (
                  <>
                    <CheckCircle2 className="h-4 w-4 text-green-500" />
                    <span>QA Aprovado</span>
                  </>
                ) : (
                  <>
                    <AlertTriangle className="h-4 w-4 text-yellow-500" />
                    <span>QA Reprovado (fallback usado: {job.fallback_used ? "Sim" : "Não"})</span>
                  </>
                )}
              </div>
            )}

            {job.output_url && (
              <div className="aspect-video rounded-lg bg-muted flex items-center justify-center">
                <video
                  src={job.output_url}
                  poster={job.output_thumbnail_url || undefined}
                  controls
                  className="w-full h-full rounded-lg object-contain"
                />
              </div>
            )}

            {job.error_message && (
              <div className="p-3 bg-destructive/10 text-destructive rounded-lg text-sm">
                <strong>Erro:</strong> {job.error_message}
              </div>
            )}

            {job.status === "completed" && <CandidatesSection jobId={job.id} />}
          </CollapsibleContent>
        </CardContent>
      </Card>
    </Collapsible>
  );
}

function JobStatusBadge({ job }: { job: MediaVideoJob }) {
  if (job.status === "completed") {
    return (
      <Badge variant="default" className="gap-1">
        <CheckCircle2 className="h-3 w-3" />
        Concluído
      </Badge>
    );
  }

  if (job.status === "failed") {
    return (
      <Badge variant="destructive" className="gap-1">
        <XCircle className="h-3 w-3" />
        Falhou
      </Badge>
    );
  }

  return (
    <Badge variant="outline" className="gap-1">
      <Loader2 className="h-3 w-3 animate-spin" />
      {STAGE_LABELS[job.status]}
    </Badge>
  );
}

function CandidatesSection({ jobId }: { jobId: string }) {
  const { data: candidates, isLoading } = useMediaVideoCandidates(jobId);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-4">
        <Loader2 className="h-5 w-5 animate-spin" />
      </div>
    );
  }

  if (!candidates || candidates.length === 0) {
    return null;
  }

  return (
    <div className="space-y-2">
      <h4 className="text-sm font-medium">Candidatos ({candidates.length})</h4>
      <div className="grid grid-cols-2 gap-2">
        {candidates.map((candidate) => (
          <div
            key={candidate.id}
            className={`p-2 rounded-lg border text-xs ${
              candidate.is_best
                ? "border-primary bg-primary/5"
                : candidate.qa_passed
                ? "border-green-500/30"
                : "border-muted"
            }`}
          >
            <div className="flex items-center justify-between mb-1">
              <span className="font-medium">Variação {candidate.candidate_index + 1}</span>
              {candidate.is_best && (
                <Badge variant="default" className="h-4 text-[10px]">
                  Melhor
                </Badge>
              )}
            </div>
            {candidate.final_score !== null && (
              <div className="text-muted-foreground">
                Score: {(candidate.final_score * 100).toFixed(1)}%
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
