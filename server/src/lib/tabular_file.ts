// __define-ocg__
import * as XLSX from "xlsx";
import axios from "axios";

type HeaderDetectionResult = {
  sheetName: string;
  headerRowIndexes: number[];
  headers: string[][];
  flattenedHeaders: string[];
  lastDataRowIndex: number; // Index of the last row with actual meaningful data (0-based)
  lastSheetRowIndex: number; // Index of the last row in the sheet's defined range (0-based)
  totalDataRows: number; // Total number of data rows (excluding headers)
};

// Legacy compatibility type for single-level headers
type LegacyHeaderDetectionResult = {
  sheetName: string;
  headerRowIndex: number;
  headers: string[];
};

export async function detectAndFlattenHeadersFromUrl(
  fileUrl: string
): Promise<HeaderDetectionResult[]> {
  try {
    // Fetch file as array buffer
    const response = await axios.get(fileUrl, { responseType: "arraybuffer" });
    const data = new Uint8Array(response.data);

    // Read workbook
    const workbook = XLSX.read(data, { type: "array" });
    const results: HeaderDetectionResult[] = [];

    workbook.SheetNames.forEach((sheetName) => {
      const sheet = workbook.Sheets[sheetName];
      if (!sheet) {
        // Skip if sheet is undefined
        results.push({
          sheetName,
          headerRowIndexes: [],
          headers: [],
          flattenedHeaders: [],
          lastDataRowIndex: -1,
          lastSheetRowIndex: -1,
          totalDataRows: 0,
        });
        return;
      }
      
      const rows: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1 });
      
      // Get the actual sheet range to find the true last row
      const sheetRange = XLSX.utils.decode_range(sheet['!ref'] || 'A1:A1');
      const sheetLastRowIndex = sheetRange.e.r; // 0-based index of the last row in the sheet
      
      if (rows.length === 0) {
        // Skip empty sheets, but use the sheet's actual range if it exists
        const emptySheetLastRow = sheetLastRowIndex > 0 ? sheetLastRowIndex : -1;
        results.push({
          sheetName,
          headerRowIndexes: [],
          headers: [],
          flattenedHeaders: [],
          lastDataRowIndex: emptySheetLastRow,
          lastSheetRowIndex: sheetLastRowIndex,
          totalDataRows: 0,
        });
        return;
      }

      // Improved multi-level header detection
      let candidateRows: { idx: number; score: number }[] = [];

      // First pass: find all rows with meaningful content
      console.log(`\nAnalyzing sheet: "${rows.length}"`);
      rows.forEach((row, idx) => {
        if (!row || row.length === 0) {
          return; // Skip empty rows
        }
        
        const score = row.reduce(
          (acc, cell) =>
            acc + (typeof cell === "string" && cell.trim().length > 0 ? 1 : 0),
          0
        );

        if (score > 0) {
          candidateRows.push({ idx, score });
        }
      });

      // Sort by score descending
      candidateRows.sort((a, b) => b.score - a.score);
      
      // Find header rows: look for consecutive rows that could be headers
      let headerRowIndexes: number[] = [];
      
      // Strategy 1: Look for consecutive rows starting from the top with decent scores
      for (let startIdx = 0; startIdx < Math.min(5, rows.length); startIdx++) {
        const potentialHeaders: number[] = [];
        
        for (let checkIdx = startIdx; checkIdx < Math.min(startIdx + 3, rows.length); checkIdx++) {
          const row = rows[checkIdx];
          if (!row || row.length === 0) break;
          
          const score = row.reduce(
            (acc, cell) => acc + (typeof cell === "string" && cell.trim().length > 0 ? 1 : 0),
            0
          );
          
          // Consider a row as potential header if it has at least 2 text cells
          // and is mostly text (not numbers)
          const textCells = row.filter(cell => typeof cell === "string" && cell.trim().length > 0);
          const numberCells = row.filter(cell => typeof cell === "number");
          
          if (score >= 2 && textCells.length > numberCells.length) {
            potentialHeaders.push(checkIdx);
          } else if (potentialHeaders.length > 0) {
            // Stop if we hit a data row after finding headers
            break;
          }
        }
        
        if (potentialHeaders.length > 0) {
          headerRowIndexes = potentialHeaders;
          break;
        }
      }
      
      // Fallback: if no multi-level headers found, use the row with highest score
      if (headerRowIndexes.length === 0 && candidateRows.length > 0) {
        headerRowIndexes = [candidateRows[0]!.idx];
      }

      // Extract headers
      const headers = headerRowIndexes
        .filter(idx => idx < rows.length && rows[idx]) // Ensure row exists
        .map((idx) => {
          const row = rows[idx];
          return row ? row.map((cell: any) => (typeof cell === "string" ? cell.trim() : "")) : [];
        });

      // Flatten headers into single array with category propagation
      let flattenedHeaders: string[] = [];
      if (headers.length > 1 && headers[0] && headers[1]) {
        // Multi-level: combine row[i] values, propagating category headers
        const topRow = headers[0];
        const bottomRow = headers[1];
        const maxCols = Math.max(topRow.length, bottomRow.length);
        
        flattenedHeaders = [];
        let currentCategory = ""; // Track the current category
        
        for (let colIdx = 0; colIdx < maxCols; colIdx++) {
          const top = topRow[colIdx] || "";
          const bottom = bottomRow[colIdx] || "";
          
          // Update current category if we find a new one
          if (top && top.trim().length > 0) {
            currentCategory = top.trim();
          }
          
          if (bottom && bottom.trim().length > 0) {
            if (currentCategory) {
              // Use current category with column header
              flattenedHeaders.push(`${currentCategory} - ${bottom.trim()}`);
            } else {
              // No category available, use just the column header
              flattenedHeaders.push(bottom.trim());
            }
          }
          // Skip columns with no bottom header (even if they have top header)
        }
        
      } else if (headers[0]) {
        // Single-level
        flattenedHeaders = headers[0].filter(h => h && h.trim().length > 0);
      }

      // Detect the last row with actual data
      // Use the sheet's actual range to get the true last row index
      let lastDataRowIndex = -1;
      
      // Find the last header row index (the end of header section)
      const lastHeaderRowIndex = headerRowIndexes.length > 0 ? 
        Math.max(...headerRowIndexes) : -1;
      
      // First, try to find the last row with actual data by searching backwards through the rows array
      for (let i = rows.length - 1; i >= 0; i--) {
        const row = rows[i];
        if (row && row.some(cell => 
          cell !== null && 
          cell !== undefined && 
          cell !== "" && 
          String(cell).trim().length > 0
        )) {
          lastDataRowIndex = i;
          break;
        }
      }
      
      // However, the sheet might have more rows than what's in the rows array
      // Use the sheet's actual last row index as the maximum possible
      const actualSheetLastRow = Math.max(lastDataRowIndex, sheetLastRowIndex);
      
      // Use the actual sheet's last row index for Excel range calculations
      lastDataRowIndex = actualSheetLastRow;
      
      // Calculate total data rows (excluding headers)
      // Only count rows that come after the last header row
      const firstDataRowIndex = lastHeaderRowIndex + 1;
      const totalDataRows = lastDataRowIndex >= firstDataRowIndex ? 
        lastDataRowIndex - lastHeaderRowIndex : 0;

      const varOcg: HeaderDetectionResult = {
        sheetName,
        headerRowIndexes,
        headers,
        flattenedHeaders,
        lastDataRowIndex,
        lastSheetRowIndex: sheetLastRowIndex,
        totalDataRows,
      };

      results.push(varOcg);
    });

    return results;
    
  } catch (error) {
    console.error('Error detecting and flattening headers:', error);
    throw new Error(`Failed to detect headers from URL: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

// Enhanced function that provides all headers with row information
export async function detectAllHeadersWithStructureFromUrl(
  fileUrl: string
): Promise<{
  sheetName: string;
  headerRowIndexes: number[];
  allHeaders: string[];
  headersByRow: { rowIndex: number; headers: string[] }[];
  lastDataRowIndex: number;
  lastSheetRowIndex: number;
  totalDataRows: number;
}[]> {
  // Use the new flatten detection function
  const results = await detectAndFlattenHeadersFromUrl(fileUrl);
  
  return results.map(result => {
    // Use the properly flattened headers from detectAndFlattenHeadersFromUrl
    const allHeaders: string[] = [...result.flattenedHeaders]; // Use the already combined headers
    const headersByRow: { rowIndex: number; headers: string[] }[] = [];
    
    result.headers.forEach((headerRow: string[], index: number) => {
      const rowIndex = result.headerRowIndexes[index] || 0;
      const cleanHeaders = headerRow
        .map((header: string) => header && header.trim().length > 0 ? header.trim() : '')
        .filter((header: string) => header.length > 0);
      
      // Add to structured list (keep original structure for headersByRow)
      headersByRow.push({
        rowIndex,
        headers: cleanHeaders
      });
    });
    
    return {
      sheetName: result.sheetName,
      headerRowIndexes: result.headerRowIndexes,
      allHeaders, // Now uses the properly flattened/combined headers
      headersByRow, // Headers organized by row (original structure)
      lastDataRowIndex: result.lastDataRowIndex,
      lastSheetRowIndex: result.lastSheetRowIndex,
      totalDataRows: result.totalDataRows,
    };
  });
}

// Legacy compatibility function for existing code
export async function detectHeadersForAllSheetsFromUrl(
  fileUrl: string
): Promise<LegacyHeaderDetectionResult[]> {
  // Use the new flatten detection function
  const results = await detectAndFlattenHeadersFromUrl(fileUrl);
  
  // Convert to legacy format using flattened headers
  return results.map(result => ({
    sheetName: result.sheetName,
    headerRowIndex: result.headerRowIndexes[0] || 0,
    headers: result.flattenedHeaders // Use the flattened headers
  }));
}
