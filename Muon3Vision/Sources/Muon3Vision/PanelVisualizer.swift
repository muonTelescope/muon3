import RealityKit
import SwiftUI

/// High quality visualization builder for the muon panel.
/// Focus: Physically accurate look, beautiful particles, smooth interactions.
/// Now includes logo integration as a floating high-quality emblem.
struct PanelVisualizer {
    func buildHighQualityPanel() -> Entity {
        let root = Entity()
        root.name = "MuonPanelRoot"
        
        // Scintillator Panel - High quality PBR
        let panelMesh = MeshResource.generateBox(width: 0.2, height: 0.2, depth: 0.01)
        var panelMaterial = PhysicallyBasedMaterial()
        panelMaterial.baseColor = .init(tint: .init(red: 0.2, green: 0.85, blue: 0.4, alpha: 0.65))
        panelMaterial.roughness = 0.15
        panelMaterial.metallic = 0.0
        panelMaterial.emissiveColor = .init(color: .init(red: 0.1, green: 0.4, blue: 0.15))
        panelMaterial.emissiveIntensity = 0.3
        
        let panelEntity = ModelEntity(mesh: panelMesh, materials: [panelMaterial])
        panelEntity.name = "Panel"
        panelEntity.position = [0, 0, 0]
        root.addChild(panelEntity)
        
        // WLS Fiber Loop - High quality glowing tube
        let fiberMaterial = createGlowingFiberMaterial()
        
        let loopMesh = MeshResource.generateTorus(ringRadius: 0.082, tubeRadius: 0.00065)
        let loopEntity = ModelEntity(mesh: loopMesh, materials: [fiberMaterial])
        loopEntity.name = "FiberLoop"
        loopEntity.position = [0, 0, 0.0035]
        root.addChild(loopEntity)
        
        // Exit legs
        for offset in [-0.02, 0.02] {
            let legMesh = MeshResource.generateCylinder(height: 0.05, radius: 0.00065)
            let leg = ModelEntity(mesh: legMesh, materials: [fiberMaterial])
            leg.name = "FiberLeg"
            leg.position = [0.105, Float(offset), 0.0035]
            leg.orientation = simd_quatf(angle: .pi/2, axis: [0,1,0])
            root.addChild(leg)
        }
        
        // SiPM - High quality emissive sensor
        let sipmMesh = MeshResource.generateBox(width: 0.003, height: 0.003, depth: 0.0005)
        var sipmMat = PhysicallyBasedMaterial()
        sipmMat.baseColor = .init(tint: .black)
        sipmMat.emissiveColor = .init(color: .red)
        sipmMat.emissiveIntensity = 2.0
        let sipm = ModelEntity(mesh: sipmMesh, materials: [sipmMat])
        sipm.name = "SiPM"
        sipm.position = [0.13, 0, 0.0035]
        root.addChild(sipm)
        
        // High-quality logo emblem floating above the panel (using a plane with the logo texture)
        // Note: For full texture loading in production, use TextureResource.load(named: "AppIcon-1024")
        // Here we use a placeholder emissive plane as high-quality logo representation
        let logoMesh = MeshResource.generatePlane(width: 0.08, height: 0.08)
        var logoMaterial = UnlitMaterial(color: .white) // In real app, replace with image texture
        // To use actual logo: load image and apply as texture
        let logo = ModelEntity(mesh: logoMesh, materials: [logoMaterial])
        logo.name = "Muon3VisionLogo"
        logo.position = [0, 0.15, 0]  // Floating above
        // Add subtle glow
        logo.components.set(OpacityComponent(opacity: 0.9))
        root.addChild(logo)
        
        // Add subtle environment light for quality
        let light = DirectionalLight()
        light.light.color = .white
        light.light.intensity = 800
        light.position = [0, 0.5, 1]
        root.addChild(light)
        
        return root
    }
    
    private func createGlowingFiberMaterial() -> PhysicallyBasedMaterial {
        var mat = PhysicallyBasedMaterial()
        mat.baseColor = .init(tint: .init(red: 0.1, green: 0.9, blue: 0.3))
        mat.roughness = 0.2
        mat.metallic = 0.0
        mat.emissiveColor = .init(color: .init(red: 0.2, green: 1.0, blue: 0.4))
        mat.emissiveIntensity = 1.5
        return mat
    }
    
