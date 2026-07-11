import SwiftUI
import RealityKit

struct ImmersiveView: View {
    @StateObject private var simManager = SimulationManager()
    @State private var rootEntity: Entity?
    @State private var isAnimating = false
    
    var body: some View {
        RealityView { content in
            // High quality immersive scene
            let root = Entity()
            content.add(root)
            rootEntity = root
            
            // Add high-quality environment
            let environment = try? await EnvironmentResource(named: "studio")
            if let env = environment {
                root.components.set(EnvironmentLightingComponent(environment: env))
            }
            
            // Build the high-quality panel visualization
            let panelViz = PanelVisualizer()
            root.addChild(panelViz.buildHighQualityPanel())
            
            // Initial camera position for good view
            let camera = PerspectiveCamera()
            camera.position = [0, 0.3, 0.8]
            root.addChild(camera)
            
            // Load and visualize initial data
            Task {
                await simManager.loadData()
                if let event = simManager.currentEvent {
                    await panelViz.animateEvent(event, on: root)
                }
            }
        } update: { content in
            // Update visualization when data changes
            if let root = rootEntity, let event = simManager.currentEvent, !isAnimating {
                isAnimating = true
                Task {
                    await updateVisualization(for: event, root: root)
                    isAnimating = false
                }
            }
        }
        .gesture(
            TapGesture()
                .targetedToAnyEntity()
                .onEnded { _ in
                    simManager.nextEvent()
                }
        )
        .overlay(alignment: .bottom) {
            if let event = simManager.currentEvent {
                VStack {
                    let edepStr = String(format: "%.2f", event.edep)
                    Text("Event \(event.id): \(Int(event.photonsDetected)) p.e. | Edep \(edepStr) MeV")
                        .font(.caption)
                        .padding(8)
                        .background(.ultraThinMaterial)
                        .clipShape(RoundedRectangle(cornerRadius: 8))
                    Text("Tap panel or use window controls to advance")
                        .font(.caption2)
                        .foregroundStyle(.secondary)
                }
                .padding(.bottom, 40)
            }
        }
    }
    
    private func updateVisualization(for event: SimEvent, root: Entity) async {
        // Remove old particles
        root.children.filter { $0.name.contains("photon") || $0.name.contains("burst") }.forEach { $0.removeFromParent() }
        
        let panelViz = PanelVisualizer()
        await panelViz.animateEvent(event, on: root)
    }
}
