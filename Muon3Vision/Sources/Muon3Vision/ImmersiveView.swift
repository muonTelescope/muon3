import SwiftUI
import RealityKit

struct ImmersiveView: View {
    @StateObject private var simManager = SimulationManager()
    @State private var rootEntity: Entity?
    
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
            if let root = rootEntity, let event = simManager.currentEvent {
                Task {
                    await updateVisualization(for: event, root: root)
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
    }
    
    private func updateVisualization(for event: SimEvent, root: Entity) async {
        // Remove old particles
        root.children.filter { $0.name.contains("photon") }.forEach { $0.removeFromParent() }
        
        let panelViz = PanelVisualizer()
        await panelViz.animateEvent(event, on: root)
    }
}
