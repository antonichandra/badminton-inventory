export const SPORT_EMOJI: Record<string, string> = {
  badminton: "🏸",
  futsal: "⚽",
  basket: "🏀",
  tenis: "🎾",
  voli: "🏐",
};

export function getSportEmoji(slug: string): string {
  return SPORT_EMOJI[slug] ?? "🏟️";
}
