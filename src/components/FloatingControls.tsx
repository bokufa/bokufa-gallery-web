import type { ReactNode } from "react";

export const floatingControlSurface =
  "bg-content1/80 shadow-medium backdrop-blur-md";

// Shared placement for map and film controls, including the phone safe area.
export default function FloatingControls({
  children,
  isHidden = false,
}: {
  children: ReactNode;
  isHidden?: boolean;
}) {
  return (
    <div
      className={`pointer-events-none absolute inset-x-0 bottom-[calc(1.5rem+env(safe-area-inset-bottom))] z-30 flex justify-center transition-[opacity,visibility] duration-300 ${
        isHidden ? "invisible opacity-0" : "visible opacity-100"
      }`}
    >
      {children}
    </div>
  );
}
