import { BadRequestException, PayloadTooLargeException } from '@nestjs/common';

export const MAX_TASK_ATTACHMENT_SIZE = 10 * 1024 * 1024;

const mimeSignatures: Record<string, (buffer: Buffer) => boolean> = {
  'application/pdf': (buffer) => buffer.subarray(0, 5).toString() === '%PDF-',
  'image/jpeg': (buffer) =>
    buffer.length >= 3 &&
    buffer[0] === 0xff &&
    buffer[1] === 0xd8 &&
    buffer[2] === 0xff,
  'image/png': (buffer) =>
    buffer.length >= 8 &&
    buffer
      .subarray(0, 8)
      .equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])),
};

export function validateTaskAttachment(file: Express.Multer.File): string {
  if (file.size > MAX_TASK_ATTACHMENT_SIZE) {
    throw new PayloadTooLargeException('Attachment must not exceed 10 MiB');
  }

  const signatureMatches = mimeSignatures[file.mimetype]?.(file.buffer);
  if (!signatureMatches) {
    throw new BadRequestException(
      'Only valid PDF, JPEG, and PNG files are allowed',
    );
  }
  return file.mimetype;
}
