/**
 * ============================================================
 * TIPOS DE TOAST / NOTIFICAÇÕES
 * ============================================================
 */

export type ToastType = 'success' | 'error' | 'info' | 'warning';

export interface ToastMessage {
  id: string;
  title?: string;
  message: string;
  type: ToastType;
  duration?: number; // Tempo em milissegundos (padrão: 3500ms)
}

export interface GameNotificationLog {
  id: string;
  title: string;
  message: string;
  type: ToastType;
  dateString?: string; // Ex: "15 de Novembro, 1444"
  timestamp: number;
  read: boolean;
}
