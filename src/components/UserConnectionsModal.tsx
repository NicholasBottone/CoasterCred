import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Avatar } from "./Avatar";

const apiAny = api as any;

export function UserConnectionsModal({
  userId,
  kind,
  onClose,
  onSelectUser,
}: {
  userId: string;
  kind: "followers" | "following";
  onClose: () => void;
  onSelectUser: (userId: string) => void;
}) {
  const connections = useQuery(apiAny.profiles.getUserConnections, { userId, kind });
  const title = kind === "followers" ? "Followers" : "Following";

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 px-4 pb-4">
      <div className="bg-white rounded-2xl w-full max-w-md shadow-xl p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-lg font-bold text-gray-900">{title}</h3>
            <p className="text-sm text-gray-500">Browse this rider's network</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none">×</button>
        </div>

        {connections === undefined ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        ) : connections.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-10">No {kind} yet</p>
        ) : (
          <div className="flex flex-col gap-2 max-h-[24rem] overflow-y-auto">
            {connections.map((entry: any) => (
              <button
                key={entry.user._id}
                onClick={() => onSelectUser(entry.user._id)}
                className="flex items-center gap-3 rounded-xl border border-gray-100 bg-gray-50 px-3 py-3 text-left hover:bg-gray-100 transition-colors"
              >
                <Avatar
                  avatarUrl={entry.profile?.avatarUrl}
                  name={entry.user?.name}
                  sizeClassName="w-10 h-10"
                  textClassName="text-base"
                />
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-gray-900 truncate">
                    {entry.user?.name ?? "Unknown rider"}
                  </p>
                  <p className="text-xs text-gray-500 truncate">
                    {entry.profile?.homepark ? `Home park: ${entry.profile.homepark}` : "No home park added yet"}
                  </p>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
