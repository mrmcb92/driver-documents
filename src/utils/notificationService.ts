import type { Document } from '../types/document';
import { calculateDaysUntilExpiry, sortDocumentsByUrgency } from './documentUtils';

const NOTIFICATION_CACHE_KEY = 'driver-docs-notification-cache';
const NOTIFICATION_ENABLED_KEY = 'driver-docs-notifications-enabled';

interface NotificationCache {
  [documentId: string]: string; // ISO date of last notification sent
}

export function getNotificationCache(): NotificationCache {
  try {
    const raw = localStorage.getItem(NOTIFICATION_CACHE_KEY);
    return raw ? (JSON.parse(raw) as NotificationCache) : {};
  } catch {
    return {};
  }
}

function setNotificationCache(cache: NotificationCache): void {
  localStorage.setItem(NOTIFICATION_CACHE_KEY, JSON.stringify(cache));
}

export function areNotificationsEnabled(): boolean {
  return localStorage.getItem(NOTIFICATION_ENABLED_KEY) === 'true';
}

export function setNotificationsEnabled(enabled: boolean): void {
  localStorage.setItem(NOTIFICATION_ENABLED_KEY, String(enabled));
}

export async function requestNotificationPermission(): Promise<NotificationPermission> {
  if (!('Notification' in window)) {
    throw new Error('Browser-ul tău nu suportă notificări native.');
  }

  const permission = await Notification.requestPermission();

  if (permission === 'granted') {
    setNotificationsEnabled(true);
  } else {
    setNotificationsEnabled(false);
  }

  return permission;
}

export function getNotificationPermission(): NotificationPermission | null {
  if (!('Notification' in window)) return null;
  return Notification.permission;
}

/**
 * Today's date as YYYY-MM-DD in LOCAL time.
 * Never use toISOString(): it returns the UTC day, which is wrong between
 * midnight and +3h in Europe/Bucharest and would re-send or skip
 * notifications at the day boundary.
 */
function getLocalToday(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function shouldNotifyToday(cache: NotificationCache, documentId: string): boolean {
  const today = getLocalToday();
  return cache[documentId] !== today;
}

function buildNotificationBody(document: Document, daysRemaining: number): string {
  if (daysRemaining < 0) {
    return `"${document.title}" a expirat acum ${Math.abs(daysRemaining)} zile.`;
  }
  if (daysRemaining === 0) {
    return `"${document.title}" expiră astăzi.`;
  }
  if (daysRemaining <= 7) {
    return `"${document.title}" expiră în ${daysRemaining} zile. Reînnoiește-l urgent!`;
  }
  return `"${document.title}" expiră în ${daysRemaining} zile.`;
}

export async function sendNativeNotification(document: Document, daysRemaining: number): Promise<void> {
  if (!('Notification' in window) || Notification.permission !== 'granted') return;

  const title = daysRemaining < 0 ? 'Document Expirat' : 'Document care expiră curând';
  const body = buildNotificationBody(document, daysRemaining);
  const options: NotificationOptions = {
    body,
    icon: '/icon-192x192.png',
    badge: '/icon-192x192.png',
    tag: document.id,
  };

  // Prefer the service worker registration: it can show notifications even if
  // the page is in the background on Android Chrome. Fall back to the direct
  // constructor when no registration is active yet.
  const registration = 'serviceWorker' in navigator ? await navigator.serviceWorker.getRegistration() : undefined;
  if (registration) {
    await registration.showNotification(title, options);
  } else {
    new Notification(title, options);
  }
}

export async function checkAndSendNotifications(documents: Document[]): Promise<Document[]> {
  if (
    !('Notification' in window) ||
    Notification.permission !== 'granted' ||
    !areNotificationsEnabled()
  ) {
    return [];
  }

  const cache = getNotificationCache();
  const today = getLocalToday();
  const notifiedDocuments: Document[] = [];

  // Sort by urgency so the most critical documents are sent first. Each send
  // is awaited: only mark the daily cache entry when the send actually
  // succeeded, so a transient failure does not suppress the next attempt.
  const sorted = sortDocumentsByUrgency(documents);
  for (const doc of sorted) {
    const daysRemaining = calculateDaysUntilExpiry(doc.expiryDate);

    if (daysRemaining <= 30 && shouldNotifyToday(cache, doc.id)) {
      try {
        await sendNativeNotification(doc, daysRemaining);
        cache[doc.id] = today;
        notifiedDocuments.push(doc);
      } catch {
        // Keep going with the remaining documents; failed sends retry tomorrow.
      }
    }
  }

  setNotificationCache(cache);
  return notifiedDocuments;
}

export function clearNotificationCacheForDocument(documentId: string): void {
  const cache = getNotificationCache();
  delete cache[documentId];
  setNotificationCache(cache);
}
