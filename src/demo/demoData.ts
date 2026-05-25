export type DemoUser = {
  name: string;
  avatarUrl: string;
  homepark: string;
  bio: string;
  uniqueCoasters: number;
  topCoaster: string;
};

export type DemoCoaster = {
  name: string;
  park: string;
  location: string;
  type: string;
  score: number;
  manufacturer?: string;
  heightFt?: number;
  speedMph?: number;
  lengthFt?: number;
  inversions?: number;
  yearOpened?: number;
  uniqueRiders: number;
  totalLogs: number;
  friendAverage: number;
  friendRatings: Array<{
    user: Pick<DemoUser, "name" | "avatarUrl">;
    rank: number;
    score: number;
  }>;
};

export const demoUsers: DemoUser[] = [
  {
    name: "Maya",
    avatarUrl: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=200&q=80",
    homepark: "Cedar Point",
    bio: "Chasing elite airtime and keeping a running top 25.",
    uniqueCoasters: 74,
    topCoaster: "Steel Vengeance",
  },
  {
    name: "Jonah",
    avatarUrl: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=200&q=80",
    homepark: "Kings Island",
    bio: "Mostly here for gigas, night rides, and overly serious ranking debates.",
    uniqueCoasters: 58,
    topCoaster: "Fury 325",
  },
  {
    name: "Avery",
    avatarUrl: "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?auto=format&fit=crop&w=200&q=80",
    homepark: "Hersheypark",
    bio: "Wood coaster defender. Will absolutely evangelize Phoenix to strangers.",
    uniqueCoasters: 45,
    topCoaster: "Phoenix",
  },
  {
    name: "Luca",
    avatarUrl: "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?auto=format&fit=crop&w=200&q=80",
    homepark: "Six Flags Magic Mountain",
    bio: "West coast coaster count climbing fast.",
    uniqueCoasters: 39,
    topCoaster: "Twisted Colossus",
  },
  {
    name: "Rin",
    avatarUrl: "https://images.unsplash.com/photo-1488426862026-3ee34a7d66df?auto=format&fit=crop&w=200&q=80",
    homepark: "Busch Gardens Williamsburg",
    bio: "Trying to ride every major launch coaster in the country.",
    uniqueCoasters: 31,
    topCoaster: "Pantheon",
  },
];

export const demoCoasters: DemoCoaster[] = [
  {
    name: "Steel Vengeance",
    park: "Cedar Point",
    location: "Sandusky, Ohio",
    type: "Hybrid",
    score: 10.0,
    manufacturer: "Rocky Mountain Construction",
    heightFt: 205,
    speedMph: 74,
    lengthFt: 5740,
    inversions: 4,
    yearOpened: 2018,
    uniqueRiders: 18,
    totalLogs: 43,
    friendAverage: 9.6,
    friendRatings: [
      { user: { name: "Maya", avatarUrl: demoUsers[0].avatarUrl }, rank: 1, score: 10.0 },
      { user: { name: "Jonah", avatarUrl: demoUsers[1].avatarUrl }, rank: 2, score: 9.5 },
      { user: { name: "Avery", avatarUrl: demoUsers[2].avatarUrl }, rank: 3, score: 9.2 },
    ],
  },
  {
    name: "Fury 325",
    park: "Carowinds",
    location: "Charlotte, North Carolina",
    type: "Steel",
    score: 9.4,
    manufacturer: "Bolliger & Mabillard",
    heightFt: 325,
    speedMph: 95,
    lengthFt: 6602,
    inversions: 0,
    yearOpened: 2015,
    uniqueRiders: 16,
    totalLogs: 38,
    friendAverage: 9.3,
    friendRatings: [
      { user: { name: "Jonah", avatarUrl: demoUsers[1].avatarUrl }, rank: 1, score: 9.8 },
      { user: { name: "Maya", avatarUrl: demoUsers[0].avatarUrl }, rank: 3, score: 9.1 },
    ],
  },
  {
    name: "Phoenix",
    park: "Knoebels",
    location: "Elysburg, Pennsylvania",
    type: "Wood",
    score: 8.9,
    manufacturer: "Philadelphia Toboggan Coasters",
    heightFt: 78,
    speedMph: 45,
    lengthFt: 2800,
    inversions: 0,
    yearOpened: 1985,
    uniqueRiders: 13,
    totalLogs: 27,
    friendAverage: 8.8,
    friendRatings: [
      { user: { name: "Avery", avatarUrl: demoUsers[2].avatarUrl }, rank: 1, score: 9.6 },
      { user: { name: "Rin", avatarUrl: demoUsers[4].avatarUrl }, rank: 5, score: 8.0 },
    ],
  },
];

export const demoFeed = [
  {
    id: "feed-1",
    user: demoUsers[0],
    coaster: demoCoasters[0],
    rideDate: "2026-03-26",
    relativeTime: "2h ago",
    badges: [{ label: "First ride", tone: "first" as const }],
    score: 9.8,
    notes: "That first drop absolutely erased me.",
  },
  {
    id: "feed-2",
    user: demoUsers[1],
    coaster: demoCoasters[1],
    rideDate: "2026-03-24",
    relativeTime: "5h ago",
    badges: [
      { label: "100th coaster", tone: "countMilestone" as const, value: 100 },
      { label: "First coaster in Canada", tone: "countryFirst" as const, country: "Canada" },
    ],
    score: 9.4,
    notes: "Still the best giga pacing I’ve felt.",
  },
  {
    id: "feed-3",
    user: demoUsers[2],
    coaster: demoCoasters[2],
    rideDate: "2026-03-22",
    relativeTime: "1d ago",
    badges: [{ label: "25th coaster", tone: "countMilestone" as const, value: 25 }],
    score: 8.9,
    notes: "Way more airtime than I expected.",
  },
];

export const demoRankings = [
  { rank: 1, coaster: demoCoasters[0], score: 10.0 },
  { rank: 2, coaster: demoCoasters[1], score: 9.4 },
  { rank: 3, coaster: { ...demoCoasters[1], name: "VelociCoaster", park: "Islands of Adventure", location: "Orlando, Florida", score: 9.1 }, score: 9.1 },
  { rank: 4, coaster: demoCoasters[2], score: 8.7 },
  { rank: 5, coaster: { ...demoCoasters[0], name: "Iron Gwazi", park: "Busch Gardens Tampa", location: "Tampa, Florida", score: 8.5 }, score: 8.5 },
  { rank: 6, coaster: { ...demoCoasters[2], name: "El Toro", park: "Six Flags Great Adventure", location: "Jackson, New Jersey", score: 8.2 }, score: 8.2 },
];

export const demoLeaderboard = [
  { rank: 1, user: demoUsers[0], homepark: "Cedar Point", rideCount: 18, totalRideCount: 74, lastRide: "3h ago" },
  { rank: 2, user: demoUsers[1], homepark: "Kings Island", rideCount: 16, totalRideCount: 58, lastRide: "9h ago" },
  { rank: 3, user: demoUsers[2], homepark: "Hersheypark", rideCount: 13, totalRideCount: 45, lastRide: "1d ago" },
  { rank: 4, user: demoUsers[3], homepark: "Six Flags Magic Mountain", rideCount: 11, totalRideCount: 39, lastRide: "2d ago" },
  { rank: 5, user: demoUsers[4], homepark: "Busch Gardens Williamsburg", rideCount: 9, totalRideCount: 31, lastRide: "3d ago" },
];
