import React from "react";

interface ModalContainerProps {
  onClose: () => void;
  maxWidth?: "md" | "2xl";
  scrollRef: React.RefObject<HTMLDivElement | null>;
  overlayClassName?: string;
  contentClassName?: string;
  children: React.ReactNode;
}

export function ModalContainer({
  onClose,
  maxWidth = "md",
  scrollRef,
  overlayClassName,
  contentClassName,
  children,
}: ModalContainerProps) {
  const maxWidthClass = maxWidth === "md" ? "max-w-md" : "max-w-2xl";

  return (
    <div
      className={`fixed inset-0 z-50 flex items-end justify-center bg-black/40 px-4 pb-4 sm:items-center ${overlayClassName ?? ""}`}
      onClick={onClose}
    >
      <div
        ref={scrollRef}
        className={`surface-card w-full ${maxWidthClass} max-h-[90vh] overflow-y-auto p-5 shadow-xl ${contentClassName ?? ""}`}
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  );
}

export function ModalCloseButton({ onClose }: { onClose: () => void }) {
  return (
    <button
      type="button"
      onClick={onClose}
      aria-label="Close modal"
      className="inline-flex h-11 w-11 flex-none items-center justify-center self-start rounded-full text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 active:bg-gray-200/70 dark:text-gray-500 dark:hover:bg-gray-800 dark:hover:text-gray-300 dark:active:bg-gray-700/80"
    >
      <span aria-hidden="true" className="text-xl leading-none">
        ×
      </span>
    </button>
  );
}
