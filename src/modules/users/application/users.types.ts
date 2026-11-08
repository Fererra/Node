/** `users.getById` result (architecture ports). */
export interface UserSummary {
  id: string;
  name: string;
}

export interface UsersService {
  /** The user, or `null` if there is none with this id. */
  getById(id: string): Promise<UserSummary | null>;
}
