// Regenerate with: CLANG_MODULE_CACHE_PATH=/tmp/coastercred-swift-cache \
// SWIFT_MODULE_CACHE_PATH=/tmp/coastercred-swift-cache swift scripts/generate-og-preview.swift
import AppKit
import CoreText

let width = 1200
let height = 630
let canvasHeight = CGFloat(height)

func color(_ hex: String) -> NSColor {
    let value = Int(hex.dropFirst(), radix: 16)!
    return NSColor(
        calibratedRed: CGFloat((value >> 16) & 255) / 255,
        green: CGFloat((value >> 8) & 255) / 255,
        blue: CGFloat(value & 255) / 255,
        alpha: 1
    )
}

let page = color("#F2F4F7")
let surface = color("#FFFFFF")
let ink = color("#1B2432")
let muted = color("#5D6A7C")
let line = color("#D7DDE6")
let brand = color("#5B50CF")
let steel = color("#16718F")
let wood = color("#8B5D18")
let hybrid = color("#A14788")

let fontURL = FileManager.default.homeDirectoryForCurrentUser
    .appendingPathComponent("Library/Fonts/Inter-VariableFont_slnt,wght.ttf")
var fontError: Unmanaged<CFError>?
_ = CTFontManagerRegisterFontsForURL(fontURL as CFURL, .process, &fontError)

func inter(_ size: CGFloat, _ weight: String = "Regular") -> NSFont {
    NSFont(name: "Inter-Regular_\(weight)", size: size) ?? NSFont.systemFont(ofSize: size)
}

func rect(_ x: CGFloat, _ y: CGFloat, _ w: CGFloat, _ h: CGFloat, _ fill: NSColor,
          radius: CGFloat = 0, stroke: NSColor? = nil, strokeWidth: CGFloat = 1) {
    let path = NSBezierPath(roundedRect: NSRect(x: x, y: canvasHeight - y - h, width: w, height: h),
                            xRadius: radius, yRadius: radius)
    fill.setFill()
    path.fill()
    if let stroke {
        stroke.setStroke()
        path.lineWidth = strokeWidth
        path.stroke()
    }
}

func linePath(_ points: [(CGFloat, CGFloat)], _ stroke: NSColor, _ lineWidth: CGFloat = 1,
              dash: [CGFloat] = []) {
    let path = NSBezierPath()
    guard let first = points.first else { return }
    path.move(to: NSPoint(x: first.0, y: canvasHeight - first.1))
    for point in points.dropFirst() {
        path.line(to: NSPoint(x: point.0, y: canvasHeight - point.1))
    }
    path.lineWidth = lineWidth
    path.lineCapStyle = .round
    if !dash.isEmpty { path.setLineDash(dash, count: dash.count, phase: 0) }
    stroke.setStroke()
    path.stroke()
}

func circle(_ cx: CGFloat, _ cy: CGFloat, _ radius: CGFloat, _ fill: NSColor,
            stroke: NSColor? = nil, strokeWidth: CGFloat = 1) {
    rect(cx - radius, cy - radius, radius * 2, radius * 2, fill,
         radius: radius, stroke: stroke, strokeWidth: strokeWidth)
}

func text(_ value: String, _ x: CGFloat, _ top: CGFloat, _ w: CGFloat, _ h: CGFloat,
          _ font: NSFont, _ foreground: NSColor, alignment: NSTextAlignment = .left,
          tracking: CGFloat = 0) {
    let paragraph = NSMutableParagraphStyle()
    paragraph.alignment = alignment
    paragraph.lineBreakMode = .byClipping
    let attributes: [NSAttributedString.Key: Any] = [
        .font: font,
        .foregroundColor: foreground,
        .paragraphStyle: paragraph,
        .kern: tracking,
    ]
    (value as NSString).draw(in: NSRect(x: x, y: canvasHeight - top - h,
                                       width: w, height: h), withAttributes: attributes)
}

func centeredText(_ value: String, _ x: CGFloat, _ centerY: CGFloat, _ w: CGFloat,
                  _ font: NSFont, _ foreground: NSColor,
                  alignment: NSTextAlignment = .left) {
    let attributes: [NSAttributedString.Key: Any] = [.font: font, .foregroundColor: foreground]
    let size = (value as NSString).size(withAttributes: attributes)
    let drawX = alignment == .right ? x + w - size.width :
        alignment == .center ? x + (w - size.width) / 2 : x
    (value as NSString).draw(at: NSPoint(x: drawX,
                                       y: canvasHeight - centerY - size.height / 2),
                             withAttributes: attributes)
}

func score(_ value: String, _ cx: CGFloat, _ cy: CGFloat, yellow: Bool = false) {
    circle(cx, cy, 19, yellow ? color("#FFFBEB") : color("#F0FDF4"),
           stroke: yellow ? color("#FBBF24") : color("#4ADE80"), strokeWidth: 2)
    centeredText(value, cx - 19, cy, 38, inter(12, "Bold"),
                 yellow ? color("#92400E") : color("#15803D"), alignment: .center)
}

