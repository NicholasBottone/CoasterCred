import { useCallback, useEffect, useMemo, useState } from "react";

export type OnboardingStep = {
  id: string;
  title: string;
  body: string;
  targetSelector?: string;
  placement?: "top" | "bottom";
  onEnter?: () => void;
};

type Rect = {
  top: number;
  left: number;
  width: number;
  height: number;
};

export function OnboardingTour({
  open,
  steps,
  onClose,
}: {
  open: boolean;
  steps: OnboardingStep[];
  onClose: () => void;
}) {
  const [stepIndex, setStepIndex] = useState(0);
  const [targetRect, setTargetRect] = useState<Rect | null>(null);
  const [isMeasuringTarget, setIsMeasuringTarget] = useState(false);
  const activeStep = steps[stepIndex] ?? steps[0];

  useEffect(() => {
    if (open) {
      setIsMeasuringTarget(false);
      setTargetRect(null);
      setStepIndex(0);
    }
  }, [open]);

  useEffect(() => {
    if (!open || !activeStep) return;
    setIsMeasuringTarget(Boolean(activeStep.targetSelector));
    if (!activeStep.targetSelector) {
      setTargetRect(null);
    }
    activeStep.onEnter?.();
  }, [activeStep, open]);

  const measureTargetRect = useCallback(() => {
    if (!open || !activeStep?.targetSelector) {
      setTargetRect(null);
      return;
    }

    const target = document.querySelector<HTMLElement>(activeStep.targetSelector);
    if (!target) {
      setIsMeasuringTarget(true);
      return;
    }

    const rect = target.getBoundingClientRect();
    setTargetRect({
      top: rect.top,
      left: rect.left,
      width: rect.width,
      height: rect.height,
    });
    setIsMeasuringTarget(false);
  }, [activeStep, open]);

  useEffect(() => {
    if (!open) return;

    const target = activeStep?.targetSelector
      ? document.querySelector<HTMLElement>(activeStep.targetSelector)
      : null;
    target?.scrollIntoView({ block: "center", inline: "center", behavior: "smooth" });

    const timeouts: number[] = [];
    const raf = window.requestAnimationFrame(() => {
      timeouts.push(window.setTimeout(measureTargetRect, target ? 140 : 0));
      timeouts.push(window.setTimeout(measureTargetRect, 260));
      timeouts.push(window.setTimeout(measureTargetRect, 420));
    });
    window.addEventListener("resize", measureTargetRect);
    document.addEventListener("scroll", measureTargetRect, true);

    return () => {
      window.cancelAnimationFrame(raf);
      timeouts.forEach((timeout) => window.clearTimeout(timeout));
      window.removeEventListener("resize", measureTargetRect);
      document.removeEventListener("scroll", measureTargetRect, true);
    };
  }, [activeStep, measureTargetRect, open]);

  useEffect(() => {
    if (!open) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose, open]);

  const popoverStyle = useMemo(() => {
    if (typeof window === "undefined" || !targetRect) {
      return undefined;
    }

    const gap = 16;
    const margin = 16;
    const width = Math.min(340, window.innerWidth - margin * 2);
    const left = Math.min(
      Math.max(targetRect.left + targetRect.width / 2 - width / 2, margin),
      window.innerWidth - width - margin,
    );
    const preferredBelow = activeStep?.placement !== "top";
    const belowTop = targetRect.top + targetRect.height + gap;
    const aboveTop = targetRect.top - gap - 220;
    const top =
      preferredBelow && belowTop < window.innerHeight - 220
        ? belowTop
        : Math.max(margin, aboveTop);

    return {
      left,
      top,
      width,
    };
  }, [activeStep?.placement, targetRect]);

  if (!open || !activeStep) {
    return null;
  }

  const isLastStep = stepIndex === steps.length - 1;
  const isWaitingForFirstTarget = Boolean(activeStep.targetSelector && isMeasuringTarget && !popoverStyle);
  const highlightRect = targetRect
    ? {
        top: Math.max(targetRect.top - 8, 8),
        left: Math.max(targetRect.left - 8, 8),
        width: Math.min(targetRect.width + 16, window.innerWidth - 16),
        height: targetRect.height + 16,
      }
    : null;

  return (
    <div className="fixed inset-0 z-[70]" role="dialog" aria-modal="true" aria-labelledby="onboarding-title">
      <div className={`absolute inset-0 ${highlightRect ? "" : "bg-gray-950/65"}`} />

      {highlightRect && (
        <div
          aria-hidden="true"
          className="pointer-events-none fixed rounded-2xl border-2 border-white shadow-[0_0_0_9999px_rgba(3,7,18,0.58),0_18px_45px_rgba(0,0,0,0.28)] ring-4 ring-primary/40 transition-all"
          style={highlightRect}
        />
      )}

      {!isWaitingForFirstTarget && (
        <div
          className={`fixed rounded-2xl border border-gray-200 bg-white p-4 text-gray-900 opacity-100 shadow-2xl transition-[left,top,width,opacity] duration-200 ease-out dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100 ${
            popoverStyle
              ? ""
              : "left-1/2 top-1/2 w-[min(21rem,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2"
          }`}
          style={popoverStyle}
        >
          <div className="mb-3 flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-wide text-primary">
                Step {stepIndex + 1} of {steps.length}
              </p>
              <h2 id="onboarding-title" className="mt-1 text-lg font-bold text-gray-900 dark:text-gray-100">
                {activeStep.title}
              </h2>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Skip tutorial"
              className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 dark:text-gray-500 dark:hover:bg-gray-800 dark:hover:text-gray-300"
            >
              <span aria-hidden="true" className="text-lg leading-none">
                x
              </span>
            </button>
          </div>

          <p className="text-sm leading-6 text-gray-600 dark:text-gray-300">{activeStep.body}</p>

          <div className="mt-4 flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl px-3 py-2 text-sm font-semibold text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-700 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-gray-200"
            >
              Skip
            </button>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  const nextIndex = Math.max(0, stepIndex - 1);
                  setIsMeasuringTarget(Boolean(steps[nextIndex]?.targetSelector));
                  setStepIndex(nextIndex);
                }}
                disabled={stepIndex === 0}
                className="rounded-xl border border-gray-200 px-3 py-2 text-sm font-semibold text-gray-600 transition-all hover:-translate-y-0.5 hover:bg-gray-50 disabled:opacity-40 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
              >
                Back
              </button>
              <button
                type="button"
                onClick={() => {
                  if (isLastStep) {
                    onClose();
                    return;
                  }
                  const nextIndex = Math.min(steps.length - 1, stepIndex + 1);
                  setIsMeasuringTarget(Boolean(steps[nextIndex]?.targetSelector));
                  setStepIndex(nextIndex);
                }}
                className="rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-white transition-all hover:-translate-y-0.5 hover:bg-primary-hover hover:shadow-md"
              >
                {isLastStep ? "Finish" : "Next"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
