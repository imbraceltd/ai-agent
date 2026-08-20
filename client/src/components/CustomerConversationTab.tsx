import React, { useState, useEffect, useCallback } from "react";
import { Box } from "@mui/material";
import { styled } from "@mui/material/styles";
import { Spin, IconButton, Icon, Typography } from "@imbrace/ui";
import { useAppDispatch, useAppSelector } from "@/redux/store";
import { fetchTeamConversationByIdThunk } from "@/redux/slices/teamConversation";
import { getContactConversationsById } from "@/services/api/contact";
import apiFetch from "@/services/axios/handler";
import MessageList from "../components/Conversations/components/MessageList";

interface CustomerConversationTabProps {
  board: API.Board;
  record: API.BoardItem;
  isFetching: boolean;
}

const CustomerConversationTab: React.FC<CustomerConversationTabProps> = ({
  board,
  record,
  isFetching,
}) => {
  const dispatch = useAppDispatch();

  // State for conversation view and message insertion
  const [showConversationView, setShowConversationView] =
    useState<boolean>(true);
  const [insertedMessage, setInsertedMessage] = useState<{
    content: string;
    timestamp: number;
  } | null>(null);
  const [currentDrawer, setCurrentDrawer] = useState<string>("closed");
  const [isLoadingConversation, setIsLoadingConversation] =
    useState<boolean>(false);
  const [hasLoadedConversation, setHasLoadedConversation] =
    useState<boolean>(false);

  // Get conversation from redux
  const teamConversation = useAppSelector(
    (state: any) => state.TeamConversation.teamConversation
  );
  
  // Auto-load conversation when conversation view is shown
  useEffect(() => {
    const loadConversation = async () => {
      // Don't load if still fetching data
      if (isFetching || !record?.contacts?._id) {
        return;
      }
      
      setIsLoadingConversation(true);
      setHasLoadedConversation(true);

      try {
        
        const { data } = await apiFetch<{ data: any[] }>(
          getContactConversationsById.api(
            record.contacts._id,
            "whatsapp&channel_types=web&channel_types=instagram&channel_types=facebook&channel_types=line"
          ),
          getContactConversationsById.method
        );
        console.log("data", data);
        if (data.data && data.data.length > 0) {
          // Get the first (most recent) conversation
          const firstConversation = data.data[0];
          if (firstConversation) {
            console.log("firstConversation", firstConversation);
            if (firstConversation?.available_team_conversations[0]._id) {
              // Dispatch to load conversation details
              await dispatch(
                fetchTeamConversationByIdThunk(
                  firstConversation.available_team_conversations[0]._id
                )
              ).unwrap();
              console.log("Conversation loaded successfully");
              setShowConversationView(true)
            }
          }
        } else {
          setShowConversationView(false)
          console.log(
            "No conversations found for this contact - will create when user sends first message"
          );
          // Don't create conversation here - let user start the conversation
        }
      } catch (error) {
        console.error("Failed to load conversations:", error);
      } finally {
        setIsLoadingConversation(false);
      }
    };
    console.log("loadConversation", record);
    
    if(record?.contacts?._id) {
      loadConversation();
    }
    else{
      setShowConversationView(false)
    }
  }, [record, isFetching]);

  // Reset loading state when switching back to contact overview or changing contact
  useEffect(() => {
    if (!showConversationView) {
      setIsLoadingConversation(false);
      setHasLoadedConversation(false);
    }
  }, [showConversationView]);

  // Reset conversation state when contact changes
  useEffect(() => {
    setHasLoadedConversation(false);
    setIsLoadingConversation(false);
  }, [record?.contacts?._id]);

  return (
    <div
      style={{
        height: "100%",
        display: "flex",
        flexDirection: "column",
        flex: 1,
      }}
    >
      {/* MessageList component */}
      <div style={{ flex: 1, overflow: "auto", minHeight: 0 }}>
        {isLoadingConversation ? (
          <div
            style={{
              display: "flex",
              justifyContent: "center",
              alignItems: "center",
              height: "100%",
            }}
          >
            <div style={{ textAlign: "center" }}>
              <Spin />
              <Typography variant="Body" style={{ marginTop: "16px" }}>
                Loading conversation...
              </Typography>
            </div>
          </div>
        ) : teamConversation && showConversationView ? (
          <>
            <MessageList
              drawersOpen={currentDrawer !== "closed"}
              currentDrawer={currentDrawer}
              setCurrentDrawer={setCurrentDrawer}
              insertedMessage={insertedMessage}
              isInOverview={true}
            />
          </>
        ) : (
          <>
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                height: "100%",
                padding: "20px",
                textAlign: "center",
              }}
            >
              <Typography variant="Body" style={{ marginBottom: "16px" }}>
                No conversation history found for this contact.
              </Typography>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default CustomerConversationTab;
