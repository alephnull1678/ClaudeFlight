class ShootingSystem {
    constructor(scene, audioSystem, terrainSystem) {
        this.scene = scene;
        this.audioSystem = audioSystem;
        this.terrainSystem = terrainSystem;
        this.projectiles = [];
        this.lastShotTime = 0;
        this.fireRate = 100;
    }
    
    shoot(aircraft) {
        if (!aircraft) return;
        
        // Create projectile
        const projectile = {
            mesh: this.createProjectileMesh(),
            velocity: new THREE.Vector3(),
            startTime: Date.now(),
            lifespan: 5000
        };
        
        // Position at front of plane
        const planeForward = new THREE.Vector3(1, 0, 0);
        planeForward.applyQuaternion(aircraft.getQuaternion());
        
        projectile.mesh.position.copy(aircraft.getPosition());
        projectile.mesh.position.add(planeForward.clone().multiplyScalar(5));
        
        // Set velocity in plane's forward direction + inherit plane's velocity
        projectile.velocity.copy(planeForward).multiplyScalar(2);
        projectile.velocity.add(aircraft.velocity);
        
        // Orient projectile to match direction
        projectile.mesh.lookAt(projectile.mesh.position.clone().add(projectile.velocity));
        
        this.scene.add(projectile.mesh);
        this.projectiles.push(projectile);
        
        // Play firing sound
        this.audioSystem.playFiringSound();
    }
    
    createProjectileMesh() {
        const geometry = new THREE.BoxGeometry(0.1, 0.1, 2);
        const material = new THREE.MeshBasicMaterial({ color: 0xffff00 });
        return new THREE.Mesh(geometry, material);
    }
    
    updateShooting(isMousePressed, aircraft, paused, crashed) {
        if (!isMousePressed || paused || crashed) return;
        
        const now = Date.now();
        if (now - this.lastShotTime >= this.fireRate) {
            this.shoot(aircraft);
            this.lastShotTime = now;
        }
    }
    
    updateProjectiles() {
        for (let i = this.projectiles.length - 1; i >= 0; i--) {
            const projectile = this.projectiles[i];
            
            // Check if projectile expired
            if (Date.now() - projectile.startTime > projectile.lifespan) {
                this.scene.remove(projectile.mesh);
                this.projectiles.splice(i, 1);
                continue;
            }
            
            // Update position
            projectile.mesh.position.add(projectile.velocity);
            
            // Check terrain collision
            const terrainHeight = this.terrainSystem.getTerrainHeight(
                projectile.mesh.position.x,
                projectile.mesh.position.z
            );
            
            if (projectile.mesh.position.y <= terrainHeight) {
                // Hit terrain - create explosion
                this.createProjectileExplosion(projectile.mesh.position.clone());
                this.audioSystem.playExplosionSound();
                
                // Remove projectile
                this.scene.remove(projectile.mesh);
                this.projectiles.splice(i, 1);
            }
        }
    }
    
    createProjectileExplosion(position) {
        const explosionGeometry = new THREE.BufferGeometry();
        const particleCount = 20;
        const positions = new Float32Array(particleCount * 3);
        const colors = new Float32Array(particleCount * 3);
        
        for (let i = 0; i < particleCount; i++) {
            positions[i * 3] = (Math.random() - 0.5) * 4;
            positions[i * 3 + 1] = Math.random() * 4;
            positions[i * 3 + 2] = (Math.random() - 0.5) * 4;
            
            colors[i * 3] = 1;
            colors[i * 3 + 1] = Math.random() * 0.8;
            colors[i * 3 + 2] = 0;
        }
        
        explosionGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        explosionGeometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
        
        const explosionMaterial = new THREE.PointsMaterial({
            size: 3,
            vertexColors: true,
            transparent: true,
            opacity: 0.8
        });
        
        const explosion = new THREE.Points(explosionGeometry, explosionMaterial);
        explosion.position.copy(position);
        this.scene.add(explosion);
        
        // Remove explosion after 1 second
        setTimeout(() => {
            this.scene.remove(explosion);
        }, 1000);
    }
    
    reset() {
        // Clean up all projectiles
        for (const projectile of this.projectiles) {
            this.scene.remove(projectile.mesh);
        }
        this.projectiles = [];
    }
}