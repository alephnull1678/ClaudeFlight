class FlightSimulator {
    constructor() {
        console.log('Starting Flight Simulator initialization...');
        this.init();
        console.log('Basic initialization complete');
        this.setupScene();
        console.log('Scene setup complete');
        this.initializeSystems();
        console.log('All systems initialized');
        this.animate();
        console.log('Animation loop started');
    }

    init() {
        // Game state
        this.paused = false;
        this.firstPerson = false;
        this.crashed = false;
        
        // Camera shake
        this.cameraShake = { intensity: 0, duration: 0 };
        
        // Explosion and timeout tracking
        this.explosion = null;
        this.explosionTimeout = null;
        this.crashTimeout = null;
    }

    setupScene() {
        // Scene with enhanced atmospheric fog
        this.scene = new THREE.Scene();
        this.scene.fog = new THREE.FogExp2(0x87ceeb, 0.0015);
        
        // Camera
        this.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 2000);
        this.camera.position.set(0, 210, 20);
        
        // Renderer with enhanced graphics
        this.renderer = new THREE.WebGLRenderer({ 
            antialias: true,
            powerPreference: "high-performance"
        });
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.setClearColor(0x87ceeb);
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        
        // Enhanced rendering settings
        this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
        this.renderer.toneMappingExposure = 1.2;
        this.renderer.outputColorSpace = THREE.SRGBColorSpace;
        document.body.appendChild(this.renderer.domElement);
        
        // Resize handler
        window.addEventListener('resize', () => {
            this.camera.aspect = window.innerWidth / window.innerHeight;
            this.camera.updateProjectionMatrix();
            this.renderer.setSize(window.innerWidth, window.innerHeight);
        });
    }

    initializeSystems() {
        // Initialize all game systems
        this.audioSystem = new AudioSystem();
        this.skySystem = new SkySystem(this.scene, this.renderer);
        this.terrainSystem = new TerrainSystem(this.scene);
        this.aircraft = new Aircraft(this.scene);
        this.shootingSystem = new ShootingSystem(this.scene, this.audioSystem, this.terrainSystem);
        this.controlsSystem = new ControlsSystem(this);
        this.uiSystem = new UISystem();
    }

    updateControls() {
        this.controlsSystem.updateControls(this.aircraft);
    }

    updatePhysics() {
        if (this.paused || this.crashed) return;
        
        this.aircraft.updatePhysics();
        
        // Collision detection
        this.checkCollisions();
        
        // Update shooting system
        this.shootingSystem.updateShooting(
            this.controlsSystem.isMousePressed, 
            this.aircraft, 
            this.paused, 
            this.crashed
        );
        
        // Update projectiles
        this.shootingSystem.updateProjectiles();
    }

    checkCollisions() {
        const terrainHeight = this.terrainSystem.getTerrainHeight(
            this.aircraft.getPosition().x,
            this.aircraft.getPosition().z
        );
        
        const groundClearance = this.aircraft.getPosition().y - terrainHeight;
        
        // Check water collision
        const waterClearance = this.aircraft.getPosition().y - this.terrainSystem.waterLevel;
        
        // Grazing effect (terrain or water)
        if ((groundClearance < 5 && groundClearance > 0) || 
            (waterClearance < 5 && waterClearance > 0 && terrainHeight < this.terrainSystem.waterLevel)) {
            this.cameraShake.intensity = 0.5;
            this.cameraShake.duration = 10;
        }
        
        // Fast descent shake
        if (this.aircraft.velocity.y < -2) {
            this.cameraShake.intensity = Math.abs(this.aircraft.velocity.y) * 0.3;
            this.cameraShake.duration = 5;
        }
        
        // Water collision detection
        if (terrainHeight < this.terrainSystem.waterLevel && 
            waterClearance <= 0 && this.aircraft.velocity.length() > 0.1) {
            this.crash();
            return;
        }
        
        // Terrain crash detection
        if (groundClearance <= 0 && this.aircraft.velocity.length() > 0.3) {
            this.crash();
        } else if (groundClearance <= 0) {
            // Soft landing on terrain
            this.aircraft.group.position.y = terrainHeight + 0.5;
            this.aircraft.velocity.y = 0;
        }
    }

    crash() {
        this.crashed = true;
        this.cameraShake.intensity = 5;
        this.cameraShake.duration = 60;
        
        // Create explosion particles
        this.createExplosion();
        
        // Play explosion sound
        this.audioSystem.playExplosionSound();
        
        // Stop motor sounds
        this.audioSystem.stopAllAudio();
        
        // Show reset prompt
        this.crashTimeout = setTimeout(() => {
            if (this.crashed) {
                this.uiSystem.showCrashMessage();
            }
        }, 1000);
    }

    createExplosion() {
        const explosionGeometry = new THREE.BufferGeometry();
        const particleCount = 100;
        const positions = new Float32Array(particleCount * 3);
        const colors = new Float32Array(particleCount * 3);
        
        for (let i = 0; i < particleCount; i++) {
            positions[i * 3] = (Math.random() - 0.5) * 20;
            positions[i * 3 + 1] = Math.random() * 20;
            positions[i * 3 + 2] = (Math.random() - 0.5) * 20;
            
            colors[i * 3] = 1;
            colors[i * 3 + 1] = Math.random() * 0.5;
            colors[i * 3 + 2] = 0;
        }
        
        explosionGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        explosionGeometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
        
        const explosionMaterial = new THREE.PointsMaterial({
            size: 5,
            vertexColors: true,
            transparent: true,
            opacity: 0.8
        });
        
        this.explosion = new THREE.Points(explosionGeometry, explosionMaterial);
        this.explosion.position.copy(this.aircraft.getPosition());
        this.scene.add(this.explosion);
        
        // Remove explosion after a while
        this.explosionTimeout = setTimeout(() => {
            if (this.explosion) {
                this.scene.remove(this.explosion);
                this.explosion = null;
            }
        }, 3000);
    }

    updateCamera() {
        let targetPosition, targetLookAt;
        
        if (this.firstPerson) {
            // First person view
            targetPosition = this.aircraft.getPosition().clone();
            targetPosition.add(new THREE.Vector3(2, 1, 0).applyQuaternion(this.aircraft.getQuaternion()));
            
            targetLookAt = this.aircraft.getPosition().clone();
            targetLookAt.add(new THREE.Vector3(10, 0, 0).applyQuaternion(this.aircraft.getQuaternion()));
        } else {
            // Third person view
            const offset = new THREE.Vector3(-20, 8, 0);
            offset.applyQuaternion(this.aircraft.getQuaternion());
            
            targetPosition = this.aircraft.getPosition().clone().add(offset);
            targetLookAt = this.aircraft.getPosition().clone();
        }
        
        // Apply camera shake
        if (this.cameraShake.duration > 0) {
            const shakeX = (Math.random() - 0.5) * this.cameraShake.intensity;
            const shakeY = (Math.random() - 0.5) * this.cameraShake.intensity;
            const shakeZ = (Math.random() - 0.5) * this.cameraShake.intensity;
            
            targetPosition.add(new THREE.Vector3(shakeX, shakeY, shakeZ));
            this.cameraShake.duration--;
        }
        
        // Smooth camera movement
        this.camera.position.lerp(targetPosition, 0.1);
        this.camera.lookAt(targetLookAt);
    }

    toggleCamera() {
        this.firstPerson = !this.firstPerson;
    }

    resetPlane() {
        // Cancel crash timeout to prevent dialog
        if (this.crashTimeout) {
            clearTimeout(this.crashTimeout);
            this.crashTimeout = null;
        }
        
        // Hide crash message
        this.uiSystem.hideCrashMessage();
        
        // Remove explosion particles immediately
        if (this.explosion) {
            this.scene.remove(this.explosion);
            this.explosion = null;
        }
        if (this.explosionTimeout) {
            clearTimeout(this.explosionTimeout);
            this.explosionTimeout = null;
        }
        
        // Reset shooting system
        this.shootingSystem.reset();
        
        this.crashed = false;
        this.aircraft.reset();
        this.cameraShake.intensity = 0;
        this.cameraShake.duration = 0;
        this.controlsSystem.isMousePressed = false;
        
        // Stop all sounds and restart
        this.audioSystem.stopAllAudio();
    }

    togglePause() {
        this.paused = !this.paused;
        
        if (this.paused) {
            this.uiSystem.showPauseMenu();
            // Exit pointer lock when pausing
            if (document.pointerLockElement) {
                document.exitPointerLock();
            }
        } else {
            this.uiSystem.hidePauseMenu();
        }
    }

    animate() {
        requestAnimationFrame(() => this.animate());
        
        if (!this.paused) {
            this.updateControls();
            this.updatePhysics();
            this.updateCamera();
            this.terrainSystem.updateTerrain(this.aircraft.getPosition());
            this.terrainSystem.updateBiome(this.aircraft.getPosition());
            this.skySystem.updateDayNightCycle(this.aircraft.getPosition());
            this.terrainSystem.updateClouds();
            this.skySystem.updateSky(this.aircraft.getPosition());
            this.terrainSystem.updateWater();
            this.audioSystem.updateMotorSound(this.aircraft.thrust, this.aircraft.speed, this.crashed);
            this.uiSystem.update(this.aircraft);
        }
        
        this.renderer.render(this.scene, this.camera);
    }
}

// Initialize game when page loads
window.addEventListener('load', () => {
    console.log('Initializing Flight Simulator...');
    try {
        window.game = new FlightSimulator();
        console.log('Flight Simulator initialized successfully');
    } catch (error) {
        console.error('Failed to initialize Flight Simulator:', error);
    }
});