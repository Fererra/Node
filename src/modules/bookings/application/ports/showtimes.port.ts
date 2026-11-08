import type { ShowtimesService } from '../../../showtimes/index.js';

/** What `bookings` needs from `showtimes`. */
export type ShowtimesPort = Pick<ShowtimesService, 'getByIds'>;
