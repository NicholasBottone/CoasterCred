# CoasterCred - Roller Coaster Social Review Platform
  
This is a project built with [Chef](https://chef.convex.dev) using [Convex](https://convex.dev) as its backend.
 You can find docs about Chef with useful information like how to deploy to production [here](https://docs.convex.dev/chef).
  
This project is connected to the Convex deployment named [`determined-crow-633`](https://dashboard.convex.dev/d/determined-crow-633).

## Features

🏠 Feed — Real-time activity stream showing your rides and friends' recent logs with coaster details, ratings, and notes.

📋 My List — Your personal ranked coaster list with drag-up/down reordering. Gold/silver/bronze medals for top 3. Logging a coaster auto-adds it to your list.

🔍 Search — Search coasters from the (currently hardcoded) database with stats. Click through to launch Coaster Detail page.

🏆 Leaderboard — View the rankings of which of your friends has been riding the most coasters lately.

👤 Profile — View your stats, bio, home park, rankings, ride log, and who you follow. Follow/unfollow other users. Edit your profile.

🎢 Coaster Detail Page — Tap any coaster to see full stats (height, speed, length, inversions, year), log a ride with notes, or edit/remove existing logs. The ranking process for the coaster is similar to Beli, where instead of explicitly assigning a score, you repeatedly choose between two coasters, choosing which is better, which will automatically build your ranked order for you.

## Project structure
  
The frontend code is in the `app` directory and is built with [Vite](https://vitejs.dev/).
  
The backend code is in the `convex` directory.
  
`npm run dev` will start the frontend and backend servers.

## App authentication

Chef apps use [Convex Auth](https://auth.convex.dev/) with Anonymous auth for easy sign in. You may wish to change this before deploying your app.

## Developing and deploying your app

Check out the [Convex docs](https://docs.convex.dev/) for more information on how to develop with Convex.
* If you're new to Convex, the [Overview](https://docs.convex.dev/understanding/) is a good place to start
* Check out the [Hosting and Deployment](https://docs.convex.dev/production/) docs for how to deploy your app
* Read the [Best Practices](https://docs.convex.dev/understanding/best-practices/) guide for tips on how to improve you app further

## HTTP API

User-defined http routes are defined in the `convex/router.ts` file. We split these routes into a separate file from `convex/http.ts` to allow us to prevent the LLM from modifying the authentication routes.

## Todo List
- [ ] Add more sophisticated user authentication 
- [ ] Add a more sophisticated coaster database
  - [ ] I would like to find a public database (like RCDB) of coasters with stats like height, speed, length, inversions, year, etc. If I can't find one, I may need to build a scraper to pull this data from somewhere like RCDB.
