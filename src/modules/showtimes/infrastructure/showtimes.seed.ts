/** Rows of the table `showtimes` owns (docs/architecture.md#physical-schema). */
export interface ShowtimesSeed {
  showtimes: { id: string; movieId: string; hallId: string; startsAt: Date }[];
}
