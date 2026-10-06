import { useState } from "react";
import { SiApple } from "react-icons/si";
import type { Metadata } from "../models/gallery";
import { cameraIdentity } from "../utils/cameraIdentity";
import type { CameraLogo } from "../utils/cameraIdentity";

function Logo({ logo, fallback }: { logo: CameraLogo; fallback: string }) {
  const [failed, setFailed] = useState(false);
  if (failed) return <span>{fallback}</span>;
  return <img src={logo.src} alt={logo.label} width={logo.width} height={logo.height}
    onError={() => setFailed(true)} className={`block shrink-0 object-contain ${logo.preserveColor ? "" : "brightness-0"}`}
    style={{ width: logo.width, height: logo.height }} />;
}

export default function CameraIdentity({ metadata }: { metadata: Metadata }) {
  const identity = cameraIdentity(metadata);
  const label = [identity.brand, identity.model].filter(Boolean).join(" ") || "Unknown camera";
  return (
    <div className="flex min-h-5 flex-wrap items-center gap-x-2 gap-y-1 text-small font-semibold leading-5" aria-label={label} title={label}>
      {identity.brandLogo ? (
        <Logo key={identity.brandLogo.src} logo={identity.brandLogo} fallback={identity.brand} />
      ) : /^apple$/i.test(identity.brand) ? (
        <SiApple size={16} role="img" aria-label="Apple" />
      ) : identity.brand && identity.brand !== "Unknown" ? (
        <span>{identity.brand}</span>
      ) : null}
      {identity.modelLogo ? (
        <span className="inline-flex items-center gap-1">
          <Logo key={identity.modelLogo.src} logo={identity.modelLogo}
            fallback={identity.modelLogo.suffix ? identity.modelLogo.label : identity.model} />
          {identity.modelLogo.suffix ? <span>{identity.modelLogo.suffix}</span> : null}
        </span>
      ) : (
        // Keep model names next to the selected manufacturer marks.
        <span>
          {identity.model || "Unknown camera"}
        </span>
      )}
    </div>
  );
}
