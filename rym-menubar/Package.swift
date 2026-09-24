// swift-tools-version:5.7
import PackageDescription

let package = Package(
    name: "RYMMenuBar",
    platforms: [.macOS(.v11)],
    targets: [
        .executableTarget(
            name: "RYMMenuBar",
            path: "Sources/RYMMenuBar"
        ),
        .testTarget(
            name: "RYMMenuBarTests",
            dependencies: ["RYMMenuBar"],
            path: "Tests/RYMMenuBarTests"
        )
    ]
)
