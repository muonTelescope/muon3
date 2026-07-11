import SwiftUI
import RealityKit

struct ContentView: View {
    @StateObject private var simManager = SimulationManager()
    @State private var isImmersive = false
    @State private var selectedEvent: Int = 0
    @State private var muonEnergy: Double = 3.0
    @State private var impactX: Double = 0.0
    @State private var impactY: Double = 0.0
    
    var body: some View {
        VStack(spacing: 20) {
            // High quality logo
            HStack {
                Image("AppIcon-1024")
                    .resizable()
                    .scaledToFit()
                    .frame(width: 80, height: 80)
                    .clipShape(RoundedRectangle(cornerRadius: 16))
                    .shadow(radius: 5)
                
                VStack(alignment: .leading) {
                    Text("Muon3Vision")
                        .font(.largeTitle)
                        .fontWeight(.bold)
                    Text("Spatial Muon Telescope Simulator")
                        .font(.subheadline)
                        .foregroundStyle(.secondary)
                }
            }
            .padding(.bottom, 10)
            
            Text("Immersive visualization of Geant4 muon panel simulations for Apple Vision Pro")
                .font(.title3)
                .foregroundStyle(.secondary)
                .multilineTextAlignment(.center)
            
            // Controls - High quality UI with glass effect
            VStack(alignment: .leading, spacing: 16) {
                Text("Simulation Controls")
                    .font(.headline)
                
                HStack {
                    Text("Event: \(selectedEvent)")
                    Slider(value: Binding(get: { Double(selectedEvent) }, set: { selectedEvent = Int($0) }), in: 0...Double(max(0, simManager.events.count - 1)))
                        .frame(width: 200)
                }
                
                HStack {
                    Text("Muon Energy: \(String(format: "%.1f", muonEnergy)) GeV")
                    Slider(value: $muonEnergy, in: 0.5...50)
                }
                
                HStack {
                    Text("Impact X: \(String(format: "%.0f", impactX)) mm")
                    Slider(value: $impactX, in: -90...90)
                }
                
                HStack {
                    Text("Impact Y: \(String(format: "%.0f", impactY)) mm")
                    Slider(value: $impactY, in: -90...90)
                }
                
                HStack(spacing: 12) {
                    Button("Run Simulation") {
                        simManager.runSimulation(energy: muonEnergy, x: impactX, y: impactY)
                        selectedEvent = simManager.events.count - 1
                    }
                    .buttonStyle(.borderedProminent)
                    
                    Button(isImmersive ? "Exit Immersive" : "Enter Immersive") {
                        isImmersive.toggle()
                    }
                    .buttonStyle(.bordered)
                    
                    Button("Reset View") {
                        simManager.reset()
                    }
                }
                
                // Additional controls for data viz recommendations
                VStack {
                    Text("Animation Speed: \(simManager.animationSpeed, specifier: \"%.1f\")x")
                    Slider(value: $simManager.animationSpeed, in: 0.1...5.0)
                    
                    Picker("Color Mode", selection: $simManager.colorMode) {
                        ForEach(SimulationManager.ColorMode.allCases, id: \.self) { mode in
                            Text(mode.rawValue).tag(mode)
                        }
                    }
                    .pickerStyle(.segmented)
                    
                    Toggle("Show ngspice timing overlay (placeholder)", isOn: $simManager.showNgspiceOverlay)
                }
            }
            .padding()
            .background(.ultraThinMaterial)
            .clipShape(RoundedRectangle(cornerRadius: 16))
            
            // Stats - Polished display
            if let event = simManager.currentEvent {
                VStack(alignment: .leading) {
                    Text("Event Stats")
                        .font(.headline)
                    HStack {
                        Label("Edep: \(String(format: "%.2f", event.edep)) MeV", systemImage: "bolt")
                        Label("Photons: \(event.photonsDetected)", systemImage: "sparkles")
                        Label("Time: \(String(format: "%.1f", event.time)) ns", systemImage: "clock")
                    }
                    .font(.callout)
                }
                .padding()
                .background(.regularMaterial)
                .clipShape(RoundedRectangle(cornerRadius: 12))
            }
            
            Text("Use the Immersive Space for high-quality 3D visualization with particle photon paths and interactive panel. The logo above represents the Muon3Vision brand.")
                .font(.caption)
                .foregroundStyle(.secondary)
                .multilineTextAlignment(.center)
        }
        .padding(40)
        .frame(width: 620, height: 520)
        .glassBackgroundEffect()
    }
}
