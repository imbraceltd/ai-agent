import axios from "axios";
import logger from "@/lib/logger";
import config from "@/config";

// ─── Types ───────────────────────────────────────────────────────────

/** Folder entry from the /api/folders/subfolders API */
export interface SubfolderEntry {
  id: string;
  name: string;
  path: string;
  parent_folder_id: string;
  file_count: number;
  files: { id: string; name: string }[];
  subfolders?: SubfolderEntry[];
}

/** Flat file entry returned by fetchSubfolders */
export interface FolderFileEntry {
  file_id: string;
  file_name: string;
  folder_path: string;
  folder_id: string;
}

// ─── Service functions ────────────────────────────────────────────────

/**
 * Fetch all files across folders (including subfolders) via the data-board API.
 * Walks the folder tree recursively and returns a flat file list plus all visited folder IDs.
 * @param folderIds - Root folder IDs to fetch
 * @returns Flat file list and all folder IDs (root + nested)
 */
export async function fetchSubfolders(folderIds: string[]): Promise<{
  files: FolderFileEntry[];
  allFolderIds: string[];
}> {
  const baseUrl = config.dataBoard.url;
  if (!baseUrl) {
    logger.warn("DATA_BOARD_URL not configured, skipping subfolder fetch");
    return { files: [], allFolderIds: folderIds };
  }

  const url = `${baseUrl}/api/folders/subfolders`;
  const response = await axios.post(
    url,
    { ids: folderIds, recursive: true, ignore_assistant: true },
    { headers: { "Content-Type": "application/json" } },
  );

  if (!response.data?.success) {
    throw new Error(response.data?.message || "Failed to fetch subfolders");
  }

  const folders = (response.data.data?.folders || []) as SubfolderEntry[];

  const allFolderIds: string[] = [];
  const files: FolderFileEntry[] = [];

  function walk(entry: SubfolderEntry) {
    allFolderIds.push(entry.id);
    for (const file of entry.files) {
      files.push({
        file_id: file.id,
        file_name: file.name,
        folder_path: entry.path,
        folder_id: entry.id,
      });
    }
    if (entry.subfolders) {
      for (const sub of entry.subfolders) {
        walk(sub);
      }
    }
  }

  for (const folder of folders) {
    walk(folder);
  }

  return { files, allFolderIds };
}

/**
 * Resolve file IDs from a list of folder IDs via the subfolders API.
 * Returns an empty array (not an error) if the API is unavailable or folders have no files.
 * @param folderIds - Folder IDs to resolve file IDs for
 * @returns Flat list of file IDs found inside those folders
 */
export async function resolveFileIdsFromFolders(
  folderIds: string[],
): Promise<string[]> {
  if (!folderIds.length) return [];
  try {
    const { files } = await fetchSubfolders(folderIds);
    return files.map((f) => f.file_id).filter(Boolean);
  } catch (err) {
    logger.warn("resolveFileIdsFromFolders: failed to fetch subfolder files", {
      error: err instanceof Error ? err.message : String(err),
      folderIds,
    });
    return [];
  }
}