func ticketNotch(_ edgeX: CGFloat, _ centerY: CGFloat, inward: CGFloat) {
    func p(_ x: CGFloat, _ y: CGFloat) -> NSPoint {
        NSPoint(x: x, y: canvasHeight - y)
    }
    let path = NSBezierPath()
    path.move(to: p(edgeX, centerY - 8))
    path.curve(to: p(edgeX + inward * 8, centerY),
               controlPoint1: p(edgeX + inward * 4.4, centerY - 8),
               controlPoint2: p(edgeX + inward * 8, centerY - 4.4))
    path.curve(to: p(edgeX, centerY + 8),
               controlPoint1: p(edgeX + inward * 8, centerY + 4.4),
               controlPoint2: p(edgeX + inward * 4.4, centerY + 8))
    path.close()
    page.setFill()
    path.fill()

    // Only the curved inside edge has a border, like VisitTicket's CSS notch.
    let border = NSBezierPath()
    border.move(to: p(edgeX, centerY - 8))
    border.curve(to: p(edgeX + inward * 8, centerY),
                 controlPoint1: p(edgeX + inward * 4.4, centerY - 8),
                 controlPoint2: p(edgeX + inward * 8, centerY - 4.4))
    border.curve(to: p(edgeX, centerY + 8),
                 controlPoint1: p(edgeX + inward * 8, centerY + 4.4),
                 controlPoint2: p(edgeX + inward * 4.4, centerY + 8))
    border.lineWidth = 1
    line.setStroke()
    border.stroke()
}

func logo(_ x: CGFloat, _ y: CGFloat, _ size: CGFloat) {
    let s = size / 24
    func p(_ a: CGFloat, _ b: CGFloat) -> NSPoint {
        NSPoint(x: x + a * s, y: canvasHeight - (y + b * s))
    }
    let rails = NSBezierPath()
    rails.move(to: p(2, 19))
    rails.line(to: p(2, 9))
    rails.curve(to: p(6, 5), controlPoint1: p(2, 6.8), controlPoint2: p(3.8, 5))
    rails.curve(to: p(12, 9), controlPoint1: p(8, 5), controlPoint2: p(10, 6.3))
    rails.curve(to: p(18, 13), controlPoint1: p(14, 11.7), controlPoint2: p(16, 13))
    // The Lucide track loops around the right support before ending at 15, 6.35.
    rails.curve(to: p(22, 9), controlPoint1: p(20.2, 13), controlPoint2: p(22, 11.2))
    rails.curve(to: p(18, 5), controlPoint1: p(22, 6.8), controlPoint2: p(20.2, 5))
    rails.curve(to: p(15, 6.35), controlPoint1: p(16.85, 5), controlPoint2: p(15.78, 5.52))
    for (a, b, c) in [(6.0, 5.0, 19.0), (10, 6.8, 19), (14, 11.2, 19),
                       (18, 5, 9), (18, 13, 19), (22, 9, 19)] {
        rails.move(to: p(a, b))
        rails.line(to: p(a, c))
    }
    rails.lineWidth = 1.6 * s
    rails.lineCapStyle = .round
    rails.lineJoinStyle = .round
    brand.setStroke()
    rails.stroke()
}

func trackMotif(_ x: CGFloat, _ y: CGFloat) {
    let s: CGFloat = 0.8
    func p(_ a: CGFloat, _ b: CGFloat) -> NSPoint {
        NSPoint(x: x + a * s, y: canvasHeight - (y + b * s))
    }
    let path = NSBezierPath()
    path.move(to: p(4, 53))
    path.line(to: p(15, 53))
    path.curve(to: p(25, 48), controlPoint1: p(20, 53), controlPoint2: p(22, 51))
    path.line(to: p(65, 10))
    path.curve(to: p(77, 14), controlPoint1: p(72, 3), controlPoint2: p(75, 8))
    path.curve(to: p(106, 53), controlPoint1: p(83, 29), controlPoint2: p(77, 53))
    path.line(to: p(140, 53))
    path.move(to: p(4, 58))
    path.line(to: p(15, 58))
    path.curve(to: p(29, 52), controlPoint1: p(23, 58), controlPoint2: p(25, 55))
    path.line(to: p(68, 14))
    path.curve(to: p(73, 16), controlPoint1: p(71, 11), controlPoint2: p(72, 12))
    path.curve(to: p(106, 58), controlPoint1: p(78, 31), controlPoint2: p(74, 58))
    path.line(to: p(140, 58))
    path.lineWidth = 1.4
    path.lineCapStyle = .round
    brand.withAlphaComponent(0.82).setStroke()
    path.stroke()
    linePath([(x + 48*s, y + 35*s), (x + 48*s, y + 58*s)], brand.withAlphaComponent(0.25), 1)
    linePath([(x + 68*s, y + 16*s), (x + 68*s, y + 58*s)], brand.withAlphaComponent(0.25), 1)
}

let bitmap = NSBitmapImageRep(bitmapDataPlanes: nil, pixelsWide: width, pixelsHigh: height,
                              bitsPerSample: 8, samplesPerPixel: 4, hasAlpha: true,
                              isPlanar: false, colorSpaceName: .deviceRGB,
                              bytesPerRow: 0, bitsPerPixel: 0)!
