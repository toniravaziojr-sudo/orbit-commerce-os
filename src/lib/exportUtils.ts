import { format } from "date-fns";

export function exportToCSV<T extends Record<string, any>>(
  data: T[],
  columns: { key: keyof T; label: string; format?: (value: any, row: T) => string }[],
  filename: string
) {
  if (data.length === 0) {
    return;
  }

  // Build CSV header
  const header = columns.map(col => `"${col.label}"`).join(';');

  // Build CSV rows
  const rows = data.map(row => {
    return columns.map(col => {
      const value = col.format ? col.format(row[col.key], row) : row[col.key];
      const stringValue = value == null ? '' : String(value);
      // Escape quotes and wrap in quotes
      return `"${stringValue.replace(/"/g, '""')}"`;
    }).join(';');
  });

  const csvContent = [header, ...rows].join('\n');
  
  // Add BOM for Excel compatibility with UTF-8
  const BOM = '\uFEFF';
  const blob = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8;' });
  
  downloadBlob(blob, `${filename}.csv`);
}

export function exportToExcel<T extends Record<string, any>>(
  data: T[],
  columns: { key: keyof T; label: string; format?: (value: any, row: T) => string }[],
  filename: string
) {
  if (data.length === 0) {
    return;
  }

  // For simplicity, we'll create a TSV (Tab-Separated Values) which Excel opens natively
  // This avoids needing a heavy Excel library
  
  // Build header
  const header = columns.map(col => col.label).join('\t');

  // Build rows
  const rows = data.map(row => {
    return columns.map(col => {
      const value = col.format ? col.format(row[col.key], row) : row[col.key];
      const stringValue = value == null ? '' : String(value);
      // Remove tabs and newlines for TSV compatibility
      return stringValue.replace(/[\t\n\r]/g, ' ');
    }).join('\t');
  });

  const tsvContent = [header, ...rows].join('\n');
  
  // Add BOM for Excel compatibility with UTF-8
  const BOM = '\uFEFF';
  const blob = new Blob([BOM + tsvContent], { type: 'application/vnd.ms-excel;charset=utf-8;' });
  
  downloadBlob(blob, `${filename}.xls`);
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function formatDateForExport(dateString: string | null | undefined): string {
  if (!dateString) return '';
  try {
    return format(new Date(dateString), 'dd/MM/yyyy');
  } catch {
    return '';
  }
}

export function formatCurrencyForExport(value: number | null | undefined): string {
  if (value == null) return 'R$ 0,00';
  return `R$ ${Number(value).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;
}
