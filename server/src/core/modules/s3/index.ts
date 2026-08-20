import { S3Client, DeleteObjectCommand, ListObjectsV2Command } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { GetObjectCommand } from "@aws-sdk/client-s3";
import config from "../../../config/index";
import logger from "../../../lib/logger";

// Initialize S3 client
const s3Client = new S3Client({
  region: config.aws.region_s3,
  credentials: {
    accessKeyId: config.aws.accessKeyId,
    secretAccessKey: config.aws.secretAccessKey,
  },
});

const deletedFileFromS3 = async (fileKey: string): Promise<void> => {
  try {
    const deleteCommand = new DeleteObjectCommand({
      Bucket: config.aws.s3Bucket,
      Key: fileKey,
    });
    await s3Client.send(deleteCommand);

    logger.info(`File ${fileKey} successfully deleted from S3.`);
  } catch (error) {
    logger.error(`Error deleting file ${fileKey} from S3:`, error);
    throw error;
  }
};

const getSignedDownloadUrl = async (
  fileKey: string,
  expiresInSeconds: number = 3600 // Default: 1 hour
): Promise<string> => {
  try {
    const getObjectCommand = new GetObjectCommand({
      Bucket: config.aws.s3Bucket,
      Key: fileKey,
    });

    const signedUrl = await getSignedUrl(s3Client, getObjectCommand, {
      expiresIn: expiresInSeconds,
    });

    logger.info(
      `Generated signed URL for ${fileKey} (expires in ${expiresInSeconds}s)`
    );
    return signedUrl;
  } catch (error) {
    logger.error(`Error generating signed URL for ${fileKey}:`, error);
    throw error;
  }
};

/**
 * List files in an S3 bucket with optional prefix
 */
const listFiles = async (
  bucket: string,
  prefix: string
): Promise<Array<{ key: string; size: number; lastModified: Date | undefined }>> => {
  try {
    const command = new ListObjectsV2Command({
      Bucket: bucket,
      Prefix: prefix,
    });

    const response = await s3Client.send(command);

    const files = (response.Contents || [])
      .filter((obj) => obj.Key?.endsWith(".parquet"))
      .map((obj) => ({
        key: obj.Key || "",
        size: obj.Size || 0,
        lastModified: obj.LastModified,
      }));

    logger.info(`Listed ${files.length} files from s3://${bucket}/${prefix}`);
    return files;
  } catch (error) {
    logger.error(`Error listing files from S3:`, error);
    throw error;
  }
};

/**
 * Delete a file from S3 by key
 */
const deleteFile = async (bucket: string, key: string): Promise<void> => {
  try {
    const command = new DeleteObjectCommand({
      Bucket: bucket,
      Key: key,
    });
    await s3Client.send(command);
    logger.info(`File ${key} successfully deleted from S3 bucket ${bucket}.`);
  } catch (error) {
    logger.error(`Error deleting file ${key} from S3:`, error);
    throw error;
  }
};

// Export S3 client and utility functions
export { s3Client };

const s3 = {
  deletedFileFromS3,
  getSignedDownloadUrl,
  listFiles,
  deleteFile,
  client: s3Client,
};

export default s3;