let context = NSGraphicsContext(bitmapImageRep: bitmap)!
NSGraphicsContext.saveGraphicsState()
NSGraphicsContext.current = context
context.imageInterpolation = .high

// Neutral backdrop and restrained wayfinding rule.
rect(0, 0, 1200, 630, page)
rect(0, 0, 12, 630, brand)
rect(70, 136, 480, 1, line)

// Product identity and message.
logo(67, 41, 70)
text("CoasterCred", 155, 42, 435, 73, inter(57, "Bold"), ink, tracking: -1.8)
text("THE ENTHUSIAST'S RIDE LOGBOOK", 70, 158, 520, 30,
     NSFont(name: "Menlo-Regular", size: 16)!, muted, tracking: 0.4)
text("Log the ride.", 67, 207, 550, 78, inter(61, "Bold"), ink, tracking: -2.3)
text("Keep the cred.", 67, 282, 555, 78, inter(61, "Bold"), ink, tracking: -2.3)
text("Track every ride. Rank your favorites.", 70, 402, 515, 42,
     inter(27, "Medium"), muted, tracking: -0.5)
text("See how your crew stacks up.", 70, 443, 515, 42,
     inter(27, "Medium"), muted, tracking: -0.5)

// A faithful, compact view of the redesigned light feed.
rect(640, 38, 500, 554, color("#E5E9EF"), radius: 10)
rect(646, 43, 488, 544, page, radius: 6, stroke: line)
rect(647, 44, 486, 57, surface, radius: 5)
rect(647, 100, 486, 1, line)
logo(663, 58, 27)
text("CoasterCred", 699, 56, 240, 32, inter(20, "Bold"), ink, tracking: -0.6)
rect(1044, 62, 70, 26, brand, radius: 4)
text("Sign in", 1044, 66, 70, 20, inter(11, "SemiBold"), surface, alignment: .center)

text("Activity Feed", 666, 119, 320, 38, inter(27, "Bold"), ink, tracking: -0.7)
trackMotif(1002, 112)

// Visit ticket: date rail, perforation, ride rows, taxonomy, and score circles.
rect(666, 173, 448, 327, surface, radius: 6, stroke: line)
// Align the complete date stack within the rail, using the same horizontal center.
centeredText("26", 668, 221, 61, inter(30, "Medium"), brand, alignment: .center)
centeredText("MAR", 668, 249, 61, NSFont(name: "Menlo-Regular", size: 11)!, muted, alignment: .center)
centeredText("2026", 668, 267, 61, NSFont(name: "Menlo-Regular", size: 10)!, muted, alignment: .center)
linePath([(728, 188), (728, 292)], line, 1, dash: [3, 3])
text("Cedar Point", 742, 191, 345, 35, inter(22, "Bold"), ink, tracking: -0.6)
text("Sandusky, Ohio", 742, 225, 345, 25, inter(13), muted)
text("1 rider · 3 coasters", 742, 253, 319, 22, inter(12), muted)
circle(755, 286, 12, color("#E3DDF6"))
text("M", 743, 278, 24, 16, inter(11, "Bold"), brand, alignment: .center)
text("Maya", 774, 277, 100, 20, inter(12, "SemiBold"), ink)
linePath([(682, 310), (1098, 310)], line, 1, dash: [4, 4])
ticketNotch(666, 310, inward: 1)
ticketNotch(1114, 310, inward: -1)

centeredText("Steel Vengeance", 686, 342, 260, inter(16, "SemiBold"), ink)
centeredText("HYBRID", 964, 342, 74, inter(11, "Medium"), hybrid, alignment: .right)
score("9.8", 1071, 342)
rect(682, 373, 416, 1, line)
centeredText("Maverick", 686, 403, 260, inter(16, "SemiBold"), ink)
centeredText("STEEL", 964, 403, 74, inter(11, "Medium"), steel, alignment: .right)
score("9.3", 1071, 403)
rect(682, 433, 416, 1, line)
centeredText("Blue Streak", 686, 467, 260, inter(16, "SemiBold"), ink)
centeredText("WOOD", 964, 467, 74, inter(11, "Medium"), wood, alignment: .right)
score("6.2", 1071, 467, yellow: true)

// Mobile navigation is part of the app's visual signature.
rect(647, 540, 486, 1, line)
for (index, label) in ["Feed", "My List", "Search", "Rankings", "Profile"].enumerated() {
    let x = 654 + CGFloat(index) * 95
    if index == 0 { rect(x + 39, 550, 13, 3, brand, radius: 1.5) }
    text(label, x, 559, 92, 19, inter(11, index == 0 ? "SemiBold" : "Medium"),
         index == 0 ? brand : muted, alignment: .center)
}

context.flushGraphics()
NSGraphicsContext.restoreGraphicsState()
let outputURL = URL(fileURLWithPath: "public/og-preview.jpg")
let jpeg = bitmap.representation(using: .jpeg, properties: [.compressionFactor: 0.94])!
try jpeg.write(to: outputURL)
print("Wrote \(outputURL.path) (\(width)×\(height))")
