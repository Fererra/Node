/** Rows of the tables `movies` owns (docs/architecture.md#physical-schema). */
export interface MoviesSeed {
  genres: { id: string; name: string }[];
  movies: {
    id: string;
    title: string;
    durationMin: number;
    ageLimit: number;
    releaseYear: number;
    description: string;
  }[];
  movieGenres: { movieId: string; genreId: string }[];
}
