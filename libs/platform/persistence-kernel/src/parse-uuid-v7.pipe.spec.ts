import { BadRequestException } from '@nestjs/common';

import { ParseUuidV7Pipe } from './parse-uuid-v7.pipe';

// docs/persistence/10-DECISIONES.md #147.
describe('ParseUuidV7Pipe', () => {
  const pipe = new ParseUuidV7Pipe();
  const metadata = { type: 'param' as const, data: 'id' };

  it('acepta un UUID v7', async () => {
    const id = '01a15a90-6afc-765f-b3ea-36bedaf0f4b4';
    await expect(pipe.transform(id, metadata)).resolves.toBe(id);
  });

  it('rechaza un UUID v4 con 400 (antes llegaba a EntityId.from y daba 500)', async () => {
    await expect(
      pipe.transform('3f2504e0-4f89-41d3-9a0c-0305e82c3301', metadata),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rechaza algo que no es un UUID con 400', async () => {
    await expect(pipe.transform('no-es-un-id', metadata)).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });
});
