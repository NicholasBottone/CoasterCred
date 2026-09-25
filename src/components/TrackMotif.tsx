import type { ReactNode } from "react";

export type TrackVariant = "airtime" | "lift" | "topHat" | "loop" | "roll";

// Decorative geometry, never a diagram of a named ride. All five drawings use
// the same 144×64 frame and rail weight; curves are authored, not sampled lines.
function TrackFrame({ children }: { children: ReactNode }) {
  return (
    <svg
      className="track-motif"
      viewBox="0 0 144 64"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.35"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {children}
    </svg>
  );
}

export function AirtimeTrack() {
  return (
    <TrackFrame>
      <path d="M4 51 C25 51 28 13 53 13 S80 51 101 51 C116 51 118 35 132 35 L140 35" />
      <path d="M4 56 C29 56 32 18 53 18 S78 56 101 56 C119 56 122 40 132 40 L140 40" />
      <path
        opacity=".5"
        d="M19 42l4 3 M34 21l3 4 M53 13v5 M72 21l-3 4 M87 43l-4 3 M101 51v5 M125 37l2 4"
      />
    </TrackFrame>
  );
}

export function LiftDropTrack() {
  return (
    <TrackFrame>
      <path d="M4 53 H15 Q20 53 25 48 L65 10 Q72 3 77 14 C83 29 77 53 106 53 H140" />
      <path d="M4 58 H15 Q23 58 29 52 L68 14 Q71 11 73 16 C78 31 74 58 106 58 H140" />
      <path
        opacity=".5"
        d="M32 42l4 4 M44 30l4 4 M56 19l4 4 M69 7l1 6 M80 32l-5 1 M92 50l-3 4 M119 53v5"
      />
      <path opacity=".22" d="M48 35v23 M68 16v42" />
    </TrackFrame>
  );
}

export function TopHatTrack() {
  return (
    <TrackFrame>
      <path d="M4 53 H35 C48 53 49 46 49 32 V23 C49 3 80 3 80 23 V32 C80 46 85 53 105 53 H140" />
      <path d="M4 58 H35 C53 58 54 46 54 32 V23 C54 10 75 10 75 23 V32 C75 50 85 58 105 58 H140" />
      <path
        opacity=".5"
        d="M18 53v5 M36 53v5 M49 32h5 M51 15l4 3 M64 8v5 M78 15l-4 3 M75 32h5 M101 53v5 M122 53v5"
      />
    </TrackFrame>
  );
}

export function LoopTrack() {
  return (
    <TrackFrame>
      <path d="M4 54 H47 C80 54 91 37 91 22 C91 2 58 2 58 22 C58 39 76 54 108 54 H140" />
      <path d="M4 59 H47 C83 59 96 39 96 22 C96-4 53-4 53 22 C53 42 76 59 108 59 H140" />
      <path
        opacity=".5"
        d="M24 54v5 M47 54v5 M87 38l4 2 M91 22h5 M74 7V2 M53 22h5 M58 39l4-2 M113 54v5 M133 54v5"
      />
    </TrackFrame>
  );
}

export function RollTrack() {
  return (
    <TrackFrame>
      <path d="M4 45 C26 45 30 15 54 15 C77 15 91 49 72 49 C53 49 67 15 90 15 C114 15 118 45 140 45" />
      <path d="M4 50 C28 50 34 20 54 20 C73 20 84 44 72 44 C60 44 71 20 90 20 C110 20 116 50 140 50" />
      <path
        opacity=".5"
        d="M20 39l3 4 M38 21l2 5 M54 15v5 M72 44v5 M90 15v5 M105 21l-2 5 M124 39l-3 4"
      />
    </TrackFrame>
  );
}

const MOTIFS = {
  airtime: AirtimeTrack,
  lift: LiftDropTrack,
  topHat: TopHatTrack,
  loop: LoopTrack,
  roll: RollTrack,
};

export function TrackMotif({ variant }: { variant: TrackVariant }) {
  const Motif = MOTIFS[variant];
  return <Motif />;
}

export function PageHeading({
  title,
  motif,
  eyebrow = false,
  subtitle,
}: {
  title: string;
  motif: TrackVariant;
  eyebrow?: boolean;
  subtitle?: ReactNode;
}) {
  return (
    <div className="page-heading">
      {subtitle ? (
        <div className="min-w-0">
          {eyebrow ? (
            <p className="technical-label">{title}</p>
          ) : (
            <h1>{title}</h1>
          )}
          <div className="mt-1">{subtitle}</div>
        </div>
      ) : eyebrow ? (
        <p className="technical-label">{title}</p>
      ) : (
        <h1>{title}</h1>
      )}
      <TrackMotif variant={motif} />
    </div>
  );
}
