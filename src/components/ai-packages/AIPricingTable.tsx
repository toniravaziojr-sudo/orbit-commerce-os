/**
 * AI Pricing Table
 * Shows current pricing for all AI features
 */

import { Info, Bot, Image, Video, Mic, FileText, Search } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useAIPricing, CREDIT_MARKUP, CREDIT_USD, calculateCreditsForCost, formatCredits } from "@/hooks/useCredits";
import { Skeleton } from "@/components/ui/skeleton";

interface PricingRow {
  feature: string;
  icon: React.ReactNode;
  provider: string;
  model: string;
  unit: string;
  costUsd: number;
  credits: number;
  note?: string;
}

const PROVIDER_COLORS: Record<string, string> = {
  openai: 'bg-green-100 text-green-800',
  fal: 'bg-purple-100 text-purple-800',
  gemini: 'bg-blue-100 text-blue-800',
};

export function AIPricingTable() {
  const { data: pricing, isLoading } = useAIPricing();

  if (isLoading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 8 }).map((_, i) => (
          <Skeleton key={i} className="h-12 w-full" />
        ))}
      </div>
    );
  }

  // Build pricing rows from database
  const rows: PricingRow[] = [];

  // Chat GPT-5.2 (per ~1000 tokens average message)
  const gpt52In = pricing?.find(p => p.provider === 'openai' && p.model === 'gpt-5.2' && p.pricing_type === 'per_1m_tokens_in');
  const gpt52Out = pricing?.find(p => p.provider === 'openai' && p.model === 'gpt-5.2' && p.pricing_type === 'per_1m_tokens_out');
  if (gpt52In && gpt52Out) {
    const avgMsgCost = (1000 / 1_000_000) * gpt52In.cost_usd + (500 / 1_000_000) * gpt52Out.cost_usd;
    rows.push({
      feature: 'Chat/Atendimento IA',
      icon: <Bot className="h-4 w-4" />,
      provider: 'OpenAI',
      model: 'GPT-5.2',
      unit: 'por mensagem (~1.5k tokens)',
      costUsd: avgMsgCost,
      credits: calculateCreditsForCost(avgMsgCost),
      note: 'Média de consumo por mensagem',
    });
  }

  // Vision GPT-4o
  const gpt4oIn = pricing?.find(p => p.provider === 'openai' && p.model === 'gpt-4o' && p.pricing_type === 'per_1m_tokens_in');
  const gpt4oOut = pricing?.find(p => p.provider === 'openai' && p.model === 'gpt-4o' && p.pricing_type === 'per_1m_tokens_out');
  if (gpt4oIn && gpt4oOut) {
    const visionCost = (2000 / 1_000_000) * gpt4oIn.cost_usd + (500 / 1_000_000) * gpt4oOut.cost_usd;
    rows.push({
      feature: 'Análise de Imagem',
      icon: <Image className="h-4 w-4" />,
      provider: 'OpenAI',
      model: 'GPT-4o',
      unit: 'por imagem analisada',
      costUsd: visionCost,
      credits: calculateCreditsForCost(visionCost),
    });
  }

  // Audio transcription
  const whisper = pricing?.find(p => p.provider === 'openai' && p.model === 'whisper-1');
  if (whisper) {
    rows.push({
      feature: 'Transcrição de Áudio',
      icon: <Mic className="h-4 w-4" />,
      provider: 'OpenAI',
      model: 'Whisper',
      unit: 'por minuto',
      costUsd: whisper.cost_usd,
      credits: calculateCreditsForCost(whisper.cost_usd),
    });
  }

  // Embeddings
  const embedding = pricing?.find(p => p.provider === 'openai' && p.model === 'text-embedding-3-small');
  if (embedding) {
    rows.push({
      feature: 'Busca Semântica (RAG)',
      icon: <Search className="h-4 w-4" />,
      provider: 'OpenAI',
      model: 'Embeddings',
      unit: 'por 1M tokens',
      costUsd: embedding.cost_usd,
      credits: calculateCreditsForCost(embedding.cost_usd),
    });
  }

  // SEO/Blog (Gemini)
  const geminiIn = pricing?.find(p => p.provider === 'gemini' && p.pricing_type === 'per_1m_tokens_in');
  const geminiOut = pricing?.find(p => p.provider === 'gemini' && p.pricing_type === 'per_1m_tokens_out');
  if (geminiIn && geminiOut) {
    const seoCost = (500 / 1_000_000) * geminiIn.cost_usd + (1000 / 1_000_000) * geminiOut.cost_usd;
    rows.push({
      feature: 'SEO / Geração de Texto',
      icon: <FileText className="h-4 w-4" />,
      provider: 'Gemini',
      model: '2.5 Flash',
      unit: 'por geração',
      costUsd: seoCost,
      credits: calculateCreditsForCost(seoCost),
    });
  }

  // Image generation (medium quality)
  const imageMedium = pricing?.find(p => p.provider === 'fal' && p.model === 'gpt-image-1.5' && p.resolution === 'medium_1024');
  if (imageMedium) {
    rows.push({
      feature: 'Geração de Imagem',
      icon: <Image className="h-4 w-4" />,
      provider: 'Fal.AI',
      model: 'GPT Image 1.5',
      unit: 'por imagem (1024px)',
      costUsd: imageMedium.cost_usd,
      credits: calculateCreditsForCost(imageMedium.cost_usd),
      note: 'Qualidade média',
    });
  }

  // Video generation (Sora standard)
  const soraStd = pricing?.find(p => p.provider === 'fal' && p.model === 'sora-2' && p.quality === 'standard');
  if (soraStd) {
    rows.push({
      feature: 'Geração de Vídeo',
      icon: <Video className="h-4 w-4" />,
      provider: 'Fal.AI',
      model: 'Sora 2',
      unit: 'por 10 segundos',
      costUsd: soraStd.cost_usd * 10,
      credits: calculateCreditsForCost(soraStd.cost_usd * 10),
      note: 'Qualidade standard',
    });
  }

  // Avatar (Kling)
  const avatar = pricing?.find(p => p.provider === 'fal' && p.model === 'kling-avatar-v2-pro');
  if (avatar) {
    rows.push({
      feature: 'Avatar IA',
      icon: <Video className="h-4 w-4" />,
      provider: 'Fal.AI',
      model: 'Kling Avatar',
      unit: 'por 10 segundos',
      costUsd: avatar.cost_usd * 10,
      credits: calculateCreditsForCost(avatar.cost_usd * 10),
    });
  }

  return (
    <TooltipProvider>
      <div className="space-y-4">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Info className="h-4 w-4" />
          <span>
            1 crédito = US$ {CREDIT_USD.toFixed(2)} • Markup: {((CREDIT_MARKUP - 1) * 100).toFixed(0)}%
          </span>
        </div>

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Funcionalidade</TableHead>
              <TableHead>Provedor</TableHead>
              <TableHead>Modelo</TableHead>
              <TableHead>Unidade</TableHead>
              <TableHead className="text-right">Créditos</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row, idx) => (
              <TableRow key={idx}>
                <TableCell>
                  <div className="flex items-center gap-2">
                    {row.icon}
                    <span className="font-medium">{row.feature}</span>
                    {row.note && (
                      <Tooltip>
                        <TooltipTrigger>
                          <Info className="h-3 w-3 text-muted-foreground" />
                        </TooltipTrigger>
                        <TooltipContent>{row.note}</TooltipContent>
                      </Tooltip>
                    )}
                  </div>
                </TableCell>
                <TableCell>
                  <Badge 
                    variant="secondary" 
                    className={PROVIDER_COLORS[row.provider.toLowerCase()] || ''}
                  >
                    {row.provider}
                  </Badge>
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {row.model}
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {row.unit}
                </TableCell>
                <TableCell className="text-right font-medium">
                  ~{formatCredits(row.credits)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </TooltipProvider>
  );
}
