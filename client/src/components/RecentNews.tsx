import React from 'react'
import { Typography, Box, Link, CircularProgress } from '@mui/material'
import { styled } from '@mui/material/styles'
import { useBoards } from '@/services/queries/board'
import { useQuery } from '@tanstack/react-query'
import { getBoardRecords } from '@/services/api/crm'
import apiFetch from '@/services/axios/handler'
import { ImbraceClient } from '@/services/axios'
import moment from 'moment'

interface NewsItem {
  id: string
  title: string
  date: string
  source?: string
}

interface RecentNewsProps {
  news?: NewsItem[]
  limit?: number
}

// Styled components
const NewsContainer = styled(Box)(({ theme }) => ({
  display: 'flex',
  flexDirection: 'column',
  gap: theme.spacing(2)
}))

const NewsItem = styled(Box)(({ theme }) => ({
  display: 'flex',
  alignItems: 'flex-start',
  justifyContent: 'space-between',
  gap: theme.spacing(2)
}))

const NewsTitle = styled(Link)(({ theme }) => ({
  fontSize: '14px',
  color: theme.palette.primary.main,
  textDecoration: 'none',
  cursor: 'pointer',
  flex: 1,
  lineHeight: 1.4,
  '&:hover': {
    color: theme.palette.primary.dark,
    textDecoration: 'underline'
  }
}))

const NewsDate = styled(Typography)(({ theme }) => ({
  fontSize: '12px',
  color: theme.palette.text.secondary,
  whiteSpace: 'nowrap',
  fontWeight: 400
}))

const LoadingContainer = styled(Box)(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: theme.spacing(4)
}))

const defaultNews: NewsItem[] = [
  { id: '1', title: 'Mainland bonds open, cross-border diversification', date: '8/22/2025' },
  { id: '2', title: 'Emerging market ETFs up, for Aggressive Growth', date: '8/11/2025' },
  { id: '3', title: 'Fed rate ahead, HKD flows to high-yield', date: '7/28/2025' },
  { id: '4', title: 'IPO boom, exclusive placement opportunities', date: '7/28/2025' },
  { id: '5', title: 'New cross-border PE fund, portfolio diversification', date: '7/23/2025' }
]

const RecentNews: React.FC<RecentNewsProps> = ({ news, limit = 5 }) => {
  // Get all boards and find the one with name "News Data"
  const { data: boards, isLoading: boardsLoading } = useBoards({
    limit: 0,
    skip: 0,
    sort: "-created_at",
  });

  const newsBoard = Array.isArray(boards) ? boards.find(board => board.name === "News Data") : undefined;
  const boardId = newsBoard?.id || newsBoard?._id;

  // Fetch news items from the board
  const { data: newsData, isLoading: newsLoading } = useQuery({
    queryKey: ["news-items", boardId, limit],
    queryFn: async () => {
      if (!boardId) return { data: [], count: 0, total: 0, has_more: false };

      const { data } = await apiFetch<{
        data: any[];
        count: number;
        total: number;
        has_more: boolean;
      }>(
        getBoardRecords.api(boardId),
        getBoardRecords.method,
        { limit, skip: 0, sort: "-created_at" },
        ImbraceClient
      );
      return data;
    },
    enabled: !!boardId,
  });

  // Helper function to get field value by field name
  const getFieldValue = (item: any, fieldName: string) => {
    if (!newsBoard?.fields) return "";

    const field = newsBoard.fields.find((f: any) => f.name === fieldName);
    if (!field) return "";

    const value = item.fields?.[field._id] || item[field._id];
    return value || "";
  };

  // Helper function to combine News Time and Update Timestamp
  const combineDateTime = (newsTime: string, updateTimestamp: string) => {
    if (!newsTime && !updateTimestamp) return "Unknown Date";
    
    try {
      let baseDate: Date;
      
      // Use Update Timestamp as base date (contains the actual date)
      if (updateTimestamp) {
        baseDate = new Date(updateTimestamp);
        // Validate the date
        if (isNaN(baseDate.getTime())) {
          throw new Error('Invalid update timestamp');
        }
      } else {
        baseDate = new Date();
      }
      
      // Extract time from News Time (format: "1970-01-01T05:30:00.000Z")
      if (newsTime) {
        const newsTimeDate = new Date(newsTime);
        // Validate the time
        if (!isNaN(newsTimeDate.getTime())) {
          // Set the time from News Time to the base date
          baseDate.setHours(newsTimeDate.getHours());
          baseDate.setMinutes(newsTimeDate.getMinutes());
          baseDate.setSeconds(newsTimeDate.getSeconds());
        }
      }
      
      return baseDate.toLocaleString('en-US', {
        month: 'numeric',
        day: 'numeric',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
      });
    } catch (error) {
      console.warn('Error combining date/time:', error, { newsTime, updateTimestamp });
      // Fallback to the best available date
      if (updateTimestamp) {
        try {
          return new Date(updateTimestamp).toLocaleString('en-US', {
            month: 'numeric',
            day: 'numeric',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            hour12: false
          });
        } catch {
          return updateTimestamp;
        }
      }
      if (newsTime) {
        try {
          return new Date(newsTime).toLocaleString('en-US', {
            month: 'numeric',
            day: 'numeric',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            hour12: false
          });
        } catch {
          return newsTime;
        }
      }
      return "Unknown Date";
    }
  };

  // Transform API data to NewsItem format
  const transformedNews: NewsItem[] = newsData?.data?.map((item: any) => {
    const title = getFieldValue(item, "Titile") || getFieldValue(item, "Name") || "Untitled";
    
    // Get News Time and Update Timestamp separately
    const newsTime = getFieldValue(item, "News Time") || "";
    const updateTimestamp = getFieldValue(item, "Update Timestamp") || item.created_at || "";
    
    const source = getFieldValue(item, "Source") || "";

    return {
      id: item.id || item._id || item.board_item_id,
      title,
      date: moment(updateTimestamp).format('MM/DD/YYYY HH:mm'),
      source,
    };
  }) || [];

  const isLoading = boardsLoading || newsLoading;
  const displayNews = news || transformedNews;

  if (isLoading) {
    return (
      <Box sx={{ p: 3 }}>
        <Typography variant="h6" component="h4" sx={{ 
          fontWeight: 600, 
          color: 'text.primary',
          mb: 2
        }}>
          Recent News
        </Typography>
        <LoadingContainer>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
            <CircularProgress size={20} />
            <Typography variant="body2" color="text.secondary">
              Loading news...
            </Typography>
          </Box>
        </LoadingContainer>
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h6" component="h4" sx={{ 
        fontWeight: 600, 
        color: 'text.primary',
        mb: 2
      }}>
        Recent News
      </Typography>
      <NewsContainer>
        {displayNews.map((newsItem) => (
          <NewsItem key={newsItem.id}>
            <NewsTitle 
              href={newsItem.source || "#"} 
              target="_blank" 
              rel="noopener noreferrer"
            >
              {newsItem.title}
            </NewsTitle>
            <NewsDate>
              {newsItem.date}
            </NewsDate>
          </NewsItem>
        ))}
      </NewsContainer>
    </Box>
  )
}

export default RecentNews
