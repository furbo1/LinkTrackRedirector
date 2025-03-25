/**
 * Format a date string or Date object into a readable format
 */
export function formatDate(dateString: string | Date): string {
  const date = typeof dateString === 'string' ? new Date(dateString) : dateString;
  const options: Intl.DateTimeFormatOptions = { 
    year: 'numeric', 
    month: 'short', 
    day: 'numeric' 
  };
  return date.toLocaleDateString(undefined, options);
}

/**
 * Format a number to include commas for thousands
 */
export function formatNumber(num: number): string {
  return num.toLocaleString();
}

/**
 * Truncate a string to a certain length and add ellipsis
 */
export function truncateString(str: string, length: number = 30): string {
  if (str.length <= length) return str;
  return str.slice(0, length) + '...';
}
