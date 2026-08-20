import React, { useState, useEffect } from 'react'
import {
  Box,
  Button,
  Card,
  CardContent,
  CardHeader,
  Container,
  Grid,
  Typography,
  CircularProgress,
  Chip,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Paper,
  Divider,
  Alert,
  AlertTitle,
  IconButton,
  useTheme
} from '@mui/material'
import {
  MonitorHeart as Activity,
  Storage as Server,
  Schedule,
  Memory,
  FlashOn as Flash,
  Error as ErrorIcon,
  CheckCircle,
  Refresh,
  OpenInNew,
  BugReport
} from '@mui/icons-material'
import { healthCheck, formatUptime, formatBytes, type HealthCheckResponse, type ApiResponse } from '@/lib/utils'

/**
 * Health Status Component
 * Displays server health information with real-time updates
 */
const HealthStatus: React.FC = () => {
  const theme = useTheme()
  const [healthData, setHealthData] = useState<HealthCheckResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)

  const fetchHealthData = async (detailed = false): Promise<void> => {
    try {
      setLoading(true)
      setError(null)
      
      const response: ApiResponse<HealthCheckResponse> = await healthCheck(detailed)
      
      if (response.success && response.data) {
        setHealthData(response.data)
        setLastUpdated(new Date())
      } else {
        setError(response.error || 'Failed to fetch health data')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchHealthData(true)
    
    // Auto-refresh every 30 seconds
    const interval = setInterval(() => fetchHealthData(true), 30000)
    
    return () => clearInterval(interval)
  }, [])

  if (loading && !healthData) {
    return (
      <Card>
        <CardHeader>
          <Box display="flex" alignItems="center" gap={1}>
            <Activity color="primary" />
            <Typography variant="h6" component="h2">
              Server Status
            </Typography>
          </Box>
          <Typography variant="body2" color="text.secondary">
            Loading server health information...
          </Typography>
        </CardHeader>
        <CardContent>
          <Box display="flex" flexDirection="column" gap={2}>
            <Box display="flex" alignItems="center" gap={2}>
              <CircularProgress size={20} />
              <Typography variant="body2">Fetching server status...</Typography>
            </Box>
          </Box>
        </CardContent>
      </Card>
    )
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <Box display="flex" alignItems="center" gap={1}>
            <ErrorIcon color="error" />
            <Typography variant="h6" component="h2" color="error">
              Connection Error
            </Typography>
          </Box>
          <Typography variant="body2" color="text.secondary">
            Failed to connect to the server
          </Typography>
        </CardHeader>
        <CardContent>
          <Alert severity="error" sx={{ mb: 2 }}>
            <AlertTitle>Error</AlertTitle>
            {error}
          </Alert>
          <Button 
            onClick={() => fetchHealthData(true)} 
            variant="outlined" 
            size="small"
            disabled={loading}
            startIcon={loading ? <CircularProgress size={16} /> : <Refresh />}
          >
            {loading ? 'Retrying...' : 'Retry Connection'}
          </Button>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <Box display="flex" alignItems="center" justifyContent="space-between">
          <Box display="flex" alignItems="center" gap={1}>
            <Activity color="success" />
            <Typography variant="h6" component="h2">
              Server Status
            </Typography>
          </Box>
          <Chip
            label={healthData?.status === 'ok' ? 'Healthy' : 'Error'}
            color={healthData?.status === 'ok' ? 'success' : 'error'}
            size="small"
            icon={healthData?.status === 'ok' ? <CheckCircle /> : <ErrorIcon />}
          />
        </Box>
        <Typography variant="body2" color="text.secondary">
          Real-time server health and performance metrics
        </Typography>
      </CardHeader>
      <CardContent>
        <Grid container spacing={3}>
          <Grid item xs={6}>
            <Box display="flex" alignItems="center" gap={1} mb={0.5}>
              <Schedule fontSize="small" color="action" />
              <Typography variant="body2" color="text.secondary">
                Uptime
              </Typography>
            </Box>
            <Typography variant="body1" fontWeight="medium">
              {healthData ? formatUptime(healthData.uptime) : 'N/A'}
            </Typography>
          </Grid>
          
          <Grid item xs={6}>
            <Box display="flex" alignItems="center" gap={1} mb={0.5}>
              <Server fontSize="small" color="action" />
              <Typography variant="body2" color="text.secondary">
                Environment
              </Typography>
            </Box>
            <Typography variant="body1" fontWeight="medium" sx={{ textTransform: 'capitalize' }}>
              {healthData?.environment || 'Unknown'}
            </Typography>
          </Grid>
          
          {healthData?.memory && healthData.memory.used > 0 && (
            <>
              <Grid item xs={6}>
                <Box display="flex" alignItems="center" gap={1} mb={0.5}>
                  <Memory fontSize="small" color="action" />
                  <Typography variant="body2" color="text.secondary">
                    Memory Used
                  </Typography>
                </Box>
                <Typography variant="body1" fontWeight="medium">
                  {formatBytes(healthData.memory.used * 1024 * 1024)}
                </Typography>
              </Grid>
              
              <Grid item xs={6}>
                <Box display="flex" alignItems="center" gap={1} mb={0.5}>
                  <Flash fontSize="small" color="action" />
                  <Typography variant="body2" color="text.secondary">
                    Memory Total
                  </Typography>
                </Box>
                <Typography variant="body1" fontWeight="medium">
                  {formatBytes(healthData.memory.total * 1024 * 1024)}
                </Typography>
              </Grid>
            </>
          )}
        </Grid>
        
        <Divider sx={{ my: 2 }} />
        
        <Box display="flex" alignItems="center" justifyContent="space-between">
          <Typography variant="caption" color="text.secondary">
            Last updated: {lastUpdated?.toLocaleTimeString() || 'Never'}
          </Typography>
          <Button 
            onClick={() => fetchHealthData(true)} 
            variant="text" 
            size="small"
            disabled={loading}
            startIcon={loading ? <CircularProgress size={16} /> : <Refresh />}
          >
            {loading ? 'Refreshing...' : 'Refresh'}
          </Button>
        </Box>
      </CardContent>
    </Card>
  )
}

