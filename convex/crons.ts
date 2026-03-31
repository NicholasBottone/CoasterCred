import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

crons.interval("seed coasters", { hours: 24 * 365 }, internal.seed.seedCoasters, {});

export default crons;
