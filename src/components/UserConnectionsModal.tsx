import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Avatar } from "./Avatar";
import { useScrollToTop } from "../hooks/useScrollToTop";
import { ModalCloseButton, ModalContainer } from "./ModalContainer";

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
  const scrollRef = useScrollToTop([userId, kind]);
  const connections = useQuery(apiAny.profiles.getUserConnections, { userId, kind });
  const title = kind === "followers" ? "Followers" : "Following";

  return (
    <ModalContainer onClose={onClose} maxWidth="md" scrollRef={scrollRef}>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100">{title}</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400">Browse this rider's network</p>
          </div>
          <ModalCloseButton onClose={onClose} />
        </div>

        {connections === undefined ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        ) : connections.length === 0 ? (
          <p className="py-10 text-center text-sm text-gray-400 dark:text-gray-500">No {kind} yet</p>
        ) : (
          <div className="flex flex-col gap-2 max-h-[24rem] overflow-y-auto">
            {connections.map((entry: any) => (
              <button
                key={entry.user._id}
                onClick={() => onSelectUser(entry.user._id)}
                className="surface-subtle interactive-lift flex items-center gap-3 px-3 py-3 text-left"
              >
                <Avatar
                  avatarUrl={entry.profile?.avatarUrl}
                  name={entry.user?.name}
                  sizeClassName="w-10 h-10"
                  textClassName="text-base"
                />
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-gray-900 dark:text-gray-100">
                    {entry.user?.name ?? "Unknown rider"}
                  </p>
                  {entry.profile?.username && (
                    <p className="truncate text-xs text-gray-400 dark:text-gray-500">@{entry.profile.username}</p>
                  )}
                  {entry.profile?.homepark && (
                    <p className="truncate text-xs text-gray-500 dark:text-gray-400">
                      Home park: {entry.profile.homepark}
                    </p>
                  )}
                </div>
              </button>
            ))}
          </div>
        )}
    </ModalContainer>
  );
}
