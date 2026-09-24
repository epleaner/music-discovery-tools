// swift-tools-version:5.7
import PackageDescription

let package = Package(
    name: "RYMMenuBar",
    platforms: [.macOS(.v11)],
    targets: [
        .executableTarget(
            name: "RYMMenuBar",
            path: "Sources/RYMMenuBar",
            resources: [.copy("Resources/eff_large_wordlist.txt")]
        ),
        .testTarget(
            name: "RYMMenuBarTests",
            dependencies: ["RYMMenuBar"],
            path: "Tests/RYMMenuBarTests"
        )
    ]
)
