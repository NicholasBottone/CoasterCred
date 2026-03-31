import { internalMutation } from "./_generated/server";
import { v } from "convex/values";

const COASTERS = [
  { name: "Steel Vengeance", park: "Cedar Point", location: "Sandusky, OH", type: "Hybrid", manufacturer: "RMC", heightFt: 205, speedMph: 74, lengthFt: 5740, inversions: 4, yearOpened: 2018 },
  { name: "Fury 325", park: "Carowinds", location: "Charlotte, NC", type: "Steel", manufacturer: "B&M", heightFt: 325, speedMph: 95, lengthFt: 6602, inversions: 0, yearOpened: 2015 },
  { name: "El Toro", park: "Six Flags Great Adventure", location: "Jackson, NJ", type: "Wood", manufacturer: "Intamin", heightFt: 181, speedMph: 70, lengthFt: 4400, inversions: 0, yearOpened: 2006 },
  { name: "Millennium Force", park: "Cedar Point", location: "Sandusky, OH", type: "Steel", manufacturer: "Intamin", heightFt: 310, speedMph: 93, lengthFt: 6595, inversions: 0, yearOpened: 2000 },
  { name: "Intimidator 305", park: "Kings Dominion", location: "Doswell, VA", type: "Steel", manufacturer: "Intamin", heightFt: 305, speedMph: 90, lengthFt: 5100, inversions: 0, yearOpened: 2010 },
  { name: "Maverick", park: "Cedar Point", location: "Sandusky, OH", type: "Steel", manufacturer: "Intamin", heightFt: 105, speedMph: 70, lengthFt: 4450, inversions: 2, yearOpened: 2007 },
  { name: "Twisted Cyclone", park: "Six Flags Over Georgia", location: "Austell, GA", type: "Hybrid", manufacturer: "RMC", heightFt: 97, speedMph: 55, lengthFt: 2400, inversions: 3, yearOpened: 2018 },
  { name: "Lightning Rod", park: "Dollywood", location: "Pigeon Forge, TN", type: "Wood", manufacturer: "RMC", heightFt: 165, speedMph: 73, lengthFt: 3800, inversions: 0, yearOpened: 2016 },
  { name: "Phantom's Revenge", park: "Kennywood", location: "West Mifflin, PA", type: "Steel", manufacturer: "Morgan", heightFt: 228, speedMph: 85, lengthFt: 3000, inversions: 0, yearOpened: 2001 },
  { name: "Voyage", park: "Holiday World", location: "Santa Claus, IN", type: "Wood", manufacturer: "The Gravity Group", heightFt: 163, speedMph: 67, lengthFt: 6442, inversions: 0, yearOpened: 2006 },
  { name: "Twisted Timbers", park: "Kings Dominion", location: "Doswell, VA", type: "Hybrid", manufacturer: "RMC", heightFt: 109, speedMph: 54, lengthFt: 2704, inversions: 3, yearOpened: 2018 },
  { name: "Skyrush", park: "Hersheypark", location: "Hershey, PA", type: "Steel", manufacturer: "Intamin", heightFt: 200, speedMph: 75, lengthFt: 3600, inversions: 0, yearOpened: 2012 },
  { name: "Shambhala", park: "PortAventura", location: "Salou, Spain", type: "Steel", manufacturer: "B&M", heightFt: 249, speedMph: 83, lengthFt: 5449, inversions: 0, yearOpened: 2012 },
  { name: "Taron", park: "Phantasialand", location: "Brühl, Germany", type: "Steel", manufacturer: "Intamin", heightFt: 98, speedMph: 72, lengthFt: 4429, inversions: 0, yearOpened: 2016 },
  { name: "Hyperion", park: "Energylandia", location: "Zator, Poland", type: "Steel", manufacturer: "Intamin", heightFt: 249, speedMph: 88, lengthFt: 5577, inversions: 0, yearOpened: 2018 },
  { name: "Hakugei", park: "Nagashima Spa Land", location: "Kuwana, Japan", type: "Hybrid", manufacturer: "RMC", heightFt: 148, speedMph: 75, lengthFt: 4199, inversions: 3, yearOpened: 2019 },
  { name: "Wildfire", park: "Kolmården", location: "Norrköping, Sweden", type: "Hybrid", manufacturer: "RMC", heightFt: 183, speedMph: 72, lengthFt: 3609, inversions: 3, yearOpened: 2016 },
  { name: "Zadra", park: "Energylandia", location: "Zator, Poland", type: "Hybrid", manufacturer: "RMC", heightFt: 206, speedMph: 75, lengthFt: 4003, inversions: 3, yearOpened: 2019 },
  { name: "Velocicoaster", park: "Universal's Islands of Adventure", location: "Orlando, FL", type: "Steel", manufacturer: "Intamin", heightFt: 155, speedMph: 70, lengthFt: 4700, inversions: 4, yearOpened: 2021 },
  { name: "Iron Gwazi", park: "Busch Gardens Tampa", location: "Tampa, FL", type: "Hybrid", manufacturer: "RMC", heightFt: 206, speedMph: 76, lengthFt: 4075, inversions: 3, yearOpened: 2022 },
  { name: "Kingda Ka", park: "Six Flags Great Adventure", location: "Jackson, NJ", type: "Steel", manufacturer: "Intamin", heightFt: 456, speedMph: 128, lengthFt: 3118, inversions: 0, yearOpened: 2005 },
  { name: "Top Thrill 2", park: "Cedar Point", location: "Sandusky, OH", type: "Steel", manufacturer: "Zamperla", heightFt: 420, speedMph: 120, lengthFt: 2800, inversions: 0, yearOpened: 2024 },
  { name: "Leviathan", park: "Canada's Wonderland", location: "Vaughan, ON", type: "Steel", manufacturer: "B&M", heightFt: 306, speedMph: 92, lengthFt: 5486, inversions: 0, yearOpened: 2012 },
  { name: "Nitro", park: "Six Flags Great Adventure", location: "Jackson, NJ", type: "Steel", manufacturer: "B&M", heightFt: 230, speedMph: 80, lengthFt: 5394, inversions: 0, yearOpened: 2001 },
  { name: "Goliath", park: "Six Flags Magic Mountain", location: "Valencia, CA", type: "Hybrid", manufacturer: "RMC", heightFt: 180, speedMph: 72, lengthFt: 3000, inversions: 3, yearOpened: 2014 },
  { name: "X2", park: "Six Flags Magic Mountain", location: "Valencia, CA", type: "Steel", manufacturer: "Arrow", heightFt: 200, speedMph: 76, lengthFt: 3610, inversions: 0, yearOpened: 2008 },
  { name: "Tatsu", park: "Six Flags Magic Mountain", location: "Valencia, CA", type: "Steel", manufacturer: "B&M", heightFt: 170, speedMph: 62, lengthFt: 3602, inversions: 4, yearOpened: 2006 },
  { name: "Montu", park: "Busch Gardens Tampa", location: "Tampa, FL", type: "Steel", manufacturer: "B&M", heightFt: 150, speedMph: 65, lengthFt: 3983, inversions: 7, yearOpened: 1996 },
  { name: "Alpengeist", park: "Busch Gardens Williamsburg", location: "Williamsburg, VA", type: "Steel", manufacturer: "B&M", heightFt: 195, speedMph: 67, lengthFt: 3828, inversions: 6, yearOpened: 1997 },
  { name: "Griffon", park: "Busch Gardens Williamsburg", location: "Williamsburg, VA", type: "Steel", manufacturer: "B&M", heightFt: 205, speedMph: 71, lengthFt: 3108, inversions: 2, yearOpened: 2007 },
];

export const seedCoasters = internalMutation({
  args: {},
  handler: async (ctx) => {
    const existing = await ctx.db.query("coasters").take(1);
    if (existing.length > 0) return;
    for (const coaster of COASTERS) {
      await ctx.db.insert("coasters", coaster);
    }
  },
});
