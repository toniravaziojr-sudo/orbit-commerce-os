import { useState } from "react";
import { format, addMinutes } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CalendarIcon, Plus, Trash2, Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import { useAgendaTasks, type RecurrenceConfig } from "@/hooks/useAgendaTasks";

interface CreateTaskDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface ReminderOffset {
  id: string;
  value: number;
  unit: 'minutes' | 'hours' | 'days';
}

const PRESET_OFFSETS = [
  { label: '15 minutos antes', value: 15, unit: 'minutes' as const },
  { label: '30 minutos antes', value: 30, unit: 'minutes' as const },
  { label: '1 hora antes', value: 60, unit: 'minutes' as const },
  { label: '2 horas antes', value: 120, unit: 'minutes' as const },
  { label: '1 dia antes', value: 1440, unit: 'minutes' as const },
];

export function CreateTaskDialog({ open, onOpenChange }: CreateTaskDialogProps) {
  const { createTask, isCreating } = useAgendaTasks();
  
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [dueDate, setDueDate] = useState<Date>();
  const [dueTime, setDueTime] = useState('09:00');
  const [isRecurring, setIsRecurring] = useState(false);
  const [recurrenceType, setRecurrenceType] = useState<'daily' | 'weekly' | 'monthly'>('weekly');
  const [recurrenceInterval, setRecurrenceInterval] = useState(1);
  const [reminders, setReminders] = useState<ReminderOffset[]>([
    { id: '1', value: 1, unit: 'days' },
  ]);

  const resetForm = () => {
    setTitle('');
    setDescription('');
    setDueDate(undefined);
    setDueTime('09:00');
    setIsRecurring(false);
    setRecurrenceType('weekly');
    setRecurrenceInterval(1);
    setReminders([{ id: '1', value: 1, unit: 'days' }]);
  };

  const handleClose = () => {
    onOpenChange(false);
    resetForm();
  };

  const addReminder = () => {
    setReminders([
      ...reminders,
      { id: Date.now().toString(), value: 30, unit: 'minutes' },
    ]);
  };

  const removeReminder = (id: string) => {
    setReminders(reminders.filter(r => r.id !== id));
  };

  const updateReminder = (id: string, field: 'value' | 'unit', newValue: number | string) => {
    setReminders(reminders.map(r => 
      r.id === id 
        ? { ...r, [field]: field === 'value' ? Number(newValue) : newValue }
        : r
    ));
  };

  const offsetToMinutes = (offset: ReminderOffset): number => {
    switch (offset.unit) {
      case 'minutes': return offset.value;
      case 'hours': return offset.value * 60;
      case 'days': return offset.value * 1440;
    }
  };

  const formatOffset = (offset: ReminderOffset): string => {
    switch (offset.unit) {
      case 'minutes': return `${offset.value} minuto(s)`;
      case 'hours': return `${offset.value} hora(s)`;
      case 'days': return `${offset.value} dia(s)`;
    }
  };

  const handleSubmit = async () => {
    if (!title.trim() || !dueDate) return;

    const [hours, minutes] = dueTime.split(':').map(Number);
    const dueAt = new Date(dueDate);
    dueAt.setHours(hours, minutes, 0, 0);

    const reminderOffsets = reminders.map(offsetToMinutes);

    const recurrence: RecurrenceConfig | undefined = isRecurring
      ? { type: recurrenceType, interval: recurrenceInterval }
      : undefined;

    await createTask({
      title: title.trim(),
      description: description.trim() || undefined,
      due_at: dueAt.toISOString(),
      is_recurring: isRecurring,
      recurrence,
      reminder_offsets: reminderOffsets.length > 0 ? reminderOffsets : undefined,
    });

    handleClose();
  };

  // Calculate reminder times for preview
  const getReminderPreview = () => {
    if (!dueDate) return [];

    const [hours, minutes] = dueTime.split(':').map(Number);
    const dueAt = new Date(dueDate);
    dueAt.setHours(hours, minutes, 0, 0);

    return reminders.map(offset => {
      const offsetMinutes = offsetToMinutes(offset);
      const remindAt = addMinutes(dueAt, -offsetMinutes);
      return {
        id: offset.id,
        label: formatOffset(offset),
        time: format(remindAt, "dd/MM/yyyy 'às' HH:mm", { locale: ptBR }),
      };
    });
  };

  const reminderPreviews = getReminderPreview();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Criar Lembrete</DialogTitle>
          <DialogDescription>
            Crie uma tarefa e receba notificações via WhatsApp.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Title */}
          <div className="space-y-2">
            <Label htmlFor="title">Título *</Label>
            <Input
              id="title"
              placeholder="Ex: Comprar embalagens"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label htmlFor="description">Descrição (opcional)</Label>
            <Textarea
              id="description"
              placeholder="Detalhes adicionais..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
            />
          </div>

          {/* Due Date & Time */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Data *</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !dueDate && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {dueDate ? format(dueDate, "dd/MM/yyyy", { locale: ptBR }) : "Selecione"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={dueDate}
                    onSelect={setDueDate}
                    locale={ptBR}
                    disabled={(date) => date < new Date(new Date().setHours(0, 0, 0, 0))}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>

            <div className="space-y-2">
              <Label htmlFor="time">Horário</Label>
              <Input
                id="time"
                type="time"
                value={dueTime}
                onChange={(e) => setDueTime(e.target.value)}
              />
            </div>
          </div>

          {/* Recurrence */}
          <div className="space-y-3 rounded-lg border p-4">
            <div className="flex items-center justify-between">
              <Label htmlFor="recurring" className="cursor-pointer">Tarefa recorrente</Label>
              <Switch
                id="recurring"
                checked={isRecurring}
                onCheckedChange={setIsRecurring}
              />
            </div>

            {isRecurring && (
              <div className="flex items-center gap-2 pt-2">
                <span className="text-sm text-muted-foreground">A cada</span>
                <Input
                  type="number"
                  min={1}
                  max={365}
                  value={recurrenceInterval}
                  onChange={(e) => setRecurrenceInterval(Number(e.target.value) || 1)}
                  className="w-16"
                />
                <Select value={recurrenceType} onValueChange={(v) => setRecurrenceType(v as typeof recurrenceType)}>
                  <SelectTrigger className="w-32">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="daily">dia(s)</SelectItem>
                    <SelectItem value="weekly">semana(s)</SelectItem>
                    <SelectItem value="monthly">mês(es)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>

          {/* Reminders */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label className="flex items-center gap-2">
                <Bell className="h-4 w-4" />
                Notificações WhatsApp
              </Label>
              <Button variant="outline" size="sm" onClick={addReminder}>
                <Plus className="h-3 w-3 mr-1" />
                Adicionar
              </Button>
            </div>

            {reminders.length === 0 && (
              <p className="text-sm text-muted-foreground">
                Nenhuma notificação configurada.
              </p>
            )}

            <div className="space-y-2">
              {reminders.map((reminder) => (
                <div key={reminder.id} className="flex items-center gap-2">
                  <Input
                    type="number"
                    min={1}
                    value={reminder.value}
                    onChange={(e) => updateReminder(reminder.id, 'value', e.target.value)}
                    className="w-20"
                  />
                  <Select
                    value={reminder.unit}
                    onValueChange={(v) => updateReminder(reminder.id, 'unit', v)}
                  >
                    <SelectTrigger className="w-32">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="minutes">minuto(s)</SelectItem>
                      <SelectItem value="hours">hora(s)</SelectItem>
                      <SelectItem value="days">dia(s)</SelectItem>
                    </SelectContent>
                  </Select>
                  <span className="text-sm text-muted-foreground">antes</span>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => removeReminder(reminder.id)}
                    className="shrink-0"
                  >
                    <Trash2 className="h-4 w-4 text-muted-foreground" />
                  </Button>
                </div>
              ))}
            </div>

            {/* Preview */}
            {reminderPreviews.length > 0 && dueDate && (
              <div className="rounded-lg bg-muted/50 p-3 text-sm">
                <p className="font-medium mb-2">Você será notificado em:</p>
                <ul className="space-y-1 text-muted-foreground">
                  {reminderPreviews.map(preview => (
                    <li key={preview.id} className="flex items-center gap-2">
                      <Bell className="h-3 w-3" />
                      {preview.time} ({preview.label} antes)
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>
            Cancelar
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!title.trim() || !dueDate || isCreating}
          >
            {isCreating ? 'Criando...' : 'Criar Lembrete'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
