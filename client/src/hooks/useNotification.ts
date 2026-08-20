import { useState, useCallback } from 'react';

export interface NotificationData {
  id: string;
  type: 'success' | 'error';
  title: string;
  message?: string;
  duration?: number;
}

export const useNotification = () => {
  const [notifications, setNotifications] = useState<NotificationData[]>([]);

  const showNotification = useCallback((notification: Omit<NotificationData, 'id'>) => {
    const id = `notification-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const newNotification: NotificationData = {
      id,
      ...notification,
    };

    setNotifications(prev => [...prev, newNotification]);
  }, []);

  const removeNotification = useCallback((id: string) => {
    setNotifications(prev => prev.filter(notification => notification.id !== id));
  }, []);

  const showSuccess = useCallback((title: string, message?: string, duration?: number) => {
    showNotification({ type: 'success', title, message, duration });
  }, [showNotification]);

  const showError = useCallback((title: string, message?: string, duration?: number) => {
    showNotification({ type: 'error', title, message, duration });
  }, [showNotification]);

  return {
    notifications,
    showNotification,
    removeNotification,
    showSuccess,
    showError,
  };
};
