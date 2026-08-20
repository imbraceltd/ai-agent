import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Box,
  Typography,
  CircularProgress,
  IconButton,
  Menu,
  MenuItem,
  Divider,
} from "@mui/material";
import { styled } from "@mui/material/styles";
import { Business as Building2, MoreVert } from "@mui/icons-material";
import PersonIcon from "./Icon/PersonIcon";
import { useBoards } from "@/services/queries/board";
import { useInfiniteQuery, useQueryClient } from "@tanstack/react-query";
import { useNotify } from "@/contexts/NotificationContext";
import {
  getBoardById,
  getBoardRecord,
  getBoardRecords,
  searchBoardRecord,
  deleteBoardRecord,
} from "@/services/api/crm";
import apiFetch from "@/services/axios/handler";
import { ImbraceClient } from "@/services/axios";
import { env } from "@/env";
import { getContactConversationsById } from "@/services/api/contact";

interface Contact {
  id: string;
  name: string;
  email?: string;
  company?: string;
  joinedSince?: string;
  lastActive?: string;
  isActive?: boolean;
  segment?: string;
}

interface ContactListProps {
  selectedContactId?: string | undefined;
  onContactSelect?: ((contactId: string, segment?: string) => void) | undefined;
  searchQuery?: string;
  segmentValue?: string; // 'retail' or 'corp'
  onFirstContactReady?: (getFirstContact: () => Contact | null) => void;
}

// Styled components - defined outside component to avoid re-creation
const ScrollContainer = styled(Box)(({ theme }) => ({
  height: "100%",
  overflowY: "auto",
  backgroundColor: "#FFFFFF",
}));

const LoadingContainer = styled(Box)(({ theme }) => ({
  flex: 1,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  marginTop: theme.spacing(1),
}));

const ContactItem = styled(Box)<{ isSelected: boolean }>(
  ({ theme, isSelected }) => ({
    display: "flex",
    alignItems: "center",
    gap: theme.spacing(1.5),
    padding: theme.spacing(1, 2), // Reduced padding so height = 37px
    height: 37,
    cursor: "pointer",
    transition: "all 0.2s ease",
    backgroundColor: isSelected ? "#3399FC" : "transparent", // Exact color requested
    color: isSelected
      ? theme.palette.primary.contrastText
      : theme.palette.text.primary,
    "&:hover": {
      backgroundColor: isSelected ? "#3399FC" : theme.palette.grey[50],
    },
  })
);

const IconContainer = styled(Box)<{ isSelected: boolean }>(
  ({ theme, isSelected }) => ({
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    width: 24, // Reduced size to fit the 37px height
    height: 24,
    borderRadius: theme.shape.borderRadius,
    backgroundColor: isSelected
      ? `${theme.palette.common.white}20`
      : theme.palette.grey[100],
  })
);

const ContactDetails = styled(Box)(({ theme }) => ({
  flex: 1,
  minWidth: 0,
}));

const OptionsButton = styled(IconButton)<{ isSelected: boolean }>(
  ({ theme, isSelected }) => ({
    padding: theme.spacing(0.5),
    color: isSelected
      ? theme.palette.primary.contrastText
      : theme.palette.text.secondary,
    "&:hover": {
      backgroundColor: isSelected
        ? `${theme.palette.common.white}20`
        : theme.palette.grey[100],
    },
  })
);

const StatusIndicator = styled(Box)(({ theme }) => ({
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: theme.spacing(2),
}));

const EmptyState = styled(Box)(({ theme }) => ({
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: theme.spacing(4),
  textAlign: "center",
}));

