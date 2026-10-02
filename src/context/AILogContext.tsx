/**
 * ============================================================
 * CONTEXT / GERENCIADOR DE LOGS DA IA
 * ============================================================
 * Sistema global de logs de atividades da IA
 */

import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import { AILogEntry, AIActionType } from '../types/aiLog';

interface AILogContextType {
  aiLogs: AILogEntry[];
  addAILog: (
    countryName: string,
    actionType: AIActionType,
    message: string,
    dateString: string,
    countryColor?: string
  ) => void;
  clearAILogs: () => void;
}

const AILogContext = createContext<AILogContextType | undefined>(undefined);

export const AILogProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [aiLogs, setAiLogs] = useState<AILogEntry[]>([]);

  const addAILog = useCallback((
    countryName: string,
    actionType: AIActionType,
    message: string,
    dateString: string,
    countryColor?: string
  ) => {
    const newEntry: AILogEntry = {
      id: `ai_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
      countryName,
      actionType,
      message,
      dateString,
      timestamp: Date.now(),
      countryColor,
    };

    // Mantém os últimos 100 logs para não pesar a memória
    setAiLogs(prev => [newEntry, ...prev].slice(0, 100));
  }, []);

  const clearAILogs = useCallback(() => {
    setAiLogs([]);
  }, []);

  return (
    <AILogContext.Provider value={{ aiLogs, addAILog, clearAILogs }}>
      {children}
    </AILogContext.Provider>
  );
};

export const useAILog = (): AILogContextType => {
  const context = useContext(AILogContext);
  if (!context) {
    throw new Error('useAILog must be used within an AILogProvider');
  }
  return context;
};
