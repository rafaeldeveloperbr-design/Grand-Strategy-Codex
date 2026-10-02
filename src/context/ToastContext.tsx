/**
 * ============================================================
 * CONTEXT / GERENCIADOR DE TOASTS
 * ============================================================
 * Sistema global de notificações temporárias e histórico persistente
 */

import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import { ToastMessage, ToastType, GameNotificationLog } from '../types/toast';

export type { ToastType }; // <- adiciona isso

export interface ToastContextType {
  toasts: ToastMessage[];
  notificationHistory: GameNotificationLog[];
  unreadCount: number;
  addToast: (message: string, type?: ToastType, title?: string, dateString?: string, duration?: number) => void;
  removeToast: (id: string) => void;
  markAllAsRead: () => void;
  clearHistory: () => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export const ToastProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const [notificationHistory, setNotificationHistory] = useState<GameNotificationLog[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);

  const addToast = useCallback((
    message: string, 
    type: ToastType = 'info', 
    title?: string, 
    dateString?: string,
    duration: number = 3500
  ) => {
    const id = `toast_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`;
    
    // Adiciona ao toast temporário
    const newToast: ToastMessage = {
      id,
      message,
      type,
      title,
      duration,
    };

    setToasts(prev => [...prev, newToast]);

    // Adiciona ao histórico persistente
    const newNotification: GameNotificationLog = {
      id,
      title: title || 'Aviso',
      message,
      type,
      dateString,
      timestamp: Date.now(),
      read: false,
    };

    setNotificationHistory(prev => [newNotification, ...prev]);
    setUnreadCount(prev => prev + 1);

    // Auto-remove após o tempo estipulado
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, duration);
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  const markAllAsRead = useCallback(() => {
    setUnreadCount(0);
    setNotificationHistory(prev => prev.map(n => ({ ...n, read: true })));
  }, []);

  const clearHistory = useCallback(() => {
    setNotificationHistory([]);
    setUnreadCount(0);
  }, []);

  return (
    <ToastContext.Provider value={{ 
      toasts, 
      notificationHistory, 
      unreadCount,
      addToast, 
      removeToast,
      markAllAsRead,
      clearHistory 
    }}>
      {children}
    </ToastContext.Provider>
  );
};

export const useToast = (): ToastContextType => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
};
