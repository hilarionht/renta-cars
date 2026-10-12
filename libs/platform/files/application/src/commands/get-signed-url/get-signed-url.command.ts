export type { GetSignedUrlResult } from '../../ports/storage-provider.port';

export interface GetSignedUrlCommand {
  fileId: string;
  companyId: string;
}
