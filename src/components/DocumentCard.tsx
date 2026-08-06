import type { Document } from '../types/document';
import {
  DOCUMENT_TYPE_LABELS,
  formatDateRo,
  getDocumentStatus,
} from '../utils/documentUtils';

interface DocumentCardProps {
  document: Document;
  onEdit: (document: Document) => void;
  onDelete: (id: string) => void;
}

export default function DocumentCard({ document, onEdit, onDelete }: DocumentCardProps) {
  const status = getDocumentStatus(document.expiryDate);
  const isCustom = document.type === 'custom';

  return (
    <div
      className="relative overflow-hidden rounded-2xl border-2 border-black bg-white p-4 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] transition-all duration-200 hover:shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] dark:border-white dark:bg-zinc-900 dark:shadow-[4px_4px_0px_0px_rgba(255,255,255,1)] dark:hover:shadow-[6px_6px_0px_0px_rgba(255,255,255,1)]"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-lg font-black text-zinc-900 dark:text-zinc-100">
            {isCustom ? document.title : DOCUMENT_TYPE_LABELS[document.type]}
          </h3>
          <p className="text-sm font-medium text-zinc-500 dark:text-zinc-400">
            Emis: {formatDateRo(document.issueDate)}
          </p>
          <p className="text-sm font-bold text-zinc-700 dark:text-zinc-300">
            Expiră: {formatDateRo(document.expiryDate)}
          </p>
          {document.notes && (
            <p className="mt-2 line-clamp-2 text-sm font-medium text-zinc-600 dark:text-zinc-400">{document.notes}</p>
          )}
        </div>

        <div
          className={`flex shrink-0 flex-col items-center rounded-xl border-2 px-3 py-2 ${status.colorClass}`}
        >
          <span className="text-xl font-black">{status.daysRemaining}</span>
          <span className="text-xs font-black uppercase tracking-wide">
            {status.daysRemaining === 1 ? 'zi' : 'zile'}
          </span>
        </div>
      </div>

      <div className="mt-4 flex items-center justify-between gap-3">
        <span
          className={`inline-flex items-center gap-1.5 rounded-full border-2 px-3 py-1 text-xs font-black uppercase tracking-wide ${status.colorClass}`}
        >
          <span>{status.icon}</span>
          {status.label}
        </span>

        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => onEdit(document)}
            className="rounded-lg border-2 border-black bg-white px-3 py-2 text-sm font-bold text-zinc-900 shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] transition-all duration-100 hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] active:translate-x-[3px] active:translate-y-[3px] active:shadow-none dark:border-white dark:bg-zinc-900 dark:text-zinc-100 dark:shadow-[3px_3px_0px_0px_rgba(255,255,255,1)] dark:hover:shadow-[2px_2px_0px_0px_rgba(255,255,255,1)]"
            aria-label="Editează"
          >
            Editează
          </button>
          <button
            type="button"
            onClick={() => onDelete(document.id)}
            className="rounded-lg border-2 border-black bg-black px-3 py-2 text-sm font-bold text-white shadow-[3px_3px_0px_0px_rgba(255,255,255,1)] transition-all duration-100 hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-[2px_2px_0px_0px_rgba(255,255,255,1)] active:translate-x-[3px] active:translate-y-[3px] active:shadow-none dark:border-white dark:bg-white dark:text-black dark:shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] dark:hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]"
            aria-label="Șterge"
          >
            Șterge
          </button>
        </div>
      </div>
    </div>
  );
}
