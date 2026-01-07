import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { format, startOfMonth, endOfMonth, addMonths, startOfDay } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Newspaper, Instagram, Facebook, Check, CalendarDays } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { useMediaCampaigns, MediaCampaign } from "@/hooks/useMediaCampaigns";

const CHANNELS = [
  { id: "blog", label: "Blog", icon: Newspaper, description: "Artigos e posts para o blog" },
  { id: "facebook", label: "Facebook", icon: Facebook, description: "Posts para Facebook" },
  { id: "instagram", label: "Instagram", icon: Instagram, description: "Posts para Instagram" },
] as const;

type ChannelId = typeof CHANNELS[number]["id"];

const formSchema = z.object({
  selected_channels: z.array(z.enum(["blog", "facebook", "instagram"])).min(1, "Selecione pelo menos um canal"),
  name: z.string().min(1, "Nome é obrigatório"),
  prompt: z.string().min(10, "Descreva o objetivo da campanha com pelo menos 10 caracteres"),
  description: z.string().optional(),
  selectedPeriod: z.enum(["current", "next"]),
});

type FormValues = z.infer<typeof formSchema>;

interface CreateCampaignDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: (campaign: MediaCampaign) => void;
}

export function CreateCampaignDialog({ open, onOpenChange, onSuccess }: CreateCampaignDialogProps) {
  const { createCampaign } = useMediaCampaigns();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [step, setStep] = useState<"channel" | "details">("channel");

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      selected_channels: [],
      name: "",
      prompt: "",
      description: "",
      selectedPeriod: "current",
    },
  });

  const selectedChannels = form.watch("selected_channels");
  const selectedPeriod = form.watch("selectedPeriod");

  // Compute period dates based on selection
  const getPeriodDates = (period: "current" | "next") => {
    const now = new Date();
    const today = startOfDay(now);
    
    if (period === "current") {
      const endOfCurrentMonth = endOfMonth(now);
      return { start: today, end: endOfCurrentMonth };
    } else {
      const next = addMonths(now, 1);
      return { start: startOfMonth(next), end: endOfMonth(next) };
    }
  };

  const toggleChannel = (channelId: ChannelId) => {
    const current = form.getValues("selected_channels");
    if (current.includes(channelId)) {
      form.setValue("selected_channels", current.filter((c) => c !== channelId));
    } else {
      form.setValue("selected_channels", [...current, channelId]);
    }
  };

  const selectAllChannels = () => {
    form.setValue("selected_channels", ["blog", "facebook", "instagram"]);
  };

  const handleContinue = () => {
    if (selectedChannels.length > 0) {
      setStep("details");
    }
  };

  const handleBack = () => {
    setStep("channel");
  };

  const onSubmit = async (values: FormValues) => {
    setIsSubmitting(true);
    try {
      const { start, end } = getPeriodDates(values.selectedPeriod);
      
      // Convert selected channels to target_channel format
      const targetChannel = values.selected_channels.length === 3 ? "all" : 
        values.selected_channels.length === 1 ? values.selected_channels[0] : "all";
      
      const result = await createCampaign.mutateAsync({
        name: values.name,
        prompt: values.prompt,
        description: values.description,
        start_date: format(start, "yyyy-MM-dd"),
        end_date: format(end, "yyyy-MM-dd"),
        days_of_week: [0, 1, 2, 3, 4, 5, 6],
        target_channel: targetChannel,
        // Store selected channels in metadata for later use
        metadata: { selected_channels: values.selected_channels },
      });
      form.reset();
      setStep("channel");
      onOpenChange(false);
      onSuccess?.(result);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleOpenChange = (open: boolean) => {
    if (!open) {
      form.reset();
      setStep("channel");
    }
    onOpenChange(open);
  };

  const getSelectedChannelLabels = () => {
    return selectedChannels.map(id => CHANNELS.find(c => c.id === id)?.label).filter(Boolean).join(", ");
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[600px]">
        {step === "channel" ? (
          <>
            <DialogHeader>
              <DialogTitle>Nova Campanha de Conteúdo</DialogTitle>
              <DialogDescription>
                Selecione os canais para sua campanha. Você pode escolher um ou mais.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              <div className="flex justify-end">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={selectAllChannels}
                >
                  Selecionar todos
                </Button>
              </div>
              
              <div className="grid grid-cols-3 gap-4">
                {CHANNELS.map((channel) => {
                  const Icon = channel.icon;
                  const isSelected = selectedChannels.includes(channel.id);
                  return (
                    <button
                      key={channel.id}
                      type="button"
                      onClick={() => toggleChannel(channel.id)}
                      className={cn(
                        "relative flex flex-col items-center gap-3 p-6 rounded-lg border-2 transition-all",
                        "hover:border-primary hover:bg-primary/5",
                        "focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2",
                        isSelected && "border-primary bg-primary/10"
                      )}
                    >
                      {isSelected && (
                        <div className="absolute top-2 right-2 h-5 w-5 rounded-full bg-primary flex items-center justify-center">
                          <Check className="h-3 w-3 text-primary-foreground" />
                        </div>
                      )}
                      <Icon className={cn("h-10 w-10", isSelected ? "text-primary" : "text-muted-foreground")} />
                      <div className="text-center">
                        <p className={cn("font-medium", isSelected && "text-primary")}>{channel.label}</p>
                        <p className="text-xs text-muted-foreground mt-1">
                          {channel.description}
                        </p>
                      </div>
                    </button>
                  );
                })}
              </div>

              {selectedChannels.length > 0 && (
                <p className="text-sm text-muted-foreground text-center">
                  Selecionados: <span className="font-medium text-foreground">{getSelectedChannelLabels()}</span>
                </p>
              )}
            </div>

            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => handleOpenChange(false)}>
                Cancelar
              </Button>
              <Button 
                type="button" 
                onClick={handleContinue}
                disabled={selectedChannels.length === 0}
              >
                Continuar
              </Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                Nova Campanha - {getSelectedChannelLabels()}
              </DialogTitle>
              <DialogDescription>
                Defina o objetivo da sua campanha e o período. A IA vai gerar sugestões de conteúdo para cada dia.
              </DialogDescription>
            </DialogHeader>

            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Nome da campanha</FormLabel>
                      <FormControl>
                        <Input placeholder="Ex: Campanha de Janeiro" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="prompt"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Direcionamento da campanha</FormLabel>
                      <FormControl>
                        <Textarea 
                          placeholder={
                            selectedChannels.includes("blog")
                              ? "Ex: Série de artigos sobre cuidados masculinos, tom informativo e profissional, destacar benefícios dos produtos..."
                              : "Ex: Campanha de Natal com foco em presentes masculinos, tom premium, destacar produtos X e Y, CTA para WhatsApp..."
                          }
                          className="min-h-[100px]"
                          {...field} 
                        />
                      </FormControl>
                      <FormDescription>
                        A IA vai usar as informações da sua loja (produtos, categorias, promoções) automaticamente. Aqui você define apenas o direcionamento específico desta campanha.
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="selectedPeriod"
                  render={({ field }) => {
                    const periodInfo = getPeriodDates(field.value);
                    return (
                      <FormItem>
                        <FormLabel>Período da campanha</FormLabel>
                        <div className="grid grid-cols-2 gap-3">
                          <button
                            type="button"
                            onClick={() => field.onChange("current")}
                            className={cn(
                              "flex flex-col items-center gap-2 p-4 rounded-lg border-2 transition-all",
                              "hover:border-primary hover:bg-primary/5",
                              field.value === "current" && "border-primary bg-primary/10"
                            )}
                          >
                            <CalendarDays className={cn("h-6 w-6", field.value === "current" ? "text-primary" : "text-muted-foreground")} />
                            <span className={cn("font-medium", field.value === "current" && "text-primary")}>Este mês</span>
                            <span className="text-xs text-muted-foreground">
                              {format(startOfMonth(new Date()), "MMMM yyyy", { locale: ptBR })}
                            </span>
                          </button>
                          <button
                            type="button"
                            onClick={() => field.onChange("next")}
                            className={cn(
                              "flex flex-col items-center gap-2 p-4 rounded-lg border-2 transition-all",
                              "hover:border-primary hover:bg-primary/5",
                              field.value === "next" && "border-primary bg-primary/10"
                            )}
                          >
                            <CalendarDays className={cn("h-6 w-6", field.value === "next" ? "text-primary" : "text-muted-foreground")} />
                            <span className={cn("font-medium", field.value === "next" && "text-primary")}>Próximo mês</span>
                            <span className="text-xs text-muted-foreground">
                              {format(addMonths(new Date(), 1), "MMMM yyyy", { locale: ptBR })}
                            </span>
                          </button>
                        </div>
                        <FormDescription>
                          Período: {format(periodInfo.start, "dd/MM", { locale: ptBR })} até {format(periodInfo.end, "dd/MM/yyyy", { locale: ptBR })}. 
                          Você poderá ajustar os dias individualmente no calendário após criar a campanha.
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    );
                  }}
                />

                <DialogFooter className="gap-2">
                  <Button type="button" variant="outline" onClick={handleBack}>
                    Voltar
                  </Button>
                  <Button type="button" variant="ghost" onClick={() => handleOpenChange(false)}>
                    Cancelar
                  </Button>
                  <Button type="submit" disabled={isSubmitting}>
                    {isSubmitting ? "Criando..." : "Criar Campanha"}
                  </Button>
                </DialogFooter>
              </form>
            </Form>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
