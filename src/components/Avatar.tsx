import { useState } from "react";

type AvatarProps = {
  avatarUrl?: string | null;
  name?: string | null;
  sizeClassName?: string;
  textClassName?: string;
};

export function Avatar({
  avatarUrl,
  name,
  sizeClassName = "w-10 h-10",
  textClassName = "text-sm",
}: AvatarProps) {
  const [imageFailed, setImageFailed] = useState(false);
  const initial = name?.[0]?.toUpperCase() ?? "?";
  const showImage = Boolean(avatarUrl) && !imageFailed;

  if (showImage) {
    return (
      <img
        src={avatarUrl ?? undefined}
        alt={name ?? "Profile photo"}
        onError={() => setImageFailed(true)}
        className={`${sizeClassName} rounded-full object-cover shrink-0 border border-gray-200 bg-gray-100`}
      />
    );
  }

  return (
    <div
      className={`${sizeClassName} rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold shrink-0 ${textClassName}`}
    >
      {initial}
    </div>
  );
}
