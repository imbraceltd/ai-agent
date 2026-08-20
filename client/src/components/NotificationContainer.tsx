import React from 'react';
import { Box } from '@mui/material';
import Notification from './Notification';
import { useNotify } from '@/contexts/NotificationContext';

const NotificationContainer: React.FC = () => {
  const { notifications, removeNotification } = useNotify();

  return (
    <Box
      sx={{
        position: 'fixed',
        top: 0,
        right: 0,
        zIndex: 9999,
        pointerEvents: 'none',
      }}
    >
      {notifications.map((notification, index) => (
        <Box
          key={notification.id}
          sx={{
            pointerEvents: 'auto',
            marginBottom: 1,
            transform: `translateY(${index * 80}px)`,
          }}
        >
          <Notification
            {...notification}
            onClose={removeNotification}
          />
        </Box>
      ))}
    </Box>
  );
};

export default NotificationContainer;
