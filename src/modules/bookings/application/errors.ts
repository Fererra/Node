import { AppError } from '../../../shared/errors.js';

export class SeatTakenError extends AppError {
  constructor() {
    super(
      'SEAT_TAKEN',
      'A requested seat is already booked; nothing was booked',
    );
  }
}

export class ShowtimeStartedError extends AppError {
  constructor() {
    super('SHOWTIME_STARTED', 'The showtime has already started');
  }
}

export class SeatNotInHallError extends AppError {
  constructor() {
    super(
      'SEAT_NOT_IN_HALL',
      "A requested seat doesn't exist or isn't in the showtime's hall",
    );
  }
}

export class IdempotencyKeyReusedError extends AppError {
  constructor() {
    super(
      'IDEMPOTENCY_KEY_REUSED',
      'This Idempotency-Key was already used with a different request',
    );
  }
}
