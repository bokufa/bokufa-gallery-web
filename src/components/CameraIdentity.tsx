import { useState } from "react";
import { SiApple } from "react-icons/si";
import type { Metadata } from "../models/gallery";
import { cameraIdentity } from "../utils/cameraIdentity";
import type { CameraLogo } from "../utils/cameraIdentity";

function Logo({ logo, fallback }: { logo: CameraLogo; fallback: string }) {
  const [failed, setFailed] = useState(false);
  if (failed) return <span className="text-small">{fallback}</span>;
  if (logo.crop) return (
    <span className="relative block shrink-0 overflow-hidden mix-blend-multiply" style={{ width: logo.width, height: logo.height }}>
      <img src={logo.src} alt={logo.label} onError={() => setFailed(true)}
        className="absolute max-w-none" width={105} height={65}
        style={{ left: -10.5, top: -17.7 }} />
    </span>
  );
  return <img src={logo.src} alt={logo.label} width={logo.width} height={logo.height}
    onError={() => setFailed(true)} className="block shrink-0 object-contain brightness-0"
    style={{ width: logo.width, height: logo.height }} />;
}

export default function CameraIdentity({ metadata }: { metadata: Metadata }) {
  const identity = cameraIdentity(metadata);
  const label = [identity.brand, identity.model].filter(Boolean).join(" ") || "Unknown camera";
  return (
    <div className="flex min-h-8 flex-wrap items-center gap-x-4 gap-y-2" aria-label={label} title={label}>
      {identity.brandLogo ? (
        <Logo key={identity.brandLogo.src} logo={identity.brandLogo} fallback={identity.brand} />
      ) : /^apple$/i.test(identity.brand) ? (
        <SiApple size={21} role="img" aria-label="Apple" />
      ) : identity.brand && identity.brand !== "Unknown" ? (
        <span className="text-small">{identity.brand}</span>
      ) : null}
      {identity.modelLogo ? (
        <Logo key={identity.modelLogo.src} logo={identity.modelLogo} fallback={identity.model} />
      ) : (
        // FM has no separate official wordmark asset in Nikon's brand archive.
        // Keep its model name next to the genuine period brand symbol.
        <span className={identity.model === "FM" ? "text-lg font-semibold tracking-wider" : "text-small"}>
          {identity.model || "Unknown camera"}
        </span>
      )}
    </div>
  );
}
