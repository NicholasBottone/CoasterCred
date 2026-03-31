import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { formatDistanceToNow } from "../lib/dateUtils";

export function FeedPage() {
  const feed = useQuery(api.rideLogs.getFeed);

  if (feed === undefined) {
    return <LoadingSpinner />;
  }

  if (feed.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 px-4 text-center">
        <div className="text-5xl mb-4">🎢</div>
        <h2 className="text-xl font-semibold text-gray-700 mb-2">Your feed is empty</h2>
        <p className="text-gray-500 text-sm">
          Follow other enthusiasts or log your first ride to get started!
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-lg mx-auto px-4 py-4 flex flex-col gap-3">
      <h2 className="text-lg font-bold text-gray-800">Activity Feed</h2>
      {feed.map((item: any) => (
        <FeedCard key={item._id} item={item} />
      ))}
    </div>
  );
}

function FeedCard({ item }: { item: any }) {
  const coaster = item.coaster;
  const user = item.user;
  const profile = item.profile;

  return (
    <div className="bg-white rounded-xl shadow-sm border p-4">
      <div className="flex items-center gap-3 mb-3">
        <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-sm">
          {user?.name?.[0]?.toUpperCase() ?? "?"}
        </div>
        <div>
          <p className="font-semibold text-gray-800 text-sm">{user?.name ?? user?.email ?? "Unknown"}</p>
          <p className="text-xs text-gray-400">{formatDistanceToNow(item._creationTime)}</p>
        </div>
        <div className="ml-auto text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium">
          Rode it!
        </div>
      </div>
      <div className="bg-gray-50 rounded-lg p-3">
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="font-bold text-gray-900">{coaster?.name ?? "Unknown Coaster"}</p>
            <p className="text-xs text-gray-500">{coaster?.park} · {coaster?.location}</p>
          </div>
          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
            coaster?.type === "Hybrid" ? "bg-purple-100 text-purple-700" :
            coaster?.type === "Wood" ? "bg-amber-100 text-amber-700" :
            "bg-blue-100 text-blue-700"
          }`}>
            {coaster?.type}
          </span>
        </div>
        {item.rating && (
          <div className="mt-2 flex items-center gap-1">
            <span className="text-yellow-500 text-sm">★</span>
            <span className="text-sm font-semibold text-gray-700">{item.rating}/10</span>
          </div>
        )}
        {item.notes && (
          <p className="mt-2 text-sm text-gray-600 italic">"{item.notes}"</p>
        )}
      </div>
    </div>
  );
}

function LoadingSpinner() {
  return (
    <div className="flex justify-center items-center py-20">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
    </div>
  );
}
