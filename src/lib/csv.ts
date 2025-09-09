// CSV row interfaces for lot and media data
export interface CsvLotRow {
  lotId: string;
  auctionId: string;
  auctionName: string;
  lotNumber: string;
  status: string;
  createdAt: string;
  [key: string]: string | number | boolean | null | undefined;
}

export interface CsvMediaRow {
  lotId: string;
  kind: 'photo' | 'audio';
  r2Key?: string;
  bytes?: number;
  width?: number;
  height?: number;
  duration?: number;
  indexInLot: number;
  [key: string]: string | number | boolean | null | undefined;
}

// Generic CSV row type that can be either lot or media data
export type CsvRow = CsvLotRow | CsvMediaRow;

export function toCSV(rows: CsvRow[]): string {
  if (rows.length === 0) return '';
  
  // Get headers from first row
  const headers = Object.keys(rows[0]);
  
  // Escape a field value for CSV
  const escapeField = (value: string | number | boolean | null | undefined): string => {
    if (value === null || value === undefined) return '';
    
    const str = String(value);
    
    // Check if field needs quoting (contains comma, quote, or newline)
    if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
      // Escape quotes by doubling them and wrap in quotes
      return `"${str.replace(/"/g, '""')}"`;
    }
    
    return str;
  };
  
  // Build CSV rows
  const csvRows = [];
  
  // Header row
  csvRows.push(headers.map(escapeField).join(','));
  
  // Data rows
  for (const row of rows) {
    const values = headers.map(header => escapeField(row[header]));
    csvRows.push(values.join(','));
  }
  
  // Join with CRLF
  return csvRows.join('\r\n');
}
