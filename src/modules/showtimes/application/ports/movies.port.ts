import type { MoviesService } from '../../../movies/index.js';

/** What `showtimes` needs from `movies`. */
export type MoviesPort = Pick<MoviesService, 'getByIds'>;
