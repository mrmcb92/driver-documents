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

function shouldNotifyToday(cache: NotificationCache, documentId: string): boolean {
  const today = new Date().toISOString().split('T')[0];
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

export function sendNativeNotification(document: Document, daysRemaining: number): void {
  if (!('Notification' in window) || Notification.permission !== 'granted') return;

  const title = daysRemaining < 0 ? 'Document Expirat' : 'Document care expiră curând';
  const body = buildNotificationBody(document, daysRemaining);

  try {
    // Try service worker notification first (works when app is in background on supported devices)
    if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
      navigator.serviceWorker.controller.postMessage({
        type: 'SHOW_NOTIFICATION',
        title,
        body,
        data: { documentId: document.id },
      });
    } else {
      new Notification(title, {
        body,
        icon: '/icon-192x192.png',
        badge: '/icon-192x192.png',
        tag: document.id,
      });
    }
  } catch {
    // Fallback to direct Notification API
    new Notification(title, {
      body,
      icon: '/icon-192x192.png',
      badge: '/icon-192x192.png',
      tag: document.id,
    });
  }
}

export function checkAndSendNotifications(documents: Document[]): Document[] {
  if (!('Notification' in window) || Notification.permission !== 'granted') {
    return [];
  }

  const cache = getNotificationCache();
  const today = new Date().toISOString().split('T')[0];
  const notifiedDocuments: Document[] = [];

  sortDocumentsByUrgency(documents).forEach((doc) => {
    const daysRemaining = calculateDaysUntilExpiry(doc.expiryDate);

    // Notify if expired or expiring within 30 days
    if (daysRemaining <= 30 && shouldNotifyToday(cache, doc.id)) {
      sendNativeNotification(doc, daysRemaining);
      cache[doc.id] = today;
      notifiedDocuments.push(doc);
    }
  });

  setNotificationCache(cache);
  return notifiedDocuments;
}

export function clearNotificationCacheForDocument(documentId: string): void {
  const cache = getNotificationCache();
  delete cache[documentId];
  setNotificationCache(cache);
}
