import type { SeatType } from '../application/seats.types.js';

/** Rows of the tables `seats` owns (docs/architecture.md#physical-schema). */
export interface SeatsSeed {
  halls: { id: string; hallNumber: number }[];
  seats: {
    id: string;
    hallId: string;
    row: number;
    number: number;
    seatType: SeatType;
  }[];
}
