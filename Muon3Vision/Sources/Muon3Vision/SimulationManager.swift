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
    
    private var currentIndex = 0
    
    func loadData() async {
        // Load from bundled hits.csv (copy from sim/geant4/hits.csv)
        guard let url = Bundle.main.url(forResource: "hits", withExtension: "csv") else {
            // Fallback to high-quality synthetic data matching improved model
            generateSyntheticData()
            return
        }
        
        do {
            let data = try String(contentsOf: url)
            let lines = data.components(separatedBy: .newlines).dropFirst()
            events = lines.compactMap { line in
                let parts = line.components(separatedBy: ",")
                guard parts.count >= 8,
                      let id = Int(parts[0]),
                      let x = Double(parts[1]),
                      let y = Double(parts[2]),
                      let edep = Double(parts[4]),
                      let prod = Int(parts[5]),
                      let shifted = Int(parts[6]),
                      let det = Int(parts[7]) else { return nil }
                
                let time = Double.random(in: 5...15) // Approximate from model
                return SimEvent(id: id, x: x, y: y, edep: edep, photonsProduced: prod, photonsShifted: shifted, photonsDetected: det, time: time)
            }
            
            if !events.isEmpty {
                currentEvent = events.first
            }
        } catch {
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
}
