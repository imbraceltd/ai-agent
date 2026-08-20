import React from "react";
import { Typography, Box, Link } from "@mui/material";
import { styled } from "@mui/material/styles";
import { Circle } from "@mui/icons-material";
import { useBoards, useRelatedRecordsInfinite } from "@/services/queries/board";

interface Task {
  id: string;
  title: string;
  status: "pending" | "in-progress" | "completed";
  color: string;
}

interface NextTasksProps {
  tasks?: Task[];
  selectedContactId?: string;
}

// Styled components
const TaskContainer = styled(Box)(({ theme }) => ({
  display: "flex",
  flexDirection: "column",
  gap: theme.spacing(2),
}));

const TaskItem = styled(Box)(({ theme }) => ({
  display: "flex",
  alignItems: "center",
  gap: theme.spacing(1.5),
}));

const StatusIndicator = styled(Circle)<{ taskcolor: string }>(
  ({ theme, taskcolor }) => ({
    fontSize: "8px",
    color:
      taskcolor === "green"
        ? theme.palette.success.main
        : taskcolor === "red"
        ? theme.palette.error.main
        : taskcolor === "orange"
        ? theme.palette.warning.main
        : theme.palette.grey[400],
  })
);

const TaskLink = styled(Link)(({ theme }) => ({
  fontSize: "14px",
  color: theme.palette.primary.main,
  textDecoration: "none",
  cursor: "pointer",
  "&:hover": {
    color: theme.palette.primary.dark,
    textDecoration: "underline",
  },
}));


const NextTasks: React.FC<NextTasksProps> = ({
  selectedContactId,
}) => {
  const { data: contactsBoards, isLoading: contactsBoardsLoading } = useBoards({
    isDefault: true,
    types: "Contacts",
  });

  const { data: tasksBoards, isLoading: tasksBoardsLoading } = useBoards({
    isDefault: true,
    types: "Tasks",
  });

  const contactsBoard = Array.isArray(contactsBoards)
    ? contactsBoards[0]
    : undefined;
  const contactsBoardId = contactsBoard?.id;
  const tasksBoard = Array.isArray(tasksBoards) ? tasksBoards[0] : undefined;

  console.log({contactsBoard, tasksBoard});
  const tasksBoardId = tasksBoard?.id;

  // Only fetch if we have all required IDs
  const shouldFetch = !!selectedContactId && !!contactsBoardId && !!tasksBoardId;

  const {
    data,
    hasNextPage,
    fetchNextPage,
    isFetchingNextPage,
    isFetching,
    isFetchedAfterMount,
    refetch,
  } = useRelatedRecordsInfinite({
    boardId: contactsBoardId as string,
    recordId: selectedContactId as string,
    relatedBoardId: tasksBoardId,
    params: { skip: 0, limit: 5, link: true },
  });

  console.log({data});

  // Get tasks from API data or fallback to default tasks
  const apiTasks = data?.pages?.flatMap(page => page.data) || [];
  const displayTasks = apiTasks.length > 0 ? apiTasks : [];

  // Function to create task URL and open in new tab
  const handleTaskClick = (task: any) => {
    if (task.id && tasksBoardId) {
      // Create URL similar to the provided example
      // Format: {WEB_APP_URL}/crm/{boardId}/{recordId}
      const webAppUrl = import.meta.env.VITE_WEB_APP_URL || 'https://your-webapp.example.com';
      const taskUrl = `${webAppUrl}/crm/${tasksBoardId}/${task.id}`;
      window.open(taskUrl, '_blank', 'noopener,noreferrer');
    }
  };

  return (
    <Box sx={{ p: 3 }}>
      <Typography
        variant="h6"
        component="h4"
        sx={{
          fontWeight: 600,
          color: "text.primary",
          mb: 2,
        }}
      >
        Next Tasks
      </Typography>
      <TaskContainer>
        {!selectedContactId ? (
          <Typography variant="body2" color="text.secondary">
            Select a contact to view tasks
          </Typography>
        ) : !shouldFetch ? (
          <Typography variant="body2" color="text.secondary">
            Loading board information...
          </Typography>
        ) : isFetching ? (
          <Typography variant="body2" color="text.secondary">
            Loading tasks...
          </Typography>
        ) : displayTasks.length > 0 ? (
          displayTasks.map((task: any, index: number) => (
            <TaskItem key={task.id || index}>
              <StatusIndicator taskcolor={task.color || "grey"} />
              <TaskLink 
                onClick={() => handleTaskClick(task)}
                sx={{ cursor: 'pointer' }}
              >
                {task.title || task.name || "Untitled Task"}
              </TaskLink>
            </TaskItem>
          ))
        ) : (
          <Typography variant="body2" color="text.secondary">
            No tasks available for this contact
          </Typography>
        )}
      </TaskContainer>
    </Box>
  );
};

export default NextTasks;
