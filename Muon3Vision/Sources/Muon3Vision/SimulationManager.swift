import Foundation
import SwiftUI
import RealityKit

struct SimEvent: Identifiable {
    let id: Int
    let x: Double
    let y: Double
    let edep: Double
    let photonsProduced: Int
    let photonsShifted: Int
    let photonsDetected: Int
    let time: Double  // ns
}

@MainActor
class SimulationManager: ObservableObject {
    @Published var events: [SimEvent] = []
    @Published var currentEvent: SimEvent?
    @Published var isRunning = false
    @Published var animationSpeed: Double = 1.0
    @Published var colorMode: ColorMode = .byDetected
    @Published var showNgspiceOverlay: Bool = false
    
    enum ColorMode: String, CaseIterable {
        case byDetected = "By Detected p.e."
        case byEdep = "By Edep (MeV)"
        case byProduced = "By Produced Photons"
    }
    
    private var currentIndex = 0
    
    func loadData() async {
        // Try bundled first (add hits.csv to app Resources for production)
        var url = Bundle.main.url(forResource: "hits", withExtension: "csv")
        
        // Fallback to project data for development (relative to app or absolute)
        if url == nil {
            let projectHits = "/Users/sawaiz/physics/sim/geant4/hits.csv"
            if FileManager.default.fileExists(atPath: projectHits) {
                url = URL(fileURLWithPath: projectHits)
            }
        }
        
        guard let dataURL = url else {
            generateSyntheticData()
            return
        }
        
        do {
            let data = try String(contentsOf: dataURL)
            let lines = data.components(separatedBy: .newlines).dropFirst().filter { !$0.isEmpty }
            events = lines.compactMap { line in
                let parts = line.components(separatedBy: ",")
                guard parts.count >= 8,
                      let id = Int(parts[0].trimmingCharacters(in: .whitespaces)),
                      let x = Double(parts[1]),
                      let y = Double(parts[2]),
                      let edep = Double(parts[4]),
                      let prod = Int(parts[5]),
                      let shifted = Int(parts[6]),
                      let det = Int(parts[7]) else { return nil }
                
                // Use real time spread or approximate
                let time = 5.0 + Double(det) * 0.05 + Double.random(in: -1...1)
                return SimEvent(id: id, x: x, y: y, edep: edep, photonsProduced: prod, photonsShifted: shifted, photonsDetected: det, time: time)
            }
            
            if !events.isEmpty {
                currentEvent = events.first
            } else {
                generateSyntheticData()
            }
        } catch {
            print("Failed to load hits.csv: \(error)")
            generateSyntheticData()
        }
    }
    
    private func generateSyntheticData() {
        // High quality synthetic matching real Geant4 improvements (~26-66 p.e., cosmic spectrum)
        events = (0..<50).map { i in
            let x = Double.random(in: -80...80)
            let y = Double.random(in: -80...80)
            let edep = Double.random(in: 1.8...3.5)
            let baseYield = 10000.0 * edep
            let collection = 0.0035 * (1 - 0.3 * (sqrt(x*x + y*y)/90)) // distance falloff
            let pde = 0.38
            let detected = max(10, Int(baseYield * collection * pde * Double.random(in: 0.7...1.3)))
            
            return SimEvent(
                id: i,
                x: x,
                y: y,
                edep: edep,
                photonsProduced: Int(baseYield),
                photonsShifted: Int(baseYield * 0.8),
                photonsDetected: detected,
                time: Double.random(in: 4...12)
            )
        }
        currentEvent = events.first
    }
    
    func runSimulation(energy: Double, x: Double, y: Double) {
        isRunning = true
        
        // Simulate one high-quality event based on params (matches improved Geant4 model)
        let edep = energy * 0.8 + Double.random(in: -0.5...0.5) // approx
        let yield = 10000.0 * edep
        let distFactor = 1.0 - min(1.0, sqrt(x*x + y*y) / 120.0)
        let detected = Int(yield * 0.0035 * distFactor * 0.38 * Double.random(in: 0.85...1.15))
        
        let newEvent = SimEvent(
            id: events.count,
            x: x,
            y: y,
            edep: edep,
            photonsProduced: Int(yield),
            photonsShifted: Int(yield * 0.75),
            photonsDetected: max(8, detected),
            time: 6.0 + energy * 0.3
        )
        
        events.append(newEvent)
        currentEvent = newEvent
        currentIndex = events.count - 1
        
        // Simulate async processing for UI feedback
        Task {
            try? await Task.sleep(for: .milliseconds(800))
            isRunning = false
        }
    }
    
    func nextEvent() {
        guard !events.isEmpty else { return }
        currentIndex = (currentIndex + 1) % events.count
        currentEvent = events[currentIndex]
    }
    
    func reset() {
        currentIndex = 0
        if !events.isEmpty {
            currentEvent = events[0]
        }
    }
    
    // ngspice waveform support (load from sim/circuit/results/wave_dual_n*.csv for time series)
    // For demo, generate synthetic waveform based on event time
    func loadNgspiceWaveform(for event: SimEvent) -> [Double] {
        // Simple synthetic waveform matching the time profile from ngspice runs
        let duration = 400.0 // ns
        let samples = 50
        var waveform: [Double] = []
        for i in 0..<samples {
            let t = Double(i) / Double(samples) * duration
            let peak = exp(-pow(t - event.time * 10, 2) / (2 * pow(50, 2))) * Double(event.photonsDetected) / 100.0
            waveform.append(peak + Double.random(in: -0.05...0.05))
        }
        return waveform
    }
}
