class Aircraft {
    constructor(scene) {
        this.scene = scene;
        this.group = new THREE.Group();
        this.propeller = null;
        
        // Physics properties
        this.velocity = new THREE.Vector3(0, 0, 0);
        this.acceleration = new THREE.Vector3(0, 0, 0);
        this.thrust = 0;
        this.maxThrust = 0.1;
        this.drag = 0.98;
        this.gravity = -0.02;
        this.speed = 0;
        this.altitude = 100;
        
        // Exhaust system
        this.exhaustParticles = null;
        this.particles = [];
        this.particlePool = [];
        this.particleGeometry = null;
        this.particleMaterial = null;
        
        this.create();
        this.createExhaustParticles();
        this.scene.add(this.group);
    }
    
    create() {
        // Fuselage (body)
        const fuselageGeometry = new THREE.CylinderGeometry(0.5, 1, 8, 6);
        const fuselageMaterial = new THREE.MeshLambertMaterial({ color: 0x0066cc });
        const fuselage = new THREE.Mesh(fuselageGeometry, fuselageMaterial);
        fuselage.rotation.z = Math.PI / 2;
        fuselage.castShadow = true;
        this.group.add(fuselage);
        
        // Wings - two separate rectangles extending from body
        const wingGeometry = new THREE.BoxGeometry(6, 0.3, 2);
        const wingMaterial = new THREE.MeshLambertMaterial({ color: 0x004499 });
        
        // Left wing extending to the left
        const leftWing = new THREE.Mesh(wingGeometry, wingMaterial);
        leftWing.position.set(0, -0.5, -1.5);
        leftWing.castShadow = true;
        this.group.add(leftWing);
        
        // Right wing extending to the right  
        const rightWing = new THREE.Mesh(wingGeometry, wingMaterial);
        rightWing.position.set(0, -0.5, 1.5);
        rightWing.castShadow = true;
        this.group.add(rightWing);
        
        // Tail
        const tailGeometry = new THREE.BoxGeometry(2, 3, 0.3);
        const tailMaterial = new THREE.MeshLambertMaterial({ color: 0x004499 });
        const tail = new THREE.Mesh(tailGeometry, tailMaterial);
        tail.position.set(-3, 1, 0);
        tail.castShadow = true;
        this.group.add(tail);
        
        // Propeller
        const propGeometry = new THREE.BoxGeometry(0.1, 4, 0.1);
        const propMaterial = new THREE.MeshLambertMaterial({ color: 0x333333 });
        this.propeller = new THREE.Mesh(propGeometry, propMaterial);
        this.propeller.position.set(4, 0, 0);
        this.group.add(this.propeller);
        
        // Position airplane
        this.group.position.set(0, 200, 0);
    }
    
    createExhaustParticles() {
        // Create a group to hold individual particle meshes
        this.exhaustParticles = new THREE.Group();
        this.exhaustParticles.position.set(-4, 0, 0);
        this.group.add(this.exhaustParticles);
        
        this.particles = [];
        this.particlePool = [];
        
        // Create geometry and material for square particles
        this.particleGeometry = new THREE.PlaneGeometry(1, 1);
        this.particleMaterial = new THREE.MeshBasicMaterial({
            color: 0x808080,
            transparent: true,
            opacity: 0.7
        });
    }
    
    updatePhysics() {
        // Calculate forward direction
        const forward = new THREE.Vector3(1, 0, 0);
        forward.applyQuaternion(this.group.quaternion);
        
        // Apply thrust
        this.acceleration.copy(forward).multiplyScalar(this.thrust);
        
        // Apply gravity
        this.acceleration.y += this.gravity;
        
        // Apply drag
        this.velocity.multiplyScalar(this.drag);
        
        // Update velocity
        this.velocity.add(this.acceleration);
        
        // Update position
        this.group.position.add(this.velocity);
        
        // Calculate speed and altitude
        this.speed = this.velocity.length() * 100;
        this.altitude = Math.max(0, this.group.position.y);
        
        // Update exhaust particles
        this.updateExhaustParticles();
    }
    
    updateExhaustParticles() {
        if (!this.exhaustParticles) return;
        
        const isThrusting = this.thrust > 0.01;
        const currentTime = Date.now();
        
        // Spawn new particles when thrusting
        if (isThrusting && Math.random() < 0.3) {
            this.spawnSmokeParticle();
        }
        
        // Update existing particles
        for (let i = this.particles.length - 1; i >= 0; i--) {
            const particle = this.particles[i];
            const age = (currentTime - particle.spawnTime) / 1000;
            
            if (age > 2) {
                // Remove particle after 2 seconds
                this.exhaustParticles.remove(particle.mesh);
                this.particles.splice(i, 1);
                continue;
            }
            
            // Apply physics
            particle.velocity.y -= 0.01;
            particle.velocity.multiplyScalar(0.99);
            
            // Update position in world space
            const worldPosition = new THREE.Vector3();
            particle.mesh.getWorldPosition(worldPosition);
            
            const worldVelocity = particle.velocity.clone();
            worldVelocity.applyQuaternion(this.group.quaternion);
            
            worldPosition.add(worldVelocity);
            
            const exhaustWorldPos = new THREE.Vector3();
            this.exhaustParticles.getWorldPosition(exhaustWorldPos);
            
            particle.mesh.position.copy(worldPosition.sub(exhaustWorldPos));
            
            // Fade out over time
            const fadeProgress = age / 2;
            particle.mesh.material.opacity = 0.7 * (1 - fadeProgress);
        }
    }
    
    spawnSmokeParticle() {
        const particle = {
            mesh: new THREE.Mesh(this.particleGeometry, this.particleMaterial.clone()),
            velocity: new THREE.Vector3(
                -2 - Math.random() * 2,
                (Math.random() - 0.5) * 0.5,
                (Math.random() - 0.5) * 0.5
            ),
            spawnTime: Date.now()
        };
        
        const grayValue = 0.1 + Math.random() * 0.3;
        particle.mesh.material.color.setRGB(grayValue, grayValue, grayValue);
        
        particle.mesh.position.set(0, 0, 0);
        
        this.exhaustParticles.add(particle.mesh);
        this.particles.push(particle);
    }
    
    updatePropeller() {
        if (this.propeller) {
            this.propeller.rotation.x += (0.5 + this.thrust * 2);
        }
    }
    
    getPosition() {
        return this.group.position;
    }
    
    getQuaternion() {
        return this.group.quaternion;
    }
    
    setPosition(x, y, z) {
        this.group.position.set(x, y, z);
    }
    
    setQuaternion(x, y, z, w) {
        this.group.quaternion.set(x, y, z, w);
    }
    
    reset() {
        this.setPosition(0, 200, 0);
        this.setQuaternion(0, 0, 0, 1);
        this.velocity.set(0, 0, 0);
        this.acceleration.set(0, 0, 0);
        this.thrust = 0;
        this.speed = 0;
    }
}