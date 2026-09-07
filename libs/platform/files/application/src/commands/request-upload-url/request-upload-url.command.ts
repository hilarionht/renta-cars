export type { RequestUploadUrlResult } from '../../ports/storage-provider.port';

export interface RequestUploadUrlCommand {
  companyId: string;
  uploadedBy: string;
  contentType: string;
}
