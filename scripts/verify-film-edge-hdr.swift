import Foundation
import CoreImage
import CoreGraphics
import ImageIO

let file = URL(fileURLWithPath: CommandLine.arguments[1])
let linear = CGColorSpace(name: CGColorSpace.extendedLinearSRGB)!
let context = CIContext(options: [.useSoftwareRenderer: true])
let source = CGImageSourceCreateWithURL(file as CFURL, nil)!
guard CGImageSourceCopyAuxiliaryDataInfoAtIndex(source, 0, kCGImageAuxiliaryDataTypeISOGainMap) != nil else {
    fatalError("ImageIO does not recognize the glyph gain map")
}
func measure(_ expanded: Bool) -> (Float, Float) {
    let image = CIImage(contentsOf: file, options: [.expandToHDR: expanded])!
    let width = Int(image.extent.width)
    let height = Int(image.extent.height)
    var values = [Float](repeating: 0, count: width * height * 4)
    values.withUnsafeMutableBytes { buffer in
        context.render(image, toBitmap: buffer.baseAddress!, rowBytes: width * 16,
            bounds: image.extent, format: .RGBAf, colorSpace: linear)
    }
    var peak: Float = 0
    for index in stride(from: 0, to: values.count, by: 4) {
        peak = max(peak, values[index] * 0.2126 + values[index + 1] * 0.7152 + values[index + 2] * 0.0722)
    }
    return (image.contentHeadroom, peak)
}
let sdr = measure(false)
let hdr = measure(true)
guard hdr.0 >= 3.9, hdr.1 > 1.5, hdr.1 > sdr.1 * 3.5 else {
    fatalError("Glyph HDR must actually decode brighter than SDR white, not merely carry metadata")
}
let result: [String: Any] = ["headroom": hdr.0, "sdrPeakLuminance": sdr.1, "hdrPeakLuminance": hdr.1, "appleHdrDecodeVerified": true]
let data = try JSONSerialization.data(withJSONObject: result, options: [.sortedKeys])
print(String(data: data, encoding: .utf8)!)
