import { describe, expect, it } from 'vitest';
import { InMemorySeatsRepository } from './in-memory-seats.repository.js';

const repository = new InMemorySeatsRepository({
  halls: [
    { id: 'h1', hallNumber: 1 },
    { id: 'h2', hallNumber: 2 },
  ],
  seats: [
    { id: 's3', hallId: 'h1', row: 2, number: 1, seatType: 'VIP' },
    { id: 's2', hallId: 'h1', row: 1, number: 2, seatType: 'STANDARD' },
    { id: 's1', hallId: 'h1', row: 1, number: 1, seatType: 'STANDARD' },
    { id: 's4', hallId: 'h2', row: 1, number: 1, seatType: 'STANDARD' },
  ],
});

describe('InMemorySeatsRepository', () => {
  it('returns the seats of one hall by row and number', async () => {
    const seats = await repository.getByHall('h1');
    expect(seats.map((s) => s.id)).toEqual(['s1', 's2', 's3']);
    expect(seats[2]).toEqual({ id: 's3', row: 2, number: 1, type: 'VIP' });
  });

  it('batch lookups skip unknown ids', async () => {
    expect(await repository.getHallsByIds(['h2', 'x'])).toEqual([
      { id: 'h2', number: 2 },
    ]);
    expect(await repository.getByIds(['s4', 'x'])).toEqual([
      { id: 's4', hallId: 'h2', row: 1, number: 1 },
    ]);
  });
});
