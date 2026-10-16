import { BadRequestException, PayloadTooLargeException } from '@nestjs/common';
import { validateTaskAttachment } from './attachment-policy';

describe('validateTaskAttachment', () => {
  it.each([
    ['application/pdf', Buffer.from('%PDF-1.7\n')],
    ['image/jpeg', Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00])],
    [
      'image/png',
      Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    ],
  ])('accepts a valid %s file signature', (mimetype, buffer) => {
    const file = {
      mimetype,
      buffer,
      size: buffer.length,
    } as Express.Multer.File;

    expect(validateTaskAttachment(file)).toBe(mimetype);
  });

  it('rejects a MIME type that does not match the file signature', () => {
    const file = {
      mimetype: 'image/png',
      buffer: Buffer.from('%PDF-1.7\n'),
      size: 9,
    } as Express.Multer.File;

    expect(() => validateTaskAttachment(file)).toThrow(BadRequestException);
  });

  it('rejects file types outside the allowlist', () => {
    const file = {
      mimetype: 'text/plain',
      buffer: Buffer.from('plain text'),
      size: 10,
    } as Express.Multer.File;

    expect(() => validateTaskAttachment(file)).toThrow(BadRequestException);
  });

  it('rejects files larger than the configured maximum', () => {
    const file = {
      mimetype: 'image/png',
      buffer: Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
      size: 10 * 1024 * 1024 + 1,
    } as Express.Multer.File;

    expect(() => validateTaskAttachment(file)).toThrow(
      PayloadTooLargeException,
    );
  });
});
