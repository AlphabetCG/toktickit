// BR-56, as a pure rule (UNIT-11): removing `targetId` from the active
// Administrators must leave at least one. Because the acting Administrator is
// always active and self-removal is refused first (BR-54, BR-55), this only bites
// when two Administrators remove each other concurrently.
export function wouldKeepAnActiveAdmin(activeAdminIds: number[], targetId: number): boolean {
  return activeAdminIds.some((id) => id !== targetId);
}
