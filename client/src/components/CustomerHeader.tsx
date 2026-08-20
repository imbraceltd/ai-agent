import React, { useState } from "react";
import { Box, TextField, InputAdornment, Select, MenuItem, FormControl } from "@mui/material";
import { styled } from "@mui/material/styles";
import { Search } from "@mui/icons-material";

interface CustomerHeaderProps {
  selectedType?: "Corporate" | "Retail";
  onTypeChange?: (type: "Corporate" | "Retail") => void;
  searchValue?: string;
  onSearchChange?: (value: string) => void;
  onSearchSubmit?: (query: string) => void;
  className?: string;
}

// Styled components
const HeaderContainer = styled(Box)(({ theme }) => ({
  backgroundColor: theme.palette.background.paper,
  borderBottom: `1px solid ${theme.palette.divider}`,
  padding: '3px 8px',
  display: 'flex',
  alignItems: 'center',
  gap: theme.spacing(2)
}))

const SelectContainer = styled(Box)(({ theme }) => ({
  width: '250px',
  flexShrink: 0
}))

const SearchContainer = styled(Box)(({ theme }) => ({
  flex: 1
}))

const CustomerHeader: React.FC<CustomerHeaderProps> = ({
  selectedType = "Corporate",
  onTypeChange,
  searchValue = "",
  onSearchChange,
  onSearchSubmit,
  className = "",
}) => {

  const handleKeyPress = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') {
      onSearchSubmit?.(searchValue);
    }
  };

  return (
    <HeaderContainer className={className}>
       {/* Left side - Selection Dropdown - Match ContactList width */}
       <SelectContainer>
         <FormControl fullWidth>
           <Select
             value={selectedType}
             onChange={(e) => onTypeChange?.(e.target.value as "Corporate" | "Retail")}
             size="small"
             sx={{
               '& .MuiOutlinedInput-notchedOutline': {
                 border: 'none'
               },
               '&:hover .MuiOutlinedInput-notchedOutline': {
                 border: 'none'
               },
               '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
                 border: 'none'
               },
               '& .MuiSelect-select': {
                 color: '#76C9FF',
                 fontFamily: 'Roboto',
                 fontSize: '14px',
                 fontWeight: 400
               }
             }}
           >
             <MenuItem value="Corporate">Corporate Customers</MenuItem>
             <MenuItem value="Retail">Retail Customers</MenuItem>
           </Select>
         </FormControl>
       </SelectContainer>

      {/* Right side - Search Box - Full Width */}
      <SearchContainer>
        <TextField
          value={searchValue}
          onChange={(e) => onSearchChange?.(e.target.value)}
          onKeyPress={handleKeyPress}
          placeholder="Search customers..."
          fullWidth
          size="small"
          sx={{
            '& .MuiOutlinedInput-notchedOutline': {
              border: 'none'
            },
            '&:hover .MuiOutlinedInput-notchedOutline': {
              border: 'none'
            },
            '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
              border: 'none'
            },
            '& .MuiInputBase-input': {
              fontFamily: 'Roboto',
              fontSize: '14px',
              fontWeight: 400
            }
          }}
          InputProps={{
            endAdornment: (
              <InputAdornment position="end">
                <Search sx={{ color: 'text.secondary' }} />
              </InputAdornment>
            )
          }}
        />
      </SearchContainer>
    </HeaderContainer>
  );
};

export default CustomerHeader;
