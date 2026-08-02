export const USER_ID_BADGE_COLOR_COUNT = 6;

export interface UserLabel {
  label: string;
  colorIndex: number;
}

export function getUniqueUserLabel(
  userId: string | null | undefined,
): string | null {
  return userId ? getUserIdLabel(userId).label : null;
}

function getUserLabel(userId: string): UserLabel {
  const compactUserId = userId.replaceAll('-', '');
  const userIdHash = [...compactUserId].reduce(
    (hash, character) => (hash * 31 + character.charCodeAt(0)) >>> 0,
    0,
  );
  const colorIndex = userIdHash % USER_ID_BADGE_COLOR_COUNT;
  const label = userIdHash.toString(36).toUpperCase().padStart(6, '0').slice(-6);

  return { label, colorIndex };
}

export function getUserIdLabel(userId: string): UserLabel {
  return getUserLabel(userId);
}