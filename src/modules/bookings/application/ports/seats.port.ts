import type { SeatsService } from '../../../seats/index.js';

/** What `bookings` needs from `seats`. */
export type SeatsPort = Pick<SeatsService, 'getByHall' | 'getByIds'>;
