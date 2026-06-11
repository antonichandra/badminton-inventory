import { mutation, query } from "./_generated/server";

export const DEFAULT_SPORTS = [
  { name: "Badminton", slug: "badminton" },
  { name: "Futsal", slug: "futsal" },
  { name: "Basket", slug: "basket" },
  { name: "Tenis", slug: "tenis" },
  { name: "Voli", slug: "voli" },
] as const;

export const seedSports = mutation({
  args: {},
  handler: async (ctx) => {
    const results: string[] = [];
    const now = Date.now();

    for (const sport of DEFAULT_SPORTS) {
      const existing = await ctx.db
        .query("sports")
        .withIndex("by_slug", (q) => q.eq("slug", sport.slug))
        .unique();

      if (!existing) {
        await ctx.db.insert("sports", {
          name: sport.name,
          slug: sport.slug,
          isActive: true,
          createdAt: now,
        });
        results.push(`Created sport: ${sport.name}`);
      } else {
        await ctx.db.patch(existing._id, {
          name: sport.name,
          isActive: true,
        });
        results.push(`Synced sport: ${sport.name}`);
      }
    }

    return results;
  },
});

export const listSports = query({
  args: {},
  handler: async (ctx) => {
    const sports = await ctx.db.query("sports").collect();
    return sports
      .filter((sport) => sport.isActive)
      .map((sport) => ({
        value: sport._id,
        label: sport.name,
        sportSlug: sport.slug,
      }))
      .sort((a, b) => a.label.localeCompare(b.label));
  },
});
