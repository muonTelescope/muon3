// swift-tools-version: 6.0
import PackageDescription

let package = Package(
    name: "Muon3Vision",
    platforms: [
        .visionOS(.v2)
    ],
    products: [
        .library(
            name: "Muon3Vision",
            targets: ["Muon3Vision"]),
    ],
    dependencies: [],
    targets: [
        .target(
            name: "Muon3Vision",
            dependencies: [],
            path: "Sources/Muon3Vision",
            resources: [
                .process("Resources")
            ],
            // RealityKit entity mutation is main-actor bound; keep Swift 5
            // language mode so existing async visualization code stays valid.
            swiftSettings: [
                .swiftLanguageMode(.v5)
            ]
        ),
    ]
)
