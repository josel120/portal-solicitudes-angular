export type Role = 'employee' | 'approver';

export interface User {
  readonly id: number;
  readonly name: string;
  readonly email: string;
  readonly role: Role;
  readonly department: string;
}

export interface Session {
  readonly token: string;
  /** Epoch millis. */
  readonly expiresAt: number;
  readonly user: User;
}

export interface Credentials {
  readonly email: string;
  readonly password: string;
}
