import type { SeatsService } from '../../../seats/index.js';

/** What `showtimes` needs from `seats`. */
export type SeatsPort = Pick<SeatsService, 'getHallsByIds'>;
