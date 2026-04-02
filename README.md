# CoasterCred - Roller Coaster Social Review Platform

CoasterCred is a social coaster-tracking app inspired by Beli. Users can log rides, build a personal ranked list through head-to-head comparisons, follow friends, and see who has been riding the most.

## Features

- 🏠 Feed — A social activity feed showing your rides and the recent ride logs of people you follow, including coaster details, ride dates, notes, and profile avatars.
- 📋 My List — Your personal ranked coaster list. First-time coaster logs are placed into the list using Beli-style comparison choices, and you can still make manual up/down adjustments afterward.
- 🔍 Search — Search the current coaster database, view coaster stats, log rides, add historical rides, and maintain per-coaster ride history with one ride log allowed per coaster per day.
- 🏆 Rankings — A friends leaderboard showing who has logged the most unique coaster credits over the last 30 days, 365 days, or all time.
- 👤 Profile — View and edit your display name, avatar URL, bio, and home park; see your unique coaster count and current #1 coaster; search for other users and follow/unfollow them.

## Project Structure

- `src/` — Frontend application built with Vite, React, TypeScript, and Tailwind CSS.
  - `src/pages/` — Top-level app destinations: Feed, My List, Search, Rankings, and Profile.
  - `src/components/` — Shared UI pieces such as the avatar component.
- `convex/` — Backend functions, schema, validation, and auth logic.
  - `convex/schema.ts` — Application schema, including profiles, follows, coasters, ride logs, and rankings.
  - `convex/auth.ts` — Convex Auth configuration for email/password sign-in.

`npm run dev` starts the frontend and Convex backend locally.

## Current Product Notes

- Coaster records are materialized from Coasterpedia on demand as riders search and log them.
- Avatar images currently load from user-supplied HTTPS URLs. Length/protocol validation is in place, but avatars are not yet proxied through first-party storage.
- Ride history supports historical logging and repeat rides, but duplicate rides do not create duplicate leaderboard credits inside a selected ranking window.

## Todo List

- [ ] Improve coaster discovery and search quality.
  Search currently works on a relatively small dataset and basic fields. Filtering, sorting, park/manufacturer facets, and better indexing will matter once the coaster catalog grows.

- [ ] Polish ride-history UX.
  The core data model now supports repeat and historical rides, but there is room to improve editing, grouping by trip/date, and exposing richer ride history across the app.
