import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { QuerySparepartTxnDto } from './query-spare-part-txn.dto';

describe('QuerySparepartTxnDto', () => {
  it('accepts supported transaction types and calendar dates', async () => {
    const query = plainToInstance(QuerySparepartTxnDto, {
      txnType: 'RETURN',
      startDate: '2026-08-01',
      endDate: '2026-08-31',
    });

    await expect(validate(query)).resolves.toHaveLength(0);
  });

  it('rejects unsupported transaction types and non-calendar date values', async () => {
    const query = plainToInstance(QuerySparepartTxnDto, {
      txnType: 'ADJUST',
      startDate: '2026-02-31',
      endDate: '2026-08-31T10:00:00Z',
    });

    const errors = await validate(query);

    expect(errors.map((error) => error.property)).toEqual(
      expect.arrayContaining(['txnType', 'startDate', 'endDate']),
    );
  });
});
