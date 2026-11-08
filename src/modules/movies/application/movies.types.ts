/** `GET /movies` item (docs/api.md). */
export interface MovieDto {
  id: string;
  title: string;
  durationMin: number;
  ageLimit: number;
  genres: string[];
}

/** What other modules get through `movies.getByIds` (architecture ports). */
export interface MovieSummary {
  id: string;
  title: string;
}

export interface MoviesService {
  listMovies(): Promise<MovieDto[]>;
  getByIds(ids: readonly string[]): Promise<MovieSummary[]>;
}
