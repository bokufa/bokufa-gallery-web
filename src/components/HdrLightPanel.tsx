import { useEffect, useRef, useState } from "react";

import { useHdr } from "../contexts/HdrContext";
import { mountHdrLight } from "../utils/hdrLight";

export default function HdrLightPanel() {
  const { enabled } = useHdr();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setReady(false);
    if (!enabled || !canvasRef.current) return;

    return mountHdrLight(canvasRef.current, setReady);
  }, [enabled]);

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
