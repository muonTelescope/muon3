// swift-tools-version: 5.9
import PackageDescription

let package = Package(
    name: "Muon3Vision",
    platforms: [
        .visionOS(.v1)
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
            ]
        ),
    ]
)
