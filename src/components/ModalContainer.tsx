import React, { useEffect, useRef } from "react";

interface ModalContainerProps {
  onClose: () => void;
  maxWidth?: "md" | "2xl";
  scrollRef: React.RefObject<HTMLDivElement | null>;
  overlayClassName?: string;
  contentClassName?: string;
  children: React.ReactNode;
  /** Opt-in detail flow: keep parent state mounted while a child supersedes it. */
  suspended?: boolean;
  label?: string;
}

export function ModalContainer({
  onClose,
  maxWidth = "md",
  scrollRef,
  overlayClassName,
  contentClassName,
  children,
  suspended = false,
  label,
}: ModalContainerProps) {
  const maxWidthClass = maxWidth === "md" ? "max-w-md" : "max-w-2xl";
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  useEffect(() => {
    if (!label || suspended) return;
    const sheet = scrollRef.current;
    if (!sheet) return;
    const previous = document.activeElement as HTMLElement | null;
    const focusable = () =>
      Array.from(
        sheet.querySelectorAll<HTMLElement>(
          'button:not(:disabled), a[href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex="0"]',
        ),
      ).filter((node) => node.getClientRects().length > 0);
    sheet.focus({ preventScroll: true });
    const onKey = (event: KeyboardEvent) => {
      const visibleSheets = Array.from(
        document.querySelectorAll<HTMLElement>("[data-detail-dialog]"),
      ).filter((node) => node.getClientRects().length > 0);
      if (visibleSheets[visibleSheets.length - 1] !== sheet) return;
      if (event.key === "Escape") {
        event.preventDefault();
        closeRef.current();
      }
      if (event.key !== "Tab") return;
      const items = focusable();
      const first = items[0];
      const last = items[items.length - 1];
      if (!first) {
        event.preventDefault();
        sheet.focus();
      } else if (
        event.shiftKey &&
        (document.activeElement === first ||
          document.activeElement === sheet ||
          !sheet.contains(document.activeElement))
      ) {
        event.preventDefault();
        last.focus();
      } else if (
        !event.shiftKey &&
        (document.activeElement === last ||
          document.activeElement === sheet ||
          !sheet.contains(document.activeElement))
      ) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      requestAnimationFrame(() => {
        const visibleSheets = Array.from(
          document.querySelectorAll<HTMLElement>("[data-detail-dialog]"),
        ).filter((node) => node.getClientRects().length > 0);
        const activeSheet = visibleSheets[visibleSheets.length - 1];
        if (
          previous?.isConnected &&
          previous.getClientRects().length &&
          (!activeSheet || activeSheet.contains(previous))
        )
          previous.focus({ preventScroll: true });
      });
    };
  }, [label, suspended, scrollRef]);

  return (
    <div
      className={`fixed inset-0 z-50 flex items-end justify-center bg-black/40 px-4 pb-4 sm:items-center ${overlayClassName ?? ""}`}
      onClick={onClose}
      style={suspended ? { display: "none" } : undefined}
    >
      <div
        ref={scrollRef}
        className={`surface-card w-full ${maxWidthClass} max-h-[90vh] overflow-y-auto p-5 shadow-xl ${label ? "detail-sheet" : ""} ${contentClassName ?? ""}`}
        role={label ? "dialog" : undefined}
        aria-modal={label ? true : undefined}
        aria-label={label}
        tabIndex={label ? -1 : undefined}
        data-detail-dialog={label ? "" : undefined}
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
