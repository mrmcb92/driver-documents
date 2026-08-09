import type {
  Document,
  DocumentStatusInfo,
  DocumentType,
} from '../types/document';

export const DOCUMENT_TYPE_LABELS: Record<DocumentType, string> = {
  'medical-visit': 'Vizită Medicală',
  psychological: 'Aviz Psihologic',
  itp: 'ITP (Inspecție Tehnică Periodică)',
  rca: 'Asigurare RCA',
  'conformity-copy': 'Copie Conformă',
  'criminal-record': 'Cazier Judiciar',
  'professional-cert': 'Certificat de Atestare Profesională',
  casco: 'Casco',
  'onrc-excerpt': 'Extras ONRC',
  custom: 'Alt Document (Custom)',
};

export const DEFAULT_VALIDITY_MONTHS: Partial<Record<DocumentType, number>> = {
  'medical-visit': 12,
  psychological: 12,
  itp: 12,
  rca: 12,
  'conformity-copy': 12,
  'criminal-record': 6,
  'professional-cert': 60,
  casco: 12,
  'onrc-excerpt': 12,
};

export function getValidityMonths(type: DocumentType): number | null {
  return DEFAULT_VALIDITY_MONTHS[type] ?? null;
}

export function calculateExpiryDate(issueDate: string, months: number): string {
  const [year, month, day] = issueDate.split('-').map(Number);
  // Work entirely in UTC to avoid timezone drift: in EU/Bucharest, parsing a
  // local midnight and converting via toISOString() shifts the date back a day.
  const date = new Date(Date.UTC(year, month - 1, day));
  date.setUTCMonth(date.getUTCMonth() + months);
  // Adjust for edge cases (e.g., Jan 31 + 1 month becomes Mar 3 without this)
  if (date.getUTCDate() !== day) {
    date.setUTCDate(0); // last day of previous month
  }
  return date.toISOString().split('T')[0];
}

export function calculateDaysUntilExpiry(expiryDate: string): number {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const expiry = new Date(expiryDate + 'T00:00:00');
  const diffMs = expiry.getTime() - now.getTime();
  return Math.ceil(diffMs / (1000 * 60 * 60 * 24));
}

export function getDocumentStatus(expiryDate: string): DocumentStatusInfo {
  const daysRemaining = calculateDaysUntilExpiry(expiryDate);

  if (daysRemaining < 0) {
    return {
      status: 'expired',
      daysRemaining,
      label: 'Expirat',
      // Inversat puternic: fundal negru, text alb, contur alb
      colorClass:
        'border-white bg-black text-white shadow-[2px_2px_0px_0px_rgba(255,255,255,0.5)] dark:border-black dark:bg-white dark:text-black dark:shadow-[2px_2px_0px_0px_rgba(0,0,0,0.5)]',
      icon: '✕',
    };
  }

  if (daysRemaining < 7) {
    return {
      status: 'critical',
      daysRemaining,
      label: 'Critic',
      // Negru intens pe fundal gri deschis / invers în dark
      colorClass:
        'border-black bg-zinc-200 text-zinc-950 dark:border-white dark:bg-zinc-800 dark:text-zinc-100',
      icon: '!',
    };
  }

  if (daysRemaining <= 30) {
    return {
      status: 'attention',
      daysRemaining,
      label: 'Atenție',
      // Contur și text negri pe fundal alb, cu umbră subtilă
      colorClass:
        'border-black bg-white text-zinc-900 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] dark:border-white dark:bg-zinc-900 dark:text-zinc-100 dark:shadow-[2px_2px_0px_0px_rgba(255,255,255,1)]',
      icon: '⏳',
    };
  }

  return {
    status: 'valid',
    daysRemaining,
    label: 'Valabil',
    // Stil discret, monocrom
    colorClass:
      'border-zinc-300 bg-zinc-50 text-zinc-900 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100',
    icon: '✓',
  };
}

export function sortDocumentsByUrgency(documents: Document[]): Document[] {
  return [...documents].sort((a, b) => {
    const daysA = calculateDaysUntilExpiry(a.expiryDate);
    const daysB = calculateDaysUntilExpiry(b.expiryDate);
    return daysA - daysB;
  });
}

export function formatDateRo(isoDate: string): string {
  const [year, month, day] = isoDate.split('-');
  return `${day}.${month}.${year}`;
}

export function generateId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  // Fallback RFC 4122 v4 (necesar doar pentru contexte non-securizate)
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export function getDocumentsExpiringThisMonthCount(documents: Document[]): number {
  const now = new Date();
  const currentMonth = now.getMonth();
  const currentYear = now.getFullYear();
  const todayStart = new Date(currentYear, currentMonth, now.getDate()).getTime();

  return documents.filter((doc) => {
    const expiry = new Date(doc.expiryDate + 'T00:00:00');
    return (
      expiry.getFullYear() === currentYear &&
      expiry.getMonth() === currentMonth &&
      expiry.getTime() >= todayStart
    );
  }).length;
}
