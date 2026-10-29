import { ValidationPipe } from '@nestjs/common';
import { AssignRepairJobDto } from './assign-repair-job.dto';
import { QueryRepairJobDto } from './query-repair-job.dto';

const opaqueUserId = 'aB12cD34eF56gH78iJ90kL12mN34oP56';
const legacyUserId = '12345678-1234-4234-8234-123456789abc';
const pipe = new ValidationPipe({
  transform: true,
  whitelist: true,
  forbidNonWhitelisted: true,
});

describe('Repair mechanic user ID validation', () => {
  it.each([opaqueUserId, legacyUserId])(
    'accepts assignment to an existing user ID format: %s',
    async (userId) => {
      const input = { techCategoryId: 1, mechanicIds: [userId] };
      await expect(
        pipe.transform(input, { type: 'body', metatype: AssignRepairJobDto }),
      ).resolves.toMatchObject(input);
    },
  );

  it.each([undefined, null, [], '', opaqueUserId, [''], [null], [123], [{}]])(
    'rejects a missing, empty or non-string mechanic array: %j',
    async (mechanicIds) => {
      await expect(
        pipe.transform(
          { techCategoryId: 1, mechanicIds },
          { type: 'body', metatype: AssignRepairJobDto },
        ),
      ).rejects.toMatchObject({ status: 400 });
    },
  );

  it.each([opaqueUserId, legacyUserId])(
    'accepts a mechanic filter using user ID format: %s',
    async (mechanicId) => {
      await expect(
        pipe.transform(
          { mechanicId, limit: '20' },
          { type: 'query', metatype: QueryRepairJobDto },
        ),
      ).resolves.toMatchObject({ mechanicId, limit: 20 });
    },
  );

  it.each(['', 123, [], {}])(
    'rejects an empty or non-string mechanic filter: %j',
    async (mechanicId) => {
      await expect(
        pipe.transform(
          { mechanicId },
          { type: 'query', metatype: QueryRepairJobDto },
        ),
      ).rejects.toMatchObject({ status: 400 });
    },
  );

  it('keeps the UUID requirement for asset and section IDs', async () => {
    await expect(
      pipe.transform(
        {
          mechanicId: opaqueUserId,
          assetId: opaqueUserId,
          sectionId: opaqueUserId,
        },
        { type: 'query', metatype: QueryRepairJobDto },
      ),
    ).rejects.toMatchObject({ status: 400 });
  });
});