const Home: React.FC = () => {
  const theme = useTheme()
  
  const features = [
    'TypeScript across the entire stack',
    'Express.js backend with Winston logging',
    'React frontend with Vite',
    'Material-UI components with modern design',
    'Zod validation and error handling',
    'Comprehensive testing setup'
  ]

  return (
    <Box
      sx={{
        minHeight: '100vh',
        bgcolor: 'background.default',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        py: 4
      }}
    >
      <Container maxWidth="lg">
        <Grid container spacing={3}>
          {/* Health Status Card */}
          <Grid item xs={12} lg={6}>
            <HealthStatus />
          </Grid>
          
          {/* Features Card */}
          <Grid item xs={12} lg={6}>
            <Card>
              <CardHeader>
                <Typography variant="h6" component="h2">
                  Features
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Modern full-stack development with best practices
                </Typography>
              </CardHeader>
              <CardContent>
                <List dense>
                  {features.map((feature, index) => (
                    <ListItem key={index} sx={{ px: 0, py: 0.5 }}>
                      <ListItemIcon sx={{ minWidth: 32 }}>
                        <CheckCircle color="success" fontSize="small" />
                      </ListItemIcon>
                      <ListItemText 
                        primary={feature}
                        primaryTypographyProps={{ variant: 'body2' }}
                      />
                    </ListItem>
                  ))}
                </List>
              </CardContent>
            </Card>
          </Grid>
          
          {/* Quick Actions Card */}
          <Grid item xs={12}>
            <Card>
              <CardHeader>
                <Typography variant="h6" component="h2">
                  Quick Actions
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Test the API integration and explore the application
                </Typography>
              </CardHeader>
              <CardContent>
                <Box display="flex" flexWrap="wrap" gap={1}>
                  <Button 
                    variant="outlined"
                    size="small"
                    startIcon={<OpenInNew />}
                    onClick={() => window.open('/api/health', '_blank')}
                  >
                    View API Health
                  </Button>
                  <Button 
                    variant="outlined"
                    size="small"
                    startIcon={<OpenInNew />}
                    onClick={() => window.open('/api/version', '_blank')}
                  >
                    Check Version
                  </Button>
                  <Button 
                    variant="outlined"
                    size="small"
                    onClick={() => console.log('Frontend console test')}
                  >
                    Test Console
                  </Button>
                  <Button 
                    variant="outlined"
                    size="small"
                    color="error"
                    startIcon={<BugReport />}
                    onClick={() => {
                      // Test error boundary
                      throw new Error('Test error for Error Boundary')
                    }}
                  >
                    Test Error Boundary
                  </Button>
                </Box>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      </Container>
    </Box>
  )
}

export default Home 