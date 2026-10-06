import type { Metadata } from "../models/gallery";

export interface CameraLogo {
  src: string;
  label: string;
  width: number;
  height: number;
  crop?: "nikon-1968";
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
    brandLogo = { src: "/camera-logos/sony.svg", label: "SONY", width: 66, height: 12 };
    if (key === "ILCE-7M4" || key === "Α7 IV") {
      model = "α7 IV";
      modelLogo = { src: "/camera-logos/sony-a7iv.svg", label: model, width: 66, height: 20 };
    } else if (key === "ILCE-7CM2" || key === "Α7C II") {
      model = "α7C II";
      modelLogo = { src: "/camera-logos/sony-a7cii.svg", label: model, width: 78, height: 20 };
    }
  } else if (brand === "RICOH") {
    brandLogo = { src: "/camera-logos/ricoh.png", label: "RICOH", width: 66, height: 23 };
    if (key === "GR IIIX") {
      modelLogo = { src: "/camera-logos/ricoh-gr-iiix.png", label: model, width: 113, height: 12 };
    }
  } else if (/^nikon$/i.test(brand) && key === "FM") {
    brandLogo = { src: "/camera-logos/nikon-1968.jpg", label: "Nikon (1968)", width: 84, height: 30, crop: "nikon-1968" };
  } else if (/^apple$/i.test(brand) && key === "IPHONE 14 PRO") {
    modelLogo = { src: "/camera-logos/iphone-14-pro.svg", label: model, width: 132, height: 17 };
  }
  return { brand, model, brandLogo, modelLogo, film };
}
