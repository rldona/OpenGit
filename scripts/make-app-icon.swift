// Builds the square app-icon source from a logo that has transparent margins.
//
// The system icon is generated from the whole canvas, so any transparent
// padding in the logo makes the art look smaller than the rest of the apps.
// This trims the alpha bounding box and centers the art on a square canvas at
// the requested fill ratio, ready for `tauri icon`:
//
//   swift scripts/make-app-icon.swift \
//     assets/open-git-logo-trans.png assets/open-git-logo-appicon.png 0.88 1024
//   node_modules/.bin/tauri icon assets/open-git-logo-appicon.png
//
// With only the input it prints the bounding box and how much of the canvas
// the art fills, which is useful to compare against the target ratio.

import Foundation
import CoreGraphics
import ImageIO
import UniformTypeIdentifiers

let args = CommandLine.arguments
guard args.count >= 2 else {
  fatalError("usage: make-app-icon <input> [output] [ratio] [canvas]")
}
let input = args[1]
let output = args.count > 2 ? args[2] : ""
let ratio = args.count > 3 ? (Double(args[3]) ?? 0.88) : 0.88
let canvas = args.count > 4 ? (Int(args[4]) ?? 1024) : 1024

guard
  let source = CGImageSourceCreateWithURL(URL(fileURLWithPath: input) as CFURL, nil),
  let image = CGImageSourceCreateImageAtIndex(source, 0, nil)
else { fatalError("cannot read \(input)") }

let width = image.width
let height = image.height
let bytesPerRow = width * 4
var pixels = [UInt8](repeating: 0, count: height * bytesPerRow)
guard
  let context = CGContext(
    data: &pixels, width: width, height: height, bitsPerComponent: 8, bytesPerRow: bytesPerRow,
    space: CGColorSpaceCreateDeviceRGB(),
    bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue)
else { fatalError("cannot create context") }
context.draw(image, in: CGRect(x: 0, y: 0, width: width, height: height))

// Alpha bounding box; the threshold ignores resampling noise around the edges.
var minX = width, minY = height, maxX = -1, maxY = -1
for y in 0..<height {
  for x in 0..<width where pixels[y * bytesPerRow + x * 4 + 3] > 8 {
    if x < minX { minX = x }
    if x > maxX { maxX = x }
    if y < minY { minY = y }
    if y > maxY { maxY = y }
  }
}
guard maxX >= 0 else { fatalError("fully transparent image") }
let cropWidth = maxX - minX + 1
let cropHeight = maxY - minY + 1
print("source \(width)x\(height) bbox x=\(minX)..\(maxX) y=\(minY)..\(maxY) (\(cropWidth)x\(cropHeight))")
print(
  String(
    format: "art fills %.1f%% wide, %.1f%% tall",
    100.0 * Double(cropWidth) / Double(width), 100.0 * Double(cropHeight) / Double(height)))

if output.isEmpty { exit(0) }

// The buffer is bottom-up while `CGImage.cropping` uses a top-left origin.
let crop = CGRect(x: minX, y: height - (maxY + 1), width: cropWidth, height: cropHeight)
guard let cropped = image.cropping(to: crop) else { fatalError("cannot crop") }

let scale = ratio * Double(canvas) / Double(max(cropWidth, cropHeight))
let drawWidth = Double(cropWidth) * scale
let drawHeight = Double(cropHeight) * scale
var outputPixels = [UInt8](repeating: 0, count: canvas * canvas * 4)
guard
  let outputContext = CGContext(
    data: &outputPixels, width: canvas, height: canvas, bitsPerComponent: 8,
    bytesPerRow: canvas * 4, space: CGColorSpaceCreateDeviceRGB(),
    bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue)
else { fatalError("cannot create output context") }
outputContext.interpolationQuality = .high
outputContext.draw(
  cropped,
  in: CGRect(
    x: (Double(canvas) - drawWidth) / 2, y: (Double(canvas) - drawHeight) / 2,
    width: drawWidth, height: drawHeight))

guard let outputImage = outputContext.makeImage() else { fatalError("cannot make image") }
let url = URL(fileURLWithPath: output)
guard
  let destination = CGImageDestinationCreateWithURL(
    url as CFURL, UTType.png.identifier as CFString, 1, nil)
else { fatalError("cannot create \(output)") }
CGImageDestinationAddImage(destination, outputImage, nil)
guard CGImageDestinationFinalize(destination) else { fatalError("cannot write \(output)") }
print("wrote \(output) \(canvas)x\(canvas) with art at \(Int(ratio * 100))%")
