export function toCSV(rows: Record<string, any>[]): string {
  if (rows.length === 0) return '';
  
  // Get headers from first row
  const headers = Object.keys(rows[0]);
  
  // Escape a field value for CSV
  const escapeField = (value: any): string => {
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
