import { convexAuth, getAuthUserId } from "@convex-dev/auth/server";
import Discord from "@auth/core/providers/discord";
import Google from "@auth/core/providers/google";
import type { MutationCtx } from "./_generated/server";
import { validateDisplayName } from "./validation";

export const { auth, signIn, signOut, store, isAuthenticated } = convexAuth({
  providers: [
    Discord({
      clientId: process.env.AUTH_DISCORD_ID,
      clientSecret: process.env.AUTH_DISCORD_SECRET,
      authorization: {
        params: {
          scope: "identify",
        },
      },
      profile(profile) {
        if (profile.avatar === null) {
          const defaultAvatarNumber =
            profile.discriminator === "0"
              ? Number(BigInt(profile.id) >> BigInt(22)) % 6
              : parseInt(profile.discriminator) % 5;
          profile.image_url = `https://cdn.discordapp.com/embed/avatars/${defaultAvatarNumber}.png`;
        } else {
          const format = profile.avatar.startsWith("a_") ? "gif" : "png";
          profile.image_url = `https://cdn.discordapp.com/avatars/${profile.id}/${profile.avatar}.${format}`;
        }

        return {
          id: profile.id,
          name: profile.global_name ?? profile.username,
          image: profile.image_url,
          username: profile.username,
          authProviderService: "discord",
          authProviderId: profile.id,
        };
      },
    }),
    Google({
      clientId: process.env.AUTH_GOOGLE_ID,
      clientSecret: process.env.AUTH_GOOGLE_SECRET,
      profile(profile) {
        const email = typeof profile.email === "string" ? profile.email.trim() : "";
        const atIndex = email.indexOf("@");
        const username =
          atIndex > 0 ? email.slice(0, atIndex).trim() : "";

        return {
          id: profile.sub,
          name: profile.name,
          image: profile.picture,
          username,
          authProviderService: "google",
          authProviderId: profile.sub,
        };
      },
    }),
  ],
  callbacks: {
    async createOrUpdateUser(ctx, args) {
      const db = (ctx as MutationCtx).db;
      const existingUserId = args.existingUserId;
      const existingProfile =
        existingUserId === null
          ? null
          : await db
              .query("userProfiles")
              .withIndex("by_userId", (q) => q.eq("userId", existingUserId))
              .unique();

      const username = String(args.profile.username ?? "").trim();
      if (!username) {
        throw new Error("Provider username is required");
      }

      const seededDisplayName = validateDisplayName(
        String(args.profile.name ?? username).trim(),
      );
      const avatarUrl = typeof args.profile.image === "string" ? args.profile.image : undefined;
      const userPatch = {
        name: existingProfile?.displayName ?? seededDisplayName,
        image: avatarUrl,
      };

      let userId = existingUserId;
      if (userId) {
        await db.patch(userId, userPatch);
      } else {
        userId = await db.insert("users", { ...userPatch, role: null });
      }

      if (!userId) {
        throw new Error("Could not create user");
      }

      const profilePatch = {
        displayName: existingProfile?.displayName ?? seededDisplayName,
        username,
        usernameLower: username.toLowerCase(),
        avatarUrl,
      };

      const currentProfile = await db
        .query("userProfiles")
        .withIndex("by_userId", (q) => q.eq("userId", userId))
        .unique();

      if (!currentProfile) {
        await db.insert("userProfiles", { userId, ...profilePatch });
      } else {
        await db.patch(currentProfile._id, profilePatch);
      }

      return userId;
    },
  },
});
