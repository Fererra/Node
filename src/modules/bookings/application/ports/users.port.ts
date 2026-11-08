import type { UsersService } from '../../../users/index.js';

/** What `bookings` needs from `users`: user loading for FR-4…FR-6. */
export type UsersPort = Pick<UsersService, 'getById'>;
