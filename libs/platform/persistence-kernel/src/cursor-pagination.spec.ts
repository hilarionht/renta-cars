import { BadRequestException } from '@nestjs/common';

import { decodeCursor, encodeCursor } from './cursor-pagination';

describe('cursor-pagination', () => {
  it('encodeCursor/decodeCursor hacen roundtrip del id', () => {
    const id = '01a04019-2f51-76cc-8d6b-720cf982a57c';

    expect(decodeCursor(encodeCursor(id))).toBe(id);
  });

  it('encodeCursor produce un valor opaco, distinto del id crudo', () => {
    const id = '01a04019-2f51-76cc-8d6b-720cf982a57c';

    expect(encodeCursor(id)).not.toBe(id);
  });

  it('decodeCursor tira BadRequestException si el string no es base64 valido', () => {
    expect(() => decodeCursor('***no-es-base64***')).toThrow(BadRequestException);
  });

  it('decodeCursor tira BadRequestException si decodifica a un objeto sin id', () => {
    const malformed = Buffer.from(JSON.stringify({}), 'utf-8').toString('base64url');

    expect(() => decodeCursor(malformed)).toThrow(BadRequestException);
  });

  it('decodeCursor tira BadRequestException si id no es un string', () => {
    const malformed = Buffer.from(JSON.stringify({ id: 5 }), 'utf-8').toString('base64url');

    expect(() => decodeCursor(malformed)).toThrow(BadRequestException);
  });
});
