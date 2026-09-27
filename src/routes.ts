export type Tab =
  "feed" | "myList" | "search" | "rankings" | "profile" | "admin";

export const TAB_PATHS: Record<Tab, string> = {
  feed: "/",
  myList: "/my-list",
  search: "/search",
  rankings: "/rankings",
  profile: "/profile",
  admin: "/admin",
};

export function tabFromPath(pathname: string): Tab | null {
  const normalizedPath = pathname.replace(/\/+$/, "") || "/";
  const entry = Object.entries(TAB_PATHS).find(
    ([, path]) => path === normalizedPath,
  );
  return (entry?.[0] as Tab | undefined) ?? null;
}

export function riderPath(userId: string): string {
  return `/riders/${encodeURIComponent(userId)}`;
}
