// Shared demo account. This account owns exactly one project (the Elon Musk
// EB-1A sample) and nothing else. Every visitor to /demo signs into it and
// lands in the real /projects/$id workspace. A nightly cron resets the
// project back to its seed state.
//
// The account's password is NOT stored here. It is a real credential (it
// matches the value hashed into auth.users), so it lives only in the server
// env (DEMO_USER_PASSWORD) and the sign-in happens server-side — see
// src/lib/demo-auth.ts. Only non-secret identifiers belong in this file.
export const DEMO_USER_ID = "00000000-0000-0000-0000-0000000000d1";
export const DEMO_PROJECT_ID = "00000000-0000-0000-0000-0000000000d2";

export function isDemoUser(userId: string | null | undefined): boolean {
  return !!userId && userId === DEMO_USER_ID;
}
