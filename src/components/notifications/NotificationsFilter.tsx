import { useState } from "react";
import { Search, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DateRangeFilter } from "@/components/ui/date-range-filter";
import type { NotificationsFilter as FilterType, NotificationStatus } from "@/hooks/useNotifications";

interface NotificationsFilterProps {
  filter: FilterType;
  onFilterChange: (filter: FilterType) => void;
}

const statusOptions: { value: NotificationStatus; label: string }[] = [
  { value: 'scheduled', label: 'Agendadas' },
  { value: 'retrying', label: 'Retrying' },
  { value: 'sending', label: 'Enviando' },
  { value: 'sent', label: 'Enviadas' },
  { value: 'failed', label: 'Falhas' },
  { value: 'canceled', label: 'Canceladas' },
];

const channelOptions = [
  { value: 'whatsapp', label: 'WhatsApp' },
  { value: 'email', label: 'Email' },
];

export function NotificationsFilterComponent({ filter, onFilterChange }: NotificationsFilterProps) {
  const [search, setSearch] = useState(filter.search || '');

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onFilterChange({ ...filter, search });
  };

  const handleStatusChange = (value: string) => {
    if (value === 'all') {
      onFilterChange({ ...filter, status: undefined });
    } else {
      onFilterChange({ ...filter, status: [value as NotificationStatus] });
    }
  };

  const handleChannelChange = (value: string) => {
    if (value === 'all') {
      onFilterChange({ ...filter, channel: undefined });
    } else {
      onFilterChange({ ...filter, channel: value });
    }
  };

  const handleDateRangeChange = (start?: Date, end?: Date) => {
    onFilterChange({
      ...filter,
      startDate: start?.toISOString(),
      endDate: end?.toISOString(),
    });
  };

  const clearFilters = () => {
    setSearch('');
    onFilterChange({});
  };

  const hasActiveFilters = filter.status || filter.channel || filter.search || filter.startDate;

  return (
    <div className="flex flex-wrap gap-3 items-center">
      <form onSubmit={handleSearchSubmit} className="flex gap-2">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por destinatário..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 w-[200px]"
          />
        </div>
      </form>

      <Select 
        value={filter.status?.[0] || 'all'} 
        onValueChange={handleStatusChange}
      >
        <SelectTrigger className="w-[150px]">
          <SelectValue placeholder="Status" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Todos status</SelectItem>
          {statusOptions.map(opt => (
            <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select 
        value={filter.channel || 'all'} 
        onValueChange={handleChannelChange}
      >
        <SelectTrigger className="w-[140px]">
          <SelectValue placeholder="Canal" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Todos canais</SelectItem>
          {channelOptions.map(opt => (
            <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
          ))}
        </SelectContent>
      </Select>

      <DateRangeFilter
        startDate={filter.startDate ? new Date(filter.startDate) : undefined}
        endDate={filter.endDate ? new Date(filter.endDate) : undefined}
        onChange={handleDateRangeChange}
      />

      {hasActiveFilters && (
        <Button variant="ghost" size="sm" onClick={clearFilters} className="gap-1">
          <X className="h-4 w-4" />
          Limpar
        </Button>
      )}
    </div>
  );
}