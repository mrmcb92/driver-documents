export type DocumentType =
  | 'medical-visit'
  | 'psychological'
  | 'itp'
  | 'rca'
  | 'conformity-copy'
  | 'criminal-record'
  | 'professional-cert'
  | 'casco'
  | 'onrc-excerpt'
  | 'custom';

export interface Document {
  id: string;
  type: DocumentType;
  title: string;
  issueDate: string; // ISO date (YYYY-MM-DD)
  expiryDate: string; // ISO date (YYYY-MM-DD)
  notes?: string;
  createdAt: number;
  updatedAt: number;
}

export interface DocumentFormData {
  type: DocumentType;
  title: string;
  issueDate: string;
  expiryDate: string;
  notes: string;
}

export type DocumentStatus = 'valid' | 'attention' | 'critical' | 'expired';

export interface DocumentStatusInfo {
  status: DocumentStatus;
  daysRemaining: number;
  label: string;
  colorClass: string;
  borderClass: string;
  icon: string;
}

export interface FormErrors {
  type?: string;
  title?: string;
  issueDate?: string;
  expiryDate?: string;
}
