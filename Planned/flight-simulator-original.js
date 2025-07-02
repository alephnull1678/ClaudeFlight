// Flight Simulator - Main Game Logic
class FlightSimulator {
    constructor() {
        console.log('Starting Flight Simulator initialization...');
        this.init();
        console.log('Basic initialization complete');
        this.setupScene();
        console.log('Scene setup complete');
        this.createAirplane();
        console.log('Airplane created');
        this.setupTerrain();
        console.log('Terrain setup complete');
        this.setupControls();
        console.log('Controls setup complete');
        this.setupUI();
        console.log('UI setup complete');
        this.setupAudio();
        console.log('Audio setup complete');
        this.animate();
        console.log('Animation loop started');
    }

    init() {
        // Game state
        this.paused = false;
        this.soundEnabled = true;
        this.firstPerson = false;
        this.crashed = false;
        this.debugEnabled = false; // New debug flag
        this.lastFrameTime = performance.now();
        this.frameCount = 0;
        this.fps = 0;
        
        // Shooting system
        this.projectiles = [];
        this.isMousePressed = false;
        this.lastShotTime = 0;
        this.fireRate = 100; // milliseconds between shots in auto mode
        
        // Physics
        this.velocity = new THREE.Vector3(0, 0, 0);
        this.acceleration = new THREE.Vector3(0, 0, 0);
        this.thrust = 0;
        this.maxThrust = 0.1; // Reduced from 0.5
        this.drag = 0.98;
        this.gravity = -0.02;
        this.speed = 0;
        this.altitude = 100;
        
        // Controls
        this.keys = {};
        this.mouse = { x: 0, y: 0 };
        this.cameraShake = { intensity: 0, duration: 0 };
        
        // Terrain chunks
        this.chunks = new Map();
        this.chunkSize = 400; // Increased from 200
        this.viewDistance = 3;
        
        // Biomes with increased tree frequency
        this.biomes = [
            { name: 'Forest', color: 0x2d5a27, treeChance: 0.8 }, // Dramatically increased from 0.3
            { name: 'Desert', color: 0xc2b280, treeChance: 0.1 }, // Doubled from 0.05
            { name: 'Mountains', color: 0x8b7355, treeChance: 0.25 }, // Increased from 0.1
            { name: 'Plains', color: 0x7cfc00, treeChance: 0.4 }, // Increased from 0.15
            { name: 'Tundra', color: 0xf0f8ff, treeChance: 0.08 }, // Increased from 0.02
            { name: 'Swamp', color: 0x2f4f2f, treeChance: 0.75 }, // Increased from 0.4
            { name: 'Canyon', color: 0xcd853f, treeChance: 0.12 }, // Increased from 0.05
            { name: 'Volcanic', color: 0x8b0000, treeChance: 0.03 }, // Increased from 0.01
            { name: 'Coastal', color: 0x87ceeb, treeChance: 0.45 }, // Increased from 0.2
            { name: 'Jungle', color: 0x228b22, treeChance: 0.9 } // Increased from 0.6
        ];
        this.currentBiome = this.biomes[0];
        
        // Noise for terrain generation
        this.noise = window.createNoise2D ? window.createNoise2D() : null;
        
        // Create water texture
        this.createWaterTexture();
        
        // Day/night cycle - start at sunrise
        this.timeOfDay = 0.25; // 0 = midnight, 0.25 = sunrise, 0.5 = noon, 0.75 = sunset, 1 = midnight
        this.daySpeed = 0.0001;
        
        // Water system
        this.waterLevel = -20; // Height at which water appears (below spawn level)
        this.waterTime = 0; // For animating water texture

        // Create debug overlay
        this.createDebugOverlay();
    }

