function samePlacePart(left: string, right: string) {
  return left.trim().toLocaleLowerCase() === right.trim().toLocaleLowerCase();
}

export function normalizeCoasterLocation(location: string, country?: string) {
  const parts = location.split(",").map((part) => part.trim()).filter(Boolean);
  if (country?.trim()) {
    // Some source infoboxes include the country in `location` as well as `country`.
    // Only collapse a repeated country; city and state can legitimately match.
    while (
      parts.length >= 2 &&
      samePlacePart(parts[parts.length - 1], country) &&
      samePlacePart(parts[parts.length - 2], country)
    ) {
      parts.pop();
    }
  }
  return parts.join(", ");
}

export function locationHasPart(location: string, part: string, skipCity = false) {
  const parts = location.split(",");
  return parts.slice(skipCity ? 1 : 0).some((existing) => samePlacePart(existing, part));
}
