import type { HallSeat, HallSummary, SeatSummary } from '../seats.types.js';

export interface SeatsRepository {
  getHallsByIds(ids: readonly string[]): Promise<HallSummary[]>;
  getByHall(hallId: string): Promise<HallSeat[]>;
  getByIds(ids: readonly string[]): Promise<SeatSummary[]>;
}
