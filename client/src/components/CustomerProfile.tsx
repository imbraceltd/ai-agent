import React, { useState } from 'react'
import { Box, Tabs, Tab } from '@mui/material'
import { styled } from '@mui/material/styles'
import CustomerProfileTab from './CustomerProfileTab'
import CustomerActivitiesTab from './CustomerActivitiesTab'
import CustomerConversationTab from './CustomerConversationTab'
import { useBoards, useBoardById, useRecordById } from '@/services/queries/board'

interface CustomerData {
  id: string
  name: string
  description: string
  stage: string
  incorporationDate: string
  incorporationPlace: string
  riskLevel: string
  customerSegments: string[]
}

interface CustomerProfileProps {
  customer?: CustomerData
  selectedContactId?: string
}

// Styled components
const MainContainer = styled(Box)(({ theme }) => ({
  width: '100%',
  height: '100%',
  backgroundColor: '#FFFFFF',
  display: 'flex',
  flexDirection: 'column'
}))

const TabsContainer = styled(Box)(({ theme }) => ({
  backgroundColor: theme.palette.background.paper,
  flexShrink: 0,
  position: 'sticky',
  top: 0,
  zIndex: 10
}))

const ContentContainer = styled(Box)(({ theme }) => ({
  flex: 1,
  overflow: 'auto',
  '& > *': {
    marginBottom: theme.spacing(3)
  }
}))

const CustomerProfile: React.FC<CustomerProfileProps> = ({ selectedContactId }) => {
  const [activeTab, setActiveTab] = useState<'profile' | 'activities' | 'conversation'>('profile')

  const { data: boards, isLoading: boardsLoading } = useBoards({ 
    isDefault: true, 
    types: "Contacts" 
  });

  const contactsBoard = Array.isArray(boards) ? boards[0] : undefined;
  const boardId = contactsBoard?.id;

  // fetching for all tabs
  const { data: board, isFetching: isFetchingBoard } = useBoardById(boardId as string);
  const {
    data: record,
    isFetching: isFetchingRecord,
    refetch,
    isFetchedAfterMount,
  } = useRecordById({
    boardId: board?._id as string,
    recordId: selectedContactId as string,
  });

  const handleTabChange = (event: React.SyntheticEvent, newValue: string) => {
    setActiveTab(newValue as 'profile' | 'activities' | 'conversation');
  };

  return (
    <MainContainer>
      {/* Tabs - Fixed Position */}
      <TabsContainer>
        <Tabs 
          value={activeTab} 
          onChange={handleTabChange}
          sx={{
            '& .MuiTabs-indicator': {
              display: 'none' // Remove the indicator line
            },
            '& .MuiTab-root': {
              textTransform: 'none',
              fontSize: '14px',
              fontWeight: 500,
              minHeight: 48,
              color: '#76C9FF', // Default text colour
              marginRight: '24px', // Spacing between tabs
              '&.Mui-selected': {
                color: '#333333' // Text colour when selected
              },
              '&:hover': {
                color: '#76C9FF' // Text colour on hover
              }
            }
          }}
        >
          <Tab value="profile" label="Profile" />
          <Tab value="activities" label="Activities" />
          <Tab value="conversation" label="Conversation" />
        </Tabs>
      </TabsContainer>

      {/* Content - Scrollable */}
      <ContentContainer>
        {activeTab === 'profile' && (
          <CustomerProfileTab 
            board={board as API.Board}
            record={record as API.BoardItem}
            isFetching={isFetchingBoard || isFetchingRecord}
          />
        )}

        {activeTab === 'activities' && (
          <CustomerActivitiesTab 
            board={board as API.Board}
            record={record as API.BoardItem}
            isFetching={isFetchingBoard || isFetchingRecord}
          />
        )}

        {activeTab === 'conversation' && (
          <CustomerConversationTab 
            board={board as API.Board}
            record={record as API.BoardItem}
            isFetching={isFetchingBoard || isFetchingRecord}
          />
        )}
      </ContentContainer>
    </MainContainer>
  )
}

export default CustomerProfile
