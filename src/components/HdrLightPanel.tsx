import { useEffect, useRef, useState } from "react";

import { useHdr } from "../contexts/HdrContext";
import { mountHdrLight } from "../utils/hdrLight";

export default function HdrLightPanel() {
  const { enabled } = useHdr();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [ready, setReady] = useState(false);
  const [activated, setActivated] = useState(enabled);

  useEffect(() => {
    if (enabled) setActivated(true);
  }, [enabled]);

  useEffect(() => {
    setReady(false);
    if (!activated || !canvasRef.current) return;

    // Retain this tiny static surface until unmount. Destroying it on opt-out
    // would clear its pixels before the closing-light fade can finish.
    return mountHdrLight(canvasRef.current, setReady);
  }, [activated]);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className="film-hdr-light"
      data-ready={enabled && ready}
      height={2}
      width={2}
    />
  );
}
