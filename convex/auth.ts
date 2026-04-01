import { convexAuth, getAuthUserId } from "@convex-dev/auth/server";
import { Password } from "@convex-dev/auth/providers/Password";
import { query } from "./_generated/server";
import { validateDisplayName } from "./validation";

export const { auth, signIn, signOut, store, isAuthenticated } = convexAuth({
  providers: [
    Password({
      profile: ((params: any) => {
        const email = String(params.email ?? "").trim().toLowerCase();
        const name = String(params.name ?? "").trim();

        if (!email) {
          throw new Error("Email is required");
        }

        if (params.flow === "signUp") {
          return { email, name: validateDisplayName(name) };
        }

        return { email };
      }) as any,
      validatePasswordRequirements: (password) => {
        if (password.length < 8) {
          throw new Error("Password must be at least 8 characters long");
        }

        if (!/[A-Za-z]/.test(password) || !/[0-9]/.test(password)) {
          throw new Error("Password must include at least one letter and one number");
        }
      },
    }),
  ],
  callbacks: {
    async afterUserCreatedOrUpdated(ctx, args) {
      const db = ctx.db as any;
      const existingProfile = await db
        .query("userProfiles")
        .withIndex("by_userId", (q: any) => q.eq("userId", args.userId))
        .unique();

      if (!existingProfile) {
        await db.insert("userProfiles", { userId: args.userId });
      }
    },
  },
});

export const loggedInUser = query({
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      return null;
    }
    const user = await ctx.db.get("users", userId);
    if (!user) {
      return null;
    }
    return user;
  },
});
