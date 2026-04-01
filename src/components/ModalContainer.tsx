import React from "react";

interface ModalContainerProps {
  onClose: () => void;
  maxWidth?: "md" | "2xl";
  scrollRef: React.RefObject<HTMLDivElement | null>;
  children: React.ReactNode;
}

export function ModalContainer({
  onClose,
  maxWidth = "md",
  scrollRef,
  children,
}: ModalContainerProps) {
  const maxWidthClass = maxWidth === "md" ? "max-w-md" : "max-w-2xl";

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 px-4 pb-4"
      onClick={onClose}
    >
      <div
        ref={scrollRef}
        className={`surface-card w-full ${maxWidthClass} max-h-[90vh] overflow-y-auto p-5 shadow-xl`}
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  );
}
