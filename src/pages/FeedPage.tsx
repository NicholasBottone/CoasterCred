import { useState } from "react";
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { formatDate, formatDistanceToNow } from "../lib/dateUtils";
import { Avatar } from "../components/Avatar";
import { CoasterModal, type CoasterSummary } from "../components/CoasterModal";
import { UserProfileModal } from "../components/UserProfileModal";

export function FeedPage() {
  const feed = useQuery(api.rideLogs.getFeed);
  const [selectedCoaster, setSelectedCoaster] = useState<CoasterSummary | null>(null);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);

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
    <>
      <div className="max-w-lg mx-auto px-4 py-4 flex flex-col gap-3">
        <h2 className="text-lg font-bold text-gray-800">Activity Feed</h2>
        {feed.map((item: any) => (
          <FeedCard
            key={item._id}
            item={item}
            onSelectCoaster={(coaster) => setSelectedCoaster(coaster)}
            onSelectUser={(userId) => setSelectedUserId(userId)}
          />
        ))}
      </div>

      {selectedCoaster && (
        <CoasterModal coaster={selectedCoaster} onClose={() => setSelectedCoaster(null)} />
      )}

      {selectedUserId && (
        <UserProfileModal userId={selectedUserId} onClose={() => setSelectedUserId(null)} />
      )}
    </>
  );
}

function FeedCard({
  item,
  onSelectCoaster,
  onSelectUser,
}: {
  item: any;
  onSelectCoaster: (coaster: CoasterSummary) => void;
  onSelectUser: (userId: string) => void;
}) {
  const coaster = item.coaster;
  const user = item.user;
  const profile = item.profile;
  const badgeClassName = item.isFirstRide
    ? "bg-green-100 text-green-700"
    : "bg-blue-100 text-blue-700";
  const badgeLabel = item.isFirstRide
    ? "First ride 🎉"
    : `Ride #${item.rideOrdinal}`;

  return (
    <div className="bg-white rounded-xl shadow-sm border p-4">
      <div className="flex items-center gap-3 mb-3">
        <button
          onClick={() => onSelectUser(user?._id)}
          className="flex items-center gap-3 min-w-0 text-left"
        >
          <Avatar
            avatarUrl={profile?.avatarUrl}
            name={user?.name}
            sizeClassName="w-9 h-9"
            textClassName="text-sm"
          />
          <div className="min-w-0">
            <p className="font-semibold text-gray-800 text-sm truncate">
              {user?.name ?? "Unknown"}
            </p>
            <p className="text-xs text-gray-400">{formatDistanceToNow(item._creationTime)}</p>
          </div>
        </button>
        <div className={`ml-auto text-xs px-2 py-0.5 rounded-full font-medium ${badgeClassName}`}>
          {badgeLabel}
        </div>
      </div>
      <button
        onClick={() => onSelectCoaster(coaster)}
        className="w-full bg-gray-50 rounded-lg p-3 text-left hover:bg-gray-100 transition-colors"
      >
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
        {item.notes && (
          <p className="mt-2 text-sm text-gray-600 italic">"{item.notes}"</p>
        )}
        <p className="mt-2 text-xs text-gray-400">
          Rode on {formatDate(item.rideDate)}
        </p>
      </button>
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
