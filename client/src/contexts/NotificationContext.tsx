import React, { createContext, useContext, ReactNode } from 'react';
import { useNotification, NotificationData } from '@/hooks/useNotification';

interface NotificationContextType {
  showNotification: (notification: Omit<NotificationData, 'id'>) => void;
  removeNotification: (id: string) => void;
  showSuccess: (title: string, message?: string, duration?: number) => void;
  showError: (title: string, message?: string, duration?: number) => void;
  notifications: NotificationData[];
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

interface NotificationProviderProps {
  children: ReactNode;
}

export const NotificationProvider: React.FC<NotificationProviderProps> = ({ children }) => {
  const notificationHook = useNotification();

  return (
    <NotificationContext.Provider value={notificationHook}>
      {children}
    </NotificationContext.Provider>
  );
};

export const useNotify = (): NotificationContextType => {
  const context = useContext(NotificationContext);
  if (context === undefined) {
    throw new Error('useNotify must be used within a NotificationProvider');
  }
  return context;
};
