// Shared demo account. This account owns exactly one project (the Elon Musk
// EB-1A sample) and nothing else. Every visitor to /demo signs into it and
// lands in the real /projects/$id workspace. A nightly cron resets the
// project back to its seed state.
//
// The password is intentionally embedded — it protects nothing (every
// visitor is entitled to use the demo). It must match the value stored in
// the DEMO_USER_PASSWORD server secret and the value hashed into
// auth.users in the demo-seed migration.
export const DEMO_USER_ID = "00000000-0000-0000-0000-0000000000d1";
export const DEMO_PROJECT_ID = "00000000-0000-0000-0000-0000000000d2";
export const DEMO_EMAIL = "demo@visaworker.ai";
export const DEMO_PASSWORD = "vW-demo-4f8e9a2b7c3d1e6aB5Kq";

export function isDemoUser(userId: string | null | undefined): boolean {
  return !!userId && userId === DEMO_USER_ID;
}
