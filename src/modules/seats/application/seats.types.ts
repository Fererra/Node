export type SeatType = 'STANDARD' | 'VIP';

/** `seats.getHallsByIds` item. */
export interface HallSummary {
  id: string;
  number: number;
}

/** `seats.getByHall` item. */
export interface HallSeat {
  id: string;
  row: number;
  number: number;
  type: SeatType;
}

/** `seats.getByIds` item. */
export interface SeatSummary {
  id: string;
  hallId: string;
  row: number;
  number: number;
}

export interface SeatsService {
  /** Halls with the given ids; unknown ids are skipped. */
  getHallsByIds(ids: readonly string[]): Promise<HallSummary[]>;
  /** Seats of the hall by row and number. */
  getByHall(hallId: string): Promise<HallSeat[]>;
  /** Seats with the given ids, by row and number; unknown ids are skipped. */
  getByIds(ids: readonly string[]): Promise<SeatSummary[]>;
}
