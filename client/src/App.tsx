import React, { useEffect } from 'react'
import { BrowserRouter as Router, Routes, Route, Link, useLocation } from 'react-router-dom'
import { Button, Card, CardContent, CardHeader, Typography, Box, ThemeProvider, createTheme, CssBaseline } from '@mui/material'

import Home from '@/pages/Home'
import SuggestedMessages from '@/pages/SuggestedMessages'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Provider } from 'react-redux';
import { store } from '@/redux/store';
import { IMBRACE_ACCESS_TOKEN, IMBRACE_ORG_ID } from '@/constants/app';
import { NotificationProvider } from '@/contexts/NotificationContext';
import NotificationContainer from '@/components/NotificationContainer';
import Chart from './pages/Chart'

// Create a Material-UI theme
const theme = createTheme({
  palette: {
    mode: 'light',
    primary: {
      main: '#1976d2',
    },
    secondary: {
      main: '#dc004e',
    },
    background: {
      default: '#f5f5f5',
      paper: '#ffffff',
    },
  },
  typography: {
    fontFamily: 'Roboto, Arial, sans-serif',
  },
  components: {
    MuiCard: {
      styleOverrides: {
        root: {
          boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
          borderRadius: 12,
        },
      },
    },
    MuiButton: {
      styleOverrides: {
        root: {
          textTransform: 'none',
          borderRadius: 8,
        },
      },
    },
  },
});



/**
 * Error Boundary Component
 * Catches JavaScript errors anywhere in the child component tree
 */
class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; error?: Error }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError(error: Error): { hasError: boolean; error: Error } {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void {
    console.error('Error Boundary caught an error:', error, errorInfo)
  }

  render(): React.ReactNode {
    if (this.state.hasError) {
      return (
        <Box
          sx={{
            minHeight: '100vh',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: '#f5f5f5'
          }}
        >
          <Card sx={{ width: 400, p: 2 }}>
            <CardHeader>
              <Typography variant="h5" color="error" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                Something went wrong
              </Typography>
              <Typography variant="body2" color="text.secondary">
                An unexpected error occurred. Please refresh the page to try again.
              </Typography>
            </CardHeader>
            <CardContent>
              <Button 
                onClick={() => window.location.reload()} 
                variant="contained"
                fullWidth
                sx={{ mb: 2 }}
              >
                Refresh Page
              </Button>
              {this.state.error && (
                <Box sx={{ mt: 2 }}>
                  <Typography variant="caption" color="text.secondary">
                    Error Details
                  </Typography>
                  <Box
                    component="pre"
                    sx={{
                      mt: 1,
                      fontSize: '0.75rem',
                      backgroundColor: '#f5f5f5',
                      p: 1,
                      borderRadius: 1,
                      overflow: 'auto'
                    }}
                  >
                    {this.state.error.message}
                  </Box>
                </Box>
              )}
            </CardContent>
          </Card>
        </Box>
      )
    }

    return this.props.children
  }
}


export const queryClient = new QueryClient();

/**
 * Component to handle token extraction from URL parameters
 */
const TokenHandler: React.FC = () => {
  useEffect(() => {
    // Get token from URL parameters
    const urlParams = new URLSearchParams(window.location.search);
    const token = urlParams.get('token');
    const orgId = urlParams.get('organizationId');
    if (orgId) {
      localStorage.setItem(IMBRACE_ORG_ID, orgId);
      console.log('Organization ID saved to localStorage:', orgId);
    }
    if (token) {
      // Save token to localStorage
      localStorage.setItem(IMBRACE_ACCESS_TOKEN, token);
      console.log('Token saved to localStorage:', token);
      
      // Optional: Remove token from URL to clean up the address bar
      const newUrl = new URL(window.location.href);
      newUrl.searchParams.delete('token');
      window.history.replaceState({}, '', newUrl.toString());
    }
  }, []);

  return null; // This component doesn't render anything
};

/**
 * Main Application Component
 */
const App: React.FC = () => {
  
  
  return (
    <Provider store={store}>
      <QueryClientProvider client={queryClient}>
        <ThemeProvider theme={theme}>
          <CssBaseline />
          <NotificationProvider>
            <TokenHandler />
            <ErrorBoundary>
              <Router>
                <Routes>
                  <Route path="/" element={<Home />} />
                  <Route path="/suggested-messages" element={<SuggestedMessages />} />
                  <Route path="/chart" element={<Chart />} />
                </Routes>
              </Router>
            </ErrorBoundary>
            <NotificationContainer />
          </NotificationProvider>
        </ThemeProvider>
      </QueryClientProvider>
    </Provider>
  )
}

export default App