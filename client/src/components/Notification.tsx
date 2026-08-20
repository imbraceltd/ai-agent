import React, { useState, useEffect } from 'react';
import { Box, Typography, IconButton, Slide } from '@mui/material';
import { styled } from '@mui/material/styles';
import { CheckCircle, Error, Close } from '@mui/icons-material';

interface NotificationProps {
  id: string;
  type: 'success' | 'error';
  title: string;
  message?: string;
  duration?: number;
  onClose: (id: string) => void;
}

const NotificationContainer = styled(Box)<{ type: 'success' | 'error' }>(({ theme, type }) => ({
  position: 'fixed',
  top: 20,
  right: 20,
  zIndex: 9999,
  minWidth: 320,
  maxWidth: 400,
  backgroundColor: type === 'success' ? '#4CAF50' : '#F44336',
  color: 'white',
  borderRadius: 8,
  padding: theme.spacing(2),
  boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
  display: 'flex',
  alignItems: 'flex-start',
  gap: theme.spacing(1),
}));

const IconContainer = styled(Box)(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  marginTop: 2,
}));

const ContentContainer = styled(Box)(({ theme }) => ({
  flex: 1,
}));

const CloseButton = styled(IconButton)(({ theme }) => ({
  color: 'white',
  padding: theme.spacing(0.5),
  marginTop: -theme.spacing(0.5),
  marginRight: -theme.spacing(0.5),
  '&:hover': {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
}));

const Notification: React.FC<NotificationProps> = ({
  id,
  type,
  title,
  message,
  duration = 4000,
  onClose,
}) => {
  useEffect(() => {
    const timer = setTimeout(() => {
      onClose(id);
    }, duration);

    return () => clearTimeout(timer);
  }, [id, duration, onClose]);

  const handleClose = () => {
    onClose(id);
  };

  return (
    <Slide direction="left" in={true} mountOnEnter unmountOnExit>
      <NotificationContainer type={type}>
        <IconContainer>
          {type === 'success' ? (
            <CheckCircle sx={{ fontSize: 20 }} />
          ) : (
            <Error sx={{ fontSize: 20 }} />
          )}
        </IconContainer>
        
        <ContentContainer>
          <Typography
            variant="subtitle2"
            sx={{
              fontWeight: 600,
              fontSize: '14px',
              lineHeight: 1.2,
              marginBottom: message ? 0.5 : 0,
            }}
          >
            {title}
          </Typography>
          {message && (
            <Typography
              variant="body2"
              sx={{
                fontSize: '13px',
                lineHeight: 1.3,
                opacity: 0.9,
              }}
            >
              {message}
            </Typography>
          )}
        </ContentContainer>

        <CloseButton onClick={handleClose} size="small">
          <Close sx={{ fontSize: 16 }} />
        </CloseButton>
      </NotificationContainer>
    </Slide>
  );
};

export default Notification;
