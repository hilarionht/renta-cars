import { ALLOWED_CONTENT_TYPES, ContentType } from './content-type';
import { UnsupportedContentTypeError } from '../errors/unsupported-content-type.error';

describe('ContentType', () => {
  it.each(ALLOWED_CONTENT_TYPES)('from() acepta "%s" (allowlist)', (contentType) => {
    expect(ContentType.from(contentType).toString()).toBe(contentType);
  });

  it('from() rechaza un contentType fuera del allowlist con UnsupportedContentTypeError', () => {
    expect(() => ContentType.from('application/x-msdownload')).toThrow(UnsupportedContentTypeError);
  });
});
