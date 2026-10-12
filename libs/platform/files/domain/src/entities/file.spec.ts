import { ContentType } from '../value-objects/content-type';
import { StorageRef } from '../value-objects/storage-ref';
import { FileAlreadyDeletedError } from '../errors/file-already-deleted.error';
import { File } from './file';

function createFile(): File {
  return File.create({
    companyId: 'company-a',
    storageRef: StorageRef.from('company-a/uuid-1'),
    contentType: ContentType.from('application/pdf'),
    uploadedBy: 'user-1',
  });
}

describe('File', () => {
  describe('create', () => {
    it('crea un File Uploaded y emite FileUploaded.v1', () => {
      const file = createFile();

      expect(file.uploadStatus).toBe('Uploaded');
      expect(file.isNew).toBe(true);
      const events = file.pullDomainEvents();
      expect(events).toHaveLength(1);
      expect(events[0]).toMatchObject({
        eventType: 'FileUploaded.v1',
        contentType: 'application/pdf',
        uploadedBy: 'user-1',
      });
    });
  });

  describe('delete', () => {
    it('transiciona a Deleted, incrementa version y emite FileDeleted.v1', () => {
      const file = createFile();
      file.pullDomainEvents();
      const versionBefore = file.version;

      file.delete();

      expect(file.uploadStatus).toBe('Deleted');
      expect(file.version).toBe(versionBefore + 1);
      const events = file.pullDomainEvents();
      expect(events).toHaveLength(1);
      expect(events[0]).toMatchObject({ eventType: 'FileDeleted.v1' });
    });

    it('lanza FileAlreadyDeletedError si se llama sobre un File ya Deleted', () => {
      const file = createFile();
      file.delete();

      expect(() => file.delete()).toThrow(FileAlreadyDeletedError);
    });
  });

  describe('ensureReadable', () => {
    it('no lanza sobre un File Uploaded', () => {
      const file = createFile();
      expect(() => file.ensureReadable()).not.toThrow();
    });

    it('lanza FileAlreadyDeletedError sobre un File Deleted', () => {
      const file = createFile();
      file.delete();

      expect(() => file.ensureReadable()).toThrow(FileAlreadyDeletedError);
    });
  });
});
