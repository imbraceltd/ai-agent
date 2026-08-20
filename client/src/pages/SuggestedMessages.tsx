import React, { useEffect, useState } from "react";
import { Box } from "@mui/material";
import { styled } from "@mui/material/styles";
import CustomerProfileLayout from "@/components/CustomerProfileLayout";
import NextTasks from "@/components/NextTasks";
import RecentNews from "@/components/RecentNews";
import { getBoardRecord } from "@/services/api/crm";
import apiFetch from "@/services/axios/handler";
import { env } from "@/env";

// Styled components using MUI's styled API
const PageContainer = styled(Box)(({ theme }) => ({
  height: "100vh",
  display: "flex",
  flexDirection: "column",
  overflow: "auto",
  padding: 9,
  backgroundColor: "#D9EFFE",
}));

const BottomSection = styled(Box)(({ theme }) => ({
  backgroundColor: theme.palette.background.paper,
  borderTop: `1px solid ${theme.palette.divider}`,
  padding: 0,
  flexShrink: 0,
}));

const SuggestedMessages: React.FC = () => {
  const [selectedContactId, setSelectedContactId] = useState<string>("");
  const [contactSegment, setContactSegment] = useState<string>("corp");

  const handleContactSelect = (contactId: string) => {
    setSelectedContactId(contactId);
  };

   // Helper function to get field value by field name
   const getFieldValue = (boardFields: any, item: any, fieldName: string) => {
    if (!boardFields) return "";

    const field = boardFields.find((f: any) => f.name === fieldName);
    if (!field) return "";

    const value = item.fields?.[field._id] || item[field._id];
    return value || "";
  };

  const getContactItemDetails = async (boardId:string, contactId: string) => {
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
    if(data){
      const segment = getFieldValue(data.board.fields, data, "Segment");
      setContactSegment(segment);  
      setSelectedContactId(data._id);
    }
  };

  useEffect(() => {
    // Handle message from parent
    const onMessage = (event: MessageEvent) => {
      if (event.data.type !== "SCB") return;

      if (event.data.event === "SEND_CONTACT_TO_NEXT_BEST_ACTION" && event.data.data?.contactId) {
        const { contactId, boardId } = event.data.data;
        getContactItemDetails(boardId, contactId);
       
      }
      if (event.data.event === "REMOVE_CONTACT_TO_NEXT_BEST_ACTION") {
        setSelectedContactId("");
      }
    };

    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, []);

  return (
    <PageContainer>
      <Box sx={{ borderRadius: "8px", overflow: "scroll" }}>
        {/* Top Section - Customer Profile Layout (Sidebar + Customer Profile) */}
        <Box sx={{ flexShrink: 0 }}>
          <CustomerProfileLayout contactSegment={contactSegment} selectedContactId={selectedContactId} onContactSelect={handleContactSelect} />
        </Box>
        {/* Bottom Section - Next Tasks and Recent News */}
        <BottomSection>
          <Box sx={{ display: "flex" }}>
            <Box sx={{ flex: 1 }}>
              <RecentNews />
            </Box>
          </Box>
        </BottomSection>
      </Box>
    </PageContainer>
  );
};

export default SuggestedMessages;
