import { useEffect, useState } from 'react';
import type { Document, DocumentFormData, FormErrors } from '../types/document';
import {
  DOCUMENT_TYPE_LABELS,
  formatDateRo,
  generateId,
  getValidityMonths,
  calculateExpiryDate,
} from '../utils/documentUtils';

interface AddDocumentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (document: Document) => void;
  editingDocument: Document | null;
}

const EMPTY_FORM: DocumentFormData = {
  type: 'itp',
  title: '',
  issueDate: '',
  expiryDate: '',
  notes: '',
};

export default function AddDocumentModal({
  isOpen,
  onClose,
  onSave,
  editingDocument,
}: AddDocumentModalProps) {
  const [form, setForm] = useState<DocumentFormData>(EMPTY_FORM);
  const [errors, setErrors] = useState<FormErrors>({});
  const [touched, setTouched] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (isOpen) {
      if (editingDocument) {
        setForm({
          type: editingDocument.type,
          title: editingDocument.title,
          issueDate: editingDocument.issueDate,
          expiryDate: editingDocument.expiryDate,
          notes: editingDocument.notes ?? '',
        });
      } else {
        setForm(EMPTY_FORM);
      }
      setErrors({});
      setTouched({});
    }
  }, [isOpen, editingDocument]);

  // Auto-calculate expiry date when type or issue date changes
  useEffect(() => {
    if (!form.issueDate) return;

    const validityMonths = getValidityMonths(form.type);
    if (validityMonths !== null) {
      const newExpiry = calculateExpiryDate(form.issueDate, validityMonths);
      setForm((prev) => (prev.expiryDate !== newExpiry ? { ...prev, expiryDate: newExpiry } : prev));
    }
  }, [form.type, form.issueDate]);

  function validate(currentForm: DocumentFormData): FormErrors {
    const newErrors: FormErrors = {};

    if (currentForm.type === 'custom' && !currentForm.title.trim()) {
      newErrors.title = 'Numele documentului este obligatoriu pentru opțiunea custom.';
    }

    if (!currentForm.issueDate) {
      newErrors.issueDate = 'Data emiterii este obligatorie.';
    } else {
      const issueDate = new Date(currentForm.issueDate + 'T00:00:00');
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      if (issueDate.getTime() > today.getTime()) {
        newErrors.issueDate = 'Data emiterii nu poate fi în viitor.';
      }
    }

    if (!currentForm.expiryDate) {
      newErrors.expiryDate = 'Data expirării este obligatorie.';
    } else if (currentForm.issueDate) {
      const issueTime = new Date(currentForm.issueDate + 'T00:00:00').getTime();
      const expiryTime = new Date(currentForm.expiryDate + 'T00:00:00').getTime();
      if (expiryTime <= issueTime) {
        newErrors.expiryDate = 'Data expirării trebuie să fie ulterioară datei emiterii.';
      }
    }

    return newErrors;
  }

  function handleChange(field: keyof DocumentFormData, value: string) {
    setForm((prev) => {
      const next = { ...prev, [field]: value };
      // Auto-clear title when switching away from custom
      if (field === 'type' && value !== 'custom') {
        next.title = '';
      }
      setErrors(validate(next));
      return next;
    });
  }

  function handleBlur(field: keyof DocumentFormData) {
    setTouched((prev) => ({ ...prev, [field]: true }));
    setErrors(validate(form));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const validationErrors = validate(form);
    setTouched({
      type: true,
      title: true,
      issueDate: true,
      expiryDate: true,
    });

    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      return;
    }

    const now = Date.now();
    const documentToSave: Document = {
      id: editingDocument?.id ?? generateId(),
      type: form.type,
      title: form.type === 'custom' ? form.title.trim() : DOCUMENT_TYPE_LABELS[form.type],
      issueDate: form.issueDate,
      expiryDate: form.expiryDate,
      notes: form.notes.trim() || undefined,
      createdAt: editingDocument?.createdAt ?? now,
      updatedAt: now,
    };

    onSave(documentToSave);
    onClose();
  }

  if (!isOpen) return null;

  const isCustom = form.type === 'custom';

  const inputBaseClass =
    'w-full rounded-xl border-2 bg-white px-3 py-2.5 text-zinc-900 outline-none transition-colors focus:ring-2 focus:ring-zinc-400 sm:px-4 sm:py-3 dark:bg-zinc-900 dark:text-zinc-100 dark:focus:ring-zinc-600';
  const dateInputClass =
    'w-full max-w-full min-w-0 box-border block appearance-none m-0 flex-1';
  const inputErrorClass =
    'border-black focus:border-black dark:border-white dark:focus:border-white';
  const inputNormalClass =
    'border-zinc-900 focus:border-zinc-900 dark:border-zinc-100 dark:focus:border-zinc-100';

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 animate-fade-in"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
    >
      <div
        className="flex w-[90%] max-w-[340px] flex-col overflow-hidden rounded-2xl border-2 border-black bg-white p-4 shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] animate-slide-up dark:border-white dark:bg-zinc-900 dark:shadow-[6px_6px_0px_0px_rgba(255,255,255,1)] max-h-[85vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex shrink-0 items-center justify-between sm:mb-4">
          <h2 id="modal-title" className="text-lg font-black text-zinc-900 dark:text-zinc-100 sm:text-xl">
            {editingDocument ? 'Editează document' : 'Adaugă document'}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border-2 border-black bg-white p-1.5 text-zinc-900 shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] transition-all duration-100 hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] active:translate-x-[3px] active:translate-y-[3px] active:shadow-none dark:border-white dark:bg-zinc-900 dark:text-zinc-100 dark:shadow-[3px_3px_0px_0px_rgba(255,255,255,1)] dark:hover:shadow-[2px_2px_0px_0px_rgba(255,255,255,1)] sm:p-2"
            aria-label="Închide"
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col">
          <div className="space-y-3 sm:space-y-4">
            <div>
              <label htmlFor="type" className="mb-1 block text-xs font-black uppercase tracking-wide text-zinc-900 dark:text-zinc-100 sm:text-sm">
                Tip document
              </label>
              <select
                id="type"
                value={form.type}
                onChange={(e) => handleChange('type', e.target.value)}
                onBlur={() => handleBlur('type')}
                className={`${inputBaseClass} ${inputNormalClass}`}
              >
                {Object.entries(DOCUMENT_TYPE_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </div>

            {isCustom && (
              <div>
                <label htmlFor="title" className="mb-1 block text-xs font-black uppercase tracking-wide text-zinc-900 dark:text-zinc-100 sm:text-sm">
                  Nume document
                </label>
                <input
                  id="title"
                  type="text"
                  value={form.title}
                  onChange={(e) => handleChange('title', e.target.value)}
                  onBlur={() => handleBlur('title')}
                  placeholder="Ex: Contract de muncă"
                  className={`${inputBaseClass} ${errors.title && touched.title ? inputErrorClass : inputNormalClass}`}
                />
                {errors.title && touched.title && (
                  <p className="mt-1 text-sm font-bold text-zinc-900 dark:text-zinc-100">{errors.title}</p>
                )}
              </div>
            )}

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4">
              <div className="w-full max-w-full overflow-hidden flex flex-col">
                <label htmlFor="issueDate" className="mb-1 block text-xs font-black uppercase tracking-wide text-zinc-900 dark:text-zinc-100 sm:text-sm">
                  Data emiterii/efectuării
                </label>
                <input
                  id="issueDate"
                  type="date"
                  value={form.issueDate}
                  onChange={(e) => handleChange('issueDate', e.target.value)}
                  onBlur={() => handleBlur('issueDate')}
                  className={`${inputBaseClass} ${dateInputClass} ${errors.issueDate && touched.issueDate ? inputErrorClass : inputNormalClass}`}
                />
                {errors.issueDate && touched.issueDate && (
                  <p className="mt-1 text-sm font-bold text-zinc-900 dark:text-zinc-100">{errors.issueDate}</p>
                )}
              </div>

              <div className="w-full max-w-full overflow-hidden flex flex-col">
                <label htmlFor="expiryDate" className="mb-1 block text-xs font-black uppercase tracking-wide text-zinc-900 dark:text-zinc-100 sm:text-sm">
                  Data expirării
                </label>
                <input
                  id="expiryDate"
                  type="date"
                  value={form.expiryDate}
                  onChange={(e) => handleChange('expiryDate', e.target.value)}
                  onBlur={() => handleBlur('expiryDate')}
                  className={`${inputBaseClass} ${dateInputClass} ${errors.expiryDate && touched.expiryDate ? inputErrorClass : inputNormalClass}`}
                />
                {errors.expiryDate && touched.expiryDate && (
                  <p className="mt-1 text-sm font-bold text-zinc-900 dark:text-zinc-100">{errors.expiryDate}</p>
                )}
              </div>
            </div>

            {form.issueDate && form.expiryDate && !errors.expiryDate && !errors.issueDate && (
              <p className="text-sm font-bold text-zinc-600 dark:text-zinc-400">
                Valabilitate: {formatDateRo(form.issueDate)} → {formatDateRo(form.expiryDate)}
              </p>
            )}

            <div>
              <label htmlFor="notes" className="mb-1 block text-xs font-black uppercase tracking-wide text-zinc-900 dark:text-zinc-100 sm:text-sm">
                Note (opțional)
              </label>
              <textarea
                id="notes"
                value={form.notes}
                onChange={(e) => handleChange('notes', e.target.value)}
                rows={3}
                placeholder="Observații, contacte, costuri..."
                className={`${inputBaseClass} ${inputNormalClass}`}
              />
            </div>
          </div>

          <div className="flex shrink-0 gap-3 pt-3 sm:pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-xl border-2 border-black bg-white px-3 py-2.5 font-black uppercase tracking-wide text-zinc-900 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] transition-all duration-100 hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] active:translate-x-[4px] active:translate-y-[4px] active:shadow-none dark:border-white dark:bg-zinc-900 dark:text-zinc-100 dark:shadow-[4px_4px_0px_0px_rgba(255,255,255,1)] dark:hover:shadow-[2px_2px_0px_0px_rgba(255,255,255,1)] sm:px-4 sm:py-3"
            >
              Anulează
            </button>
            <button
              type="submit"
              className="flex-1 rounded-xl border-2 border-black bg-black px-3 py-2.5 font-black uppercase tracking-wide text-white shadow-[4px_4px_0px_0px_rgba(255,255,255,1)] transition-all duration-100 hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[2px_2px_0px_0px_rgba(255,255,255,1)] active:translate-x-[4px] active:translate-y-[4px] active:shadow-none dark:border-white dark:bg-white dark:text-black dark:shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] dark:hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] sm:px-4 sm:py-3"
            >
              {editingDocument ? 'Salvează' : 'Adaugă'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
