import {
  ArgumentMetadata,
  BadRequestException,
  ValidationPipe,
} from '@nestjs/common';
import { CreateSparepartDto } from './create-spare-part.dto';
import { UpdateSparepartDto } from './update-spare-part.dto';

describe('spare part numeric input validation', () => {
  const pipe = new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
  });

  const createMetadata: ArgumentMetadata = {
    type: 'body',
    metatype: CreateSparepartDto,
  };
  const updateMetadata: ArgumentMetadata = {
    type: 'body',
    metatype: UpdateSparepartDto,
  };

  const validCreate = {
    name: 'Fuse',
    price: 0,
    minStock: 0,
    qtyInStock: 0,
    groupId: 1,
  };

  it.each(['price', 'minStock', 'qtyInStock'] as const)(
    'rejects negative %s when creating a spare part',
    async (field) => {
      await expect(
        pipe.transform({ ...validCreate, [field]: -1 }, createMetadata),
      ).rejects.toThrow(BadRequestException);
    },
  );

  it.each(['price', 'minStock', 'qtyInStock'] as const)(
    'rejects negative %s when updating a spare part',
    async (field) => {
      await expect(
        pipe.transform({ [field]: -1 }, updateMetadata),
      ).rejects.toThrow(BadRequestException);
    },
  );

  it('accepts zero in all three fields', async () => {
    await expect(pipe.transform(validCreate, createMetadata)).resolves.toEqual(
      validCreate,
    );
  });
});
