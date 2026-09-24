export function computeRankingScore(rank: number, totalCount: number) {
  if (totalCount <= 1) return 10.0;

  const percentile = (totalCount - rank) / (totalCount - 1);
  const score = 1 + percentile * 9;
  return Math.round(score * 10) / 10;
}