    // New method to create debug overlay
    createDebugOverlay() {
        const debugOverlay = document.createElement('div');
        debugOverlay.id = 'debug-overlay';
        debugOverlay.style.position = 'fixed';
        debugOverlay.style.top = '10px';
        debugOverlay.style.right = '10px';
        debugOverlay.style.backgroundColor = 'rgba(0, 0, 0, 0.7)';
        debugOverlay.style.color = '#fff';
        debugOverlay.style.padding = '10px';
        debugOverlay.style.borderRadius = '5px';
        debugOverlay.style.fontFamily = 'monospace';
        debugOverlay.style.display = 'none'; // Hidden by default
        
        // Create FPS display
        this.fpsDisplay = document.createElement('div');
        this.fpsDisplay.id = 'fps-display';
        debugOverlay.appendChild(this.fpsDisplay);
        
        // Create time of day display
        this.timeDisplay = document.createElement('div');
        this.timeDisplay.id = 'time-display';
        debugOverlay.appendChild(this.timeDisplay);
        
        document.body.appendChild(debugOverlay);
    }

    // Modified togglePause method to include debug menu toggle
    togglePause() {
        this.paused = !this.paused;
        const pauseMenu = document.getElementById('pause-menu');
        
        if (pauseMenu) {
            if (this.paused) {
                // Create debug toggle button if it doesn't exist
                let debugButton = pauseMenu.querySelector('#debug-toggle');
                if (!debugButton) {
                    debugButton = document.createElement('button');
                    debugButton.id = 'debug-toggle';
                    debugButton.textContent = 'Debug Info: ' + (this.debugEnabled ? 'ON' : 'OFF');
                    debugButton.onclick = () => this.toggleDebug();
                    debugButton.style.marginTop = '10px';
                    pauseMenu.appendChild(debugButton);
                }
                pauseMenu.style.display = 'block';
            } else {
                pauseMenu.style.display = 'none';
            }
        }
        
        if (this.paused) {
            if (document.pointerLockElement) {
                document.exitPointerLock();
            }
        }
    }

    // New method to toggle debug display
    toggleDebug() {
        this.debugEnabled = !this.debugEnabled;
        const debugOverlay = document.getElementById('debug-overlay');
        const debugButton = document.getElementById('debug-toggle');
        
        if (debugOverlay) {
            debugOverlay.style.display = this.debugEnabled ? 'block' : 'none';
        }
        
        if (debugButton) {
            debugButton.textContent = 'Debug Info: ' + (this.debugEnabled ? 'ON' : 'OFF');
        }
    }

    // Modified animate method to include FPS calculation
    animate() {
        requestAnimationFrame(() => this.animate());
        
        // Calculate FPS
        const currentTime = performance.now();
        const deltaTime = currentTime - this.lastFrameTime;
        this.frameCount++;
        
        if (deltaTime >= 1000) { // Update FPS every second
            this.fps = Math.round((this.frameCount * 1000) / deltaTime);
            this.frameCount = 0;
            this.lastFrameTime = currentTime;
        }
        
        if (!this.paused) {
            this.updateControls();
            this.updatePhysics();
            this.updateCamera();
            this.updateTerrain();
            this.updateBiome();
            this.updateDayNightCycle();
            this.updateClouds();
            this.updateWater();
            this.updateAudio();
            this.updateUI();
            this.updateDebugInfo(); // New debug info update
        }
        
        this.renderer.render(this.scene, this.camera);
    }

    // New method to update debug information
    updateDebugInfo() {
        if (!this.debugEnabled) return;
        
        // Update FPS display
        if (this.fpsDisplay) {
            this.fpsDisplay.textContent = `FPS: ${this.fps}`;
        }
        
        // Update time of day display
        if (this.timeDisplay) {
            const hours = Math.floor(this.timeOfDay * 24);
            const minutes = Math.floor((this.timeOfDay * 24 * 60) % 60);
            const timeString = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
            const phase = this.getTimePhase();
            this.timeDisplay.textContent = `Time: ${timeString} (${phase})`;
        }
    }

    // New helper method to get time of day phase
    getTimePhase() {
        const time = this.timeOfDay;
        if (time < 0.25) return 'Night';
        if (time < 0.3) return 'Sunrise';
        if (time < 0.7) return 'Day';
        if (time < 0.75) return 'Sunset';
        return 'Night';
    }

    // Rest of the existing code remains the same...
    [... rest of the original code ...]
}