const ContactList: React.FC<ContactListProps> = ({
  selectedContactId,
  onContactSelect,
  searchQuery,
  segmentValue,
  onFirstContactReady,
}) => {
  // State for options menu
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [menuContactId, setMenuContactId] = useState<string>("");
  const isFirstTimeInited = useRef(true);

  // Query client for cache invalidation
  const queryClient = useQueryClient();

  // Notification system
  const { showSuccess, showError } = useNotify();
  // Get the Contacts board
  const { data: boards, isLoading: boardsLoading } = useBoards({
    isDefault: true,
    types: "Contacts",
  });

  const contactsBoard = Array.isArray(boards) ? boards[0] : undefined;
  const boardId = contactsBoard?.id || contactsBoard?._id;

  // Helper function to get field ID by field name
  const getFieldId = (fieldName: string) => {
    if (!contactsBoard?.fields) return null;
    const field = contactsBoard.fields.find((f: any) => f.name === fieldName);
    return field?._id || null;
  };

  // Get the field ID for Segment field
  const scbFieldId = getFieldId("Segment");

  // Infinite query for pagination support
  const {
    data: infiniteData,
    isLoading: recordsLoading,
    isFetchingNextPage,
    hasNextPage,
    fetchNextPage,
  } = useInfiniteQuery({
    queryKey: ["board-items-infinite", boardId, searchQuery, segmentValue],
    queryFn: async ({ pageParam = 0 }) => {
      // Always use search API to support filtering
      const searchParams: any = {
        limit: 20,
        offset: pageParam,
        matchingStrategy: "all",
      };

      // Add search query if provided
      if (searchQuery && searchQuery.trim()) {
        searchParams.q = searchQuery.trim();
      }

      // Add filter for Segment field if field ID and segment value are available
      if (scbFieldId && segmentValue) {
        searchParams.filter = `fields.${scbFieldId} = '${segmentValue}'`;
      }

      const { data } = await apiFetch<API.MeilisearchResponse<any[]>>(
        searchBoardRecord.api(boardId!),
        searchBoardRecord.method,
        searchParams,
        ImbraceClient
      );

      // Transform meilisearch response to match the expected format
      const transformedData = {
        data: data.message?.hits || [],
        count: data.message?.hits?.length || 0,
        total: data.message?.estimatedTotalHits || 0,
        has_more: pageParam + 20 < (data.message?.estimatedTotalHits || 0),
      };

      return transformedData;
    },
    enabled: !!boardId,
    initialPageParam: 0,
    getNextPageParam: (lastPage, allPages) => {
      // Calculate next skip/offset based on current data length
      const currentLength = allPages.reduce(
        (total, page) => total + (page.data?.length || 0),
        0
      );
      return lastPage.has_more ? currentLength : undefined;
    },
    staleTime: 0,
  });

  // Flatten all pages data
  const contacts = infiniteData?.pages.flatMap((page) => page.data || []) || [];
  const isLoading = boardsLoading || recordsLoading;

  // Helper function to get field value by field name
  const getFieldValue = (item: any, fieldName: string) => {
    if (!contactsBoard?.fields) return "";

    const field = contactsBoard.fields.find((f: any) => f.name === fieldName);
    if (!field) return "";

    const value = item.fields?.[field._id] || item[field._id];
    return value || "";
  };

  // Transform API data to Contact format
  const transformedContacts: Contact[] = contacts.map((item: any) => ({
    id: item.id || item._id,
    name:
      getFieldValue(item, "Name") || item.contacts?.display_name || "Unknown",
    joinedSince:
      getFieldValue(item, "Joined Since") || item.contacts?.created_at,
    lastActive: getFieldValue(item, "Last Active") || item.contacts?.last_seen,
    isActive: false, // Can add logic to determine active status
    segment:
      typeof getFieldValue(item, "Segment") === "string"
        ? getFieldValue(item, "Segment")
        : getFieldValue(item, "Segment")[0] || "",
    ...item,
  }));

  useEffect(() => {
    if (isFirstTimeInited.current && transformedContacts.length > 0) {
      // Send message to parent
      window.parent.postMessage(
        {
          event: "CHILD_READY",
          data: {},
        },
        env?.aichat?.url || "http://localhost:5173"
      );
      isFirstTimeInited.current = false;
    }
    // Handle message from parent
    const onMessage = (event: MessageEvent) => {
      if (event.data.type !== "SCB") return;

      if (event.data.event === "GET_CONTACT_FROM_NEXT_BEST_ACTION") {
        sendContactToParent(transformedContacts[0]);
      }
    };

    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [transformedContacts]);

  // Scroll handler for infinite scroll
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const handleScroll = useCallback(
    (event: React.UIEvent<HTMLDivElement>) => {
      const container = event.currentTarget;
      const { scrollTop, scrollHeight, clientHeight } = container;
      const distanceFromBottom = scrollHeight - scrollTop - clientHeight;

      if (!hasNextPage || isFetchingNextPage) {
        return;
      }

      // Trigger fetch when user is 100px from bottom
      if (distanceFromBottom < 100) {
        fetchNextPage();
      }
    },
    [hasNextPage, isFetchingNextPage, fetchNextPage, transformedContacts.length]
  );

  // Menu handlers
  const handleOptionsClick = (
    event: React.MouseEvent<HTMLElement>,
    contactId: string
  ) => {
    event.stopPropagation(); // Prevent contact selection
    setAnchorEl(event.currentTarget);
    setMenuContactId(contactId);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
    setMenuContactId("");
  };

  const handleShareLink = async (contact: Contact) => {
    handleMenuClose();
    // Copy link to clipboard
    const url = `${env.webapp.url}/crm/${boardId}/${contact.id}`;
    try {
      const message = {
        type: "SCB",
        event: "CONTACT_COPIED",
        data: {
          contactUrl: url,
        },
      };
      window.parent.postMessage(
        message,
        env?.aichat?.url || "http://localhost:5173"
      );
      // Show success notification
      showSuccess("Contact Copied", `"${contact.name}" has been copied!`);
    } catch (err) {
      console.error("Failed to copy link to clipboard:", err);
    }
  };

  const handleDelete = async (contact: Contact) => {
    handleMenuClose();

    if (!boardId || !contact.id) {
      console.error("Missing boardId or contactId for deletion");
      return;
    }

    try {
      // Call the delete API
      await apiFetch(
        deleteBoardRecord.api(boardId, contact.id),
        deleteBoardRecord.method,
        {},
        ImbraceClient
      );

      // Invalidate and refetch the contact list
      await queryClient.invalidateQueries({
        queryKey: ["board-items-infinite", boardId, searchQuery, segmentValue],
      });

      // Show success notification
      showSuccess(
        "Contact Deleted",
        `"${contact.name}" has been deleted successfully!`
      );

      console.log("Contact deleted successfully:", contact.id);
    } catch (error) {
      console.error("Failed to delete contact:", error);
      showError("Delete Failed", "Failed to delete contact. Please try again.");
    }
  };

  const getContactItemDetails = async (contactId: string) => {
    if (!boardId) {
      throw new Error("missing board id");
    }

    if (!contactId) {
      throw new Error("missing record id");
    }

    const { data } = await apiFetch<API.BoardItem>(
      getBoardRecord.api(boardId, contactId),
      getBoardRecord.method
    );
    return data;
  };

  const loadConversation = async (selectedContactId: string) => {
    console.log("loadConversation", { selectedContactId });
    try {
      const { data } = await apiFetch<{ data: any[] }>(
        getContactConversationsById.api(
          selectedContactId,
          "whatsapp&channel_types=web&channel_types=instagram&channel_types=facebook&channel_types=line"
        ),
        getContactConversationsById.method
      );
      if (data.data && data.data.length > 0) {
        // Get the first (most recent) conversation
        const firstConversation = data.data[0];
        if (firstConversation) {
          return firstConversation;
        }
      } else {
        return null;
      }
    } catch (error) {
      console.error("Failed to load conversations:", error);
      return null;
    }
  };

  console.log(env, "env from /config endpoint");

  const sendContactToParent = async (contact: Contact) => {
    const contactItem = await getContactItemDetails(contact.id);
    let conversationId = null;
    if (contactItem?.contacts?._id) {
      conversationId = await loadConversation(contactItem.contacts._id);
    }
    const message = {
      type: "SCB",
      event: "CONTACT_SELECTED",
      data: {
        contactId: contact.id,
        contactName: contact.name,
        boardId: boardId,
        boardItemId: contact.id,
        conversationId: conversationId?._id,
      },
    };
    console.log(message, "message");
    window.parent.postMessage(
      message,
      env?.aichat?.url || "http://localhost:5173"
    );
  };

  if (isLoading) {
    return (
      <LoadingContainer>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
          <CircularProgress size={20} />
          <Typography variant="body2" color="text.secondary">
            Loading contacts...
          </Typography>
        </Box>
      </LoadingContainer>
    );
  }

  if (!contactsBoard) {
    return (
      <LoadingContainer>
        <Typography variant="body2" color="text.secondary">
          No contacts board found
        </Typography>
      </LoadingContainer>
    );
  }

  return (
    <ScrollContainer ref={scrollContainerRef} onScroll={handleScroll}>
      {transformedContacts.map((contact) => {
        const isSelected = contact.isActive || selectedContactId === contact.id;

        return (
          <ContactItem
            key={contact.id}
            isSelected={isSelected}
            onClick={() => {
              onContactSelect?.(contact.id);
              sendContactToParent(contact);
            }}
          >
            <IconContainer isSelected={isSelected}>
              {(contact.segment === "retail" || !contact.segment) && (
                <PersonIcon
                  width={14}
                  height={14}
                  fill={isSelected ? "white" : "#828282"}
                />
              )}
              {contact.segment === "corp" && (
                <Building2
                  sx={{
                    fontSize: 14, // Reduced icon size
                    color: isSelected
                      ? "primary.contrastText"
                      : "text.secondary",
                  }}
                />
              )}
            </IconContainer>

            <ContactDetails>
              <Typography
                sx={{
                  fontFamily: "Roboto",
                  fontWeight: 400,
                  fontSize: "14px",
                  lineHeight: "145%",
                  letterSpacing: "0%",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                  color: isSelected ? "primary.contrastText" : "#BDBDBD",
                }}
              >
                {contact.name}
              </Typography>
              {contact.company && (
                <Typography
                  sx={{
                    display: "block",
                    fontFamily: "Roboto",
                    fontWeight: 400,
                    fontSize: "12px",
                    lineHeight: "145%",
                    letterSpacing: "0%",
                    color: isSelected ? "primary.contrastText" : "#BDBDBD",
                    opacity: isSelected ? 0.8 : 1,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {contact.company}
                </Typography>
              )}
            </ContactDetails>

            {/* Options button - only show when selected */}
            {isSelected && (
              <OptionsButton
                isSelected={isSelected}
                onClick={(e) => handleOptionsClick(e, contact.id)}
                size="small"
              >
                <MoreVert sx={{ fontSize: 16 }} />
              </OptionsButton>
            )}
          </ContactItem>
        );
      })}

      {/* Loading indicator for infinite scroll */}
      {isFetchingNextPage && (
        <StatusIndicator>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
            <CircularProgress size={16} />
            <Typography variant="caption" color="text.secondary">
              Loading more contacts...
            </Typography>
          </Box>
        </StatusIndicator>
      )}

      {/* End of list indicator */}
      {!hasNextPage && transformedContacts.length > 0 && (
        <StatusIndicator>
          <Typography variant="caption" color="text.disabled">
            Loaded all {transformedContacts.length} contacts
          </Typography>
        </StatusIndicator>
      )}

      {transformedContacts.length === 0 && !isLoading && (
        <EmptyState>
          <Box>
            <Building2
              sx={{
                fontSize: 32,
                color: "text.disabled",
                mb: 1,
                mx: "auto",
                display: "block",
              }}
            />
            <Typography variant="body2" color="text.secondary">
              No contacts found
            </Typography>
          </Box>
        </EmptyState>
      )}

      {/* Options Menu */}
      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={handleMenuClose}
        PaperProps={{
          elevation: 3,
          sx: {
            minWidth: 120,
            "& .MuiMenuItem-root": {
              fontFamily: "Roboto",
              fontSize: "14px",
            },
          },
        }}
      >
        <MenuItem
          onClick={() => {
            const contact = transformedContacts.find(
              (c) => c.id === menuContactId
            );
            if (contact) handleShareLink(contact);
          }}
        >
          Share link
        </MenuItem>
        <Divider />
        <MenuItem
          onClick={() => {
            const contact = transformedContacts.find(
              (c) => c.id === menuContactId
            );
            if (contact) handleDelete(contact);
          }}
        >
          Delete
        </MenuItem>
      </Menu>
    </ScrollContainer>
  );
};

export default ContactList;
