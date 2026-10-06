import type { Metadata } from "../models/gallery";

export interface CameraLogo {
  src: string;
  label: string;
  width: number;
  height: number;
  suffix?: string;
  preserveColor?: boolean;
}

// Resolve EXIF aliases and the legacy film format without changing API data.
export function cameraIdentity(metadata: Metadata) {
  const camera = metadata.camera;
  let brand = camera?.manufacture?.name?.trim() || "";
  let model = camera?.model?.trim() || "";
  const legacyFm = /^nikon\s+fm$/i.test(brand);
  const film = { ...metadata.film };
  if (legacyFm) {
    const [stock, scanner] = model.split(/\s*[·|]\s*/);
    if (/\bFUJI\b/i.test(stock)) film.stock ||= stock;
    if (scanner) film.scanner ||= scanner;
    brand = "Nikon";
    model = "FM";
  }
  if (/^RICOH(?: IMAGING COMPANY, LTD\.)?$/i.test(brand)) {
    brand = "RICOH";
    model = model.replace(/^RICOH\s+/i, "");
  }
  if (/^nikon$/i.test(brand)) model = model.replace(/^Nikon\s+/i, "");

  let brandLogo: CameraLogo | undefined;
  let modelLogo: CameraLogo | undefined;
  const key = model.toUpperCase();
  if (/^sony$/i.test(brand)) {
    brandLogo = { src: "/camera-logos/sony.svg", label: "SONY", width: 63.62, height: 11.2 };
    if (key === "ILCE-7M4" || key === "Α7 IV") {
      model = "α7 IV";
      modelLogo = { src: "/camera-logos/sony-alpha.svg", label: "α", width: 15.66, height: 11.2, suffix: "7 IV", preserveColor: true };
    } else if (key === "ILCE-7CM2" || key === "Α7C II") {
      model = "α7C II";
      modelLogo = { src: "/camera-logos/sony-alpha.svg", label: "α", width: 15.66, height: 11.2, suffix: "7C II", preserveColor: true };
    }
  } else if (brand === "RICOH") {
    brandLogo = { src: "/camera-logos/ricoh.svg", label: "RICOH", width: 61.33, height: 11.2, preserveColor: true };
  } else if (/^nikon$/i.test(brand) && key === "FM") {
    brandLogo = { src: "/camera-logos/nikon.svg", label: "Nikon", width: 47.29, height: 11.2, preserveColor: true };
  } else if (/^apple$/i.test(brand) && key === "IPHONE 14 PRO") {
    modelLogo = { src: "/camera-logos/iphone-14-pro.svg", label: model, width: 90.81, height: 11.2 };
  }
  return { brand, model, brandLogo, modelLogo, film };
}
