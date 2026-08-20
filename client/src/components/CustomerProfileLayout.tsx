import React, { useEffect, useState } from "react";
import { Box } from "@mui/material";
import { styled } from "@mui/material/styles";
import CustomerProfile from "@/components/CustomerProfile";
import ContactList from "@/components/ContactList";
import CustomerHeader from "@/components/CustomerHeader";

// Styled components
const MainContainer = styled(Box)(({ theme }) => ({
  backgroundColor: '#FFFFFF',
  display: 'flex',
  flexDirection: 'column',
  height: '614px'
}))

const ContentArea = styled(Box)(({ theme }) => ({
  display: 'flex',
  flex: 1,
  minHeight: 0
}))

const SidebarContainer = styled(Box)(({ theme }) => ({
  width: '250px',
  flexShrink: 0,
  borderRight: `1px solid ${theme.palette.divider}`
}))

const ProfileContainer = styled(Box)(({ theme }) => ({
  flex: 1
}))

interface CustomerProfileLayoutProps {
  contactSegment?: string;
  selectedContactId?: string;
  onContactSelect?: (contactId: string) => void;
  onFirstContactReady?: (getFirstContact: () => any) => void;
}

const CustomerProfileLayout: React.FC<CustomerProfileLayoutProps> = ({ contactSegment, selectedContactId, onContactSelect, onFirstContactReady }) => {
  const [customerType, setCustomerType] = useState<"Corporate" | "Retail">("Corporate");
  const [searchValue, setSearchValue] = useState("");
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    setCustomerType(contactSegment === "corp" ? "Corporate" : "Retail");
  }, [contactSegment]);

  const handleCustomerSelect = (customerId: string) => {
    // Notify parent component about contact selection
    if (onContactSelect) {
      onContactSelect(customerId);
    }
  };

  const handleSearchSubmit = (query: string) => {
    setSearchQuery(query);
  };

  // Reset search query when search value is cleared
  const handleSearchChange = (value: string) => {
    setSearchValue(value);
    if (!value.trim()) {
      setSearchQuery("");
    }
  };


  return (
    <MainContainer>
      {/* Header with Selection and Search */}
      <Box sx={{ flexShrink: 0 }}>
        <CustomerHeader
          selectedType={customerType}
          onTypeChange={setCustomerType}
          searchValue={searchValue}
          onSearchChange={handleSearchChange}
          onSearchSubmit={handleSearchSubmit}
        />
      </Box>
      {/* Main Content Area */}
      <ContentArea>
        <SidebarContainer>
          <ContactList
            selectedContactId={selectedContactId}
            onContactSelect={handleCustomerSelect}
            searchQuery={searchQuery}
            segmentValue={customerType === "Corporate" ? "corp" : "retail"}
            onFirstContactReady={onFirstContactReady}
          />
        </SidebarContainer>

        {/* Customer Profile - Full width */}
        <ProfileContainer>
          <CustomerProfile selectedContactId={selectedContactId} />
        </ProfileContainer>
      </ContentArea>
    </MainContainer>
  );
};

export default CustomerProfileLayout;