    func animateEvent(_ event: SimEvent, on root: Entity) async {
        guard let panel = root.findEntity(named: "Panel"),
              let fiber = root.findEntity(named: "FiberLoop"),
              let sipm = root.findEntity(named: "SiPM"),
              let logo = root.findEntity(named: "Muon3VisionLogo") else { return }
        
        let impactPos = SIMD3<Float>(Float(event.x/1000.0), Float(event.y/1000.0), 0.005)
        
        // Scintillation burst
        if let burst = createPhotonBurst(at: impactPos, count: min(80, event.photonsDetected / 2), color: .blue) {
            root.addChild(burst)
            Task {
                try? await Task.sleep(for: .seconds(1.5))
                burst.removeFromParent()
            }
        }
        
        // Animate fiber glow
        if let fiberModel = fiber as? ModelEntity {
            var mat = fiberModel.model?.materials.first as? PhysicallyBasedMaterial ?? PhysicallyBasedMaterial()
            mat.emissiveIntensity = 3.0 + Float(event.photonsShifted) / 100.0
            fiberModel.model?.materials = [mat]
            
            Task {
                try? await Task.sleep(for: .seconds(2.0))
                if let currentMat = fiberModel.model?.materials.first as? PhysicallyBasedMaterial {
                    var faded = currentMat
                    faded.emissiveIntensity = 1.5
                    fiberModel.model?.materials = [faded]
                }
            }
        }
        
        // Photon paths
        let sipmPos = sipm.position
        if let photons = createPhotonStream(from: impactPos, to: sipmPos, count: min(120, event.photonsDetected), color: .green) {
            root.addChild(photons)
            Task {
                try? await Task.sleep(for: .seconds(3.0))
                photons.removeFromParent()
            }
        }
        
        // SiPM hit response
        if event.photonsDetected > 10 {
            if let sipmModel = sipm as? ModelEntity {
                var mat = sipmModel.model?.materials.first as? PhysicallyBasedMaterial ?? PhysicallyBasedMaterial()
                mat.emissiveColor = .init(color: .white)
                mat.emissiveIntensity = 8.0
                sipmModel.model?.materials = [mat]
                
                let hitLight = PointLight()
                hitLight.light.color = .white
                hitLight.light.intensity = 2000 * Float(event.photonsDetected) / 50.0
                hitLight.position = sipmPos
                root.addChild(hitLight)
                
                Task {
                    try? await Task.sleep(for: .seconds(0.8))
                    hitLight.removeFromParent()
                    if let current = sipmModel.model?.materials.first as? PhysicallyBasedMaterial {
                        var reset = current
                        reset.emissiveColor = .init(color: .red)
                        reset.emissiveIntensity = 2.0
                        sipmModel.model?.materials = [reset]
                    }
                }
            }
        }
        
        // Logo pulse on detection for high quality feedback
        if let logoModel = logo as? ModelEntity {
            logoModel.scale = [1.2, 1.2, 1.2]
            Task {
                try? await Task.sleep(for: .seconds(0.4))
                logoModel.scale = [1.0, 1.0, 1.0]
            }
        }
    }
    
    private func createPhotonBurst(at position: SIMD3<Float>, count: Int, color: UIColor) -> Entity? {
        let burst = Entity()
        burst.name = "photonBurst"
        
        let particleMesh = MeshResource.generateSphere(radius: 0.0008)
        var particleMat = UnlitMaterial(color: color)
        
        for i in 0..<count {
            let particle = ModelEntity(mesh: particleMesh, materials: [particleMat])
            let angle = Float(i) / Float(count) * .pi * 2
            let radius = Float.random(in: 0.01...0.04)
            particle.position = position + SIMD3<Float>(cos(angle) * radius, sin(angle) * radius * 0.6, Float.random(in: -0.01...0.01))
            
            let duration = Double.random(in: 0.4...1.2)
            particle.scale = .one * 0.3
            burst.addChild(particle)
            
            Task {
                try? await Task.sleep(for: .seconds(duration))
                particle.removeFromParent()
            }
        }
        return burst
    }
    
    private func createPhotonStream(from start: SIMD3<Float>, to end: SIMD3<Float>, count: Int, color: UIColor) -> Entity? {
        let stream = Entity()
        stream.name = "photonStream"
        
        let particleMesh = MeshResource.generateSphere(radius: 0.0006)
        var mat = UnlitMaterial(color: color.withAlphaComponent(0.9))
        
        for i in 0..<count {
            let t = Float(i) / Float(count)
            let pos = mix(start, end, t: t) + SIMD3<Float>(0, 0, Float.random(in: -0.002...0.002))
            
            let p = ModelEntity(mesh: particleMesh, materials: [mat])
            p.position = pos
            stream.addChild(p)
            
            Task {
                try? await Task.sleep(for: .seconds(Double(t) * 1.5))
                p.scale = .one * 1.8
                try? await Task.sleep(for: .seconds(0.3))
                p.removeFromParent()
            }
        }
        return stream
    }
    
    private func mix(_ a: SIMD3<Float>, _ b: SIMD3<Float>, t: Float) -> SIMD3<Float> {
        return a + (b - a) * t
    }
}
