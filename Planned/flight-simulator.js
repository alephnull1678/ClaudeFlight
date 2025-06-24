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
        
        // Biomes
        this.biomes = [
            { name: 'Forest', color: 0x2d5a27, treeChance: 0.3 },
            { name: 'Desert', color: 0xc2b280, treeChance: 0.05 },
            { name: 'Mountains', color: 0x8b7355, treeChance: 0.1 },
            { name: 'Plains', color: 0x7cfc00, treeChance: 0.15 },
            { name: 'Tundra', color: 0xf0f8ff, treeChance: 0.02 },
            { name: 'Swamp', color: 0x2f4f2f, treeChance: 0.4 },
            { name: 'Canyon', color: 0xcd853f, treeChance: 0.05 },
            { name: 'Volcanic', color: 0x8b0000, treeChance: 0.01 },
            { name: 'Coastal', color: 0x87ceeb, treeChance: 0.2 },
            { name: 'Jungle', color: 0x228b22, treeChance: 0.6 }
        ];
        this.currentBiome = this.biomes[0];
        
        // Noise for terrain generation
        this.noise = window.createNoise2D ? window.createNoise2D() : null;
        
        // Day/night cycle
        this.timeOfDay = 0.5; // 0 = midnight, 0.5 = noon, 1 = midnight
        this.daySpeed = 0.0001;
    }

    setupScene() {
        // Scene
        this.scene = new THREE.Scene();
        this.scene.fog = new THREE.Fog(0x87ceeb, 100, 800);
        
        // Camera
        this.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 2000);
        this.camera.position.set(0, 210, 20);
        
        // Renderer
        this.renderer = new THREE.WebGLRenderer({ antialias: true });
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.setClearColor(0x87ceeb);
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        document.body.appendChild(this.renderer.domElement);
        
        // Lighting
        this.sun = new THREE.DirectionalLight(0xffffff, 1);
        this.sun.position.set(50, 100, 50);
        this.sun.castShadow = true;
        this.sun.shadow.mapSize.width = 2048;
        this.sun.shadow.mapSize.height = 2048;
        this.sun.shadow.camera.near = 0.1;
        this.sun.shadow.camera.far = 500;
        this.sun.shadow.camera.left = -200;
        this.sun.shadow.camera.right = 200;
        this.sun.shadow.camera.top = 200;
        this.sun.shadow.camera.bottom = -200;
        this.scene.add(this.sun);
        
        this.ambientLight = new THREE.AmbientLight(0x404040, 0.3);
        this.scene.add(this.ambientLight);
        
        // Sky
        this.createSky();
        
        // Resize handler
        window.addEventListener('resize', () => {
            this.camera.aspect = window.innerWidth / window.innerHeight;
            this.camera.updateProjectionMatrix();
            this.renderer.setSize(window.innerWidth, window.innerHeight);
        });
    }

    createSky() {
        const skyGeometry = new THREE.SphereGeometry(1500, 32, 32);
        const skyVertices = skyGeometry.attributes.position.array;
        const colors = new Float32Array(skyVertices.length);
        
        // Create triangular pattern for low-poly sky and gradient colors
        for (let i = 0; i < skyVertices.length; i += 3) {
            const offset = (Math.random() - 0.5) * 50;
            skyVertices[i] += offset;
            skyVertices[i + 1] += offset;
            skyVertices[i + 2] += offset;
            
            // Create gradient based on height (y position)
            const y = skyVertices[i + 1];
            const normalizedY = (y + 1500) / 3000; // Normalize to 0-1 with larger range
            
            // Sky blue to lighter blue gradient
            const topColor = new THREE.Color(0x87ceeb); // Sky blue
            const bottomColor = new THREE.Color(0xe0f6ff); // Light blue
            const gradientColor = topColor.clone().lerp(bottomColor, normalizedY);
            
            colors[i] = gradientColor.r;
            colors[i + 1] = gradientColor.g;
            colors[i + 2] = gradientColor.b;
        }
        
        skyGeometry.attributes.position.needsUpdate = true;
        skyGeometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
        skyGeometry.computeVertexNormals();
        
        const skyMaterial = new THREE.MeshBasicMaterial({
            vertexColors: true,
            side: THREE.BackSide,
            depthWrite: false // Prevent z-buffer issues
        });
        
        this.sky = new THREE.Mesh(skyGeometry, skyMaterial);
        this.sky.renderOrder = -1; // Render sky first
        this.scene.add(this.sky);
        
        // Add clouds
        this.createClouds();
    }

    createClouds() {
        // Initialize clouds group (now used for tracking all clouds)
        this.clouds = new THREE.Group();
        this.scene.add(this.clouds);
    }

    addChunkClouds(chunk, worldX, worldZ) {
        // Add 1-3 clouds per chunk randomly
        const cloudCount = Math.floor(Math.random() * 3) + 1;
        
        for (let i = 0; i < cloudCount; i++) {
            // Random chance to add a cloud (so not every chunk has clouds)
            if (Math.random() < 0.3) {
                const cloud = this.createSingleCloud();
                
                // Position cloud within chunk boundaries
                cloud.position.set(
                    worldX + (Math.random() - 0.5) * this.chunkSize,
                    Math.random() * 100 + 80, // Height between 80-180
                    worldZ + (Math.random() - 0.5) * this.chunkSize
                );
                
                chunk.add(cloud);
            }
        }
    }

    createSingleCloud() {
        const cloudGeometry = new THREE.BoxGeometry(
            Math.random() * 30 + 20,
            Math.random() * 10 + 5,
            Math.random() * 20 + 10
        );
        
        // Make clouds jagged
        const vertices = cloudGeometry.attributes.position.array;
        for (let j = 0; j < vertices.length; j += 3) {
            vertices[j] += (Math.random() - 0.5) * 5;
            vertices[j + 1] += (Math.random() - 0.5) * 3;
            vertices[j + 2] += (Math.random() - 0.5) * 5;
        }
        cloudGeometry.attributes.position.needsUpdate = true;
        
        const cloudMaterial = new THREE.MeshLambertMaterial({ 
            color: 0xffffff,
            transparent: true,
            opacity: 0.8
        });
        
        const cloud = new THREE.Mesh(cloudGeometry, cloudMaterial);
        cloud.userData.speed = Math.random() * 0.1 + 0.05;
        
        return cloud;
    }

    createAirplane() {
        this.airplane = new THREE.Group();
        
        // Fuselage (body)
        const fuselageGeometry = new THREE.CylinderGeometry(0.5, 1, 8, 6);
        const fuselageMaterial = new THREE.MeshLambertMaterial({ color: 0x0066cc });
        const fuselage = new THREE.Mesh(fuselageGeometry, fuselageMaterial);
        fuselage.rotation.z = Math.PI / 2;
        fuselage.castShadow = true;
        this.airplane.add(fuselage);
        
        // Wings
        const wingGeometry = new THREE.BoxGeometry(12, 0.3, 3);
        const wingMaterial = new THREE.MeshLambertMaterial({ color: 0x004499 });
        const leftWing = new THREE.Mesh(wingGeometry, wingMaterial);
        leftWing.position.set(0, -0.5, -1);
        leftWing.castShadow = true;
        this.airplane.add(leftWing);
        
        const rightWing = new THREE.Mesh(wingGeometry, wingMaterial);
        rightWing.position.set(0, -0.5, 1);
        rightWing.castShadow = true;
        this.airplane.add(rightWing);
        
        // Tail
        const tailGeometry = new THREE.BoxGeometry(2, 3, 0.3);
        const tailMaterial = new THREE.MeshLambertMaterial({ color: 0x004499 });
        const tail = new THREE.Mesh(tailGeometry, tailMaterial);
        tail.position.set(-3, 1, 0);
        tail.castShadow = true;
        this.airplane.add(tail);
        
        // Propeller
        const propGeometry = new THREE.BoxGeometry(0.1, 4, 0.1);
        const propMaterial = new THREE.MeshLambertMaterial({ color: 0x333333 });
        this.propeller = new THREE.Mesh(propGeometry, propMaterial);
        this.propeller.position.set(4, 0, 0);
        this.airplane.add(this.propeller);
        
        // Particle system for exhaust
        this.createExhaustParticles();
        
        // Position airplane
        this.airplane.position.set(0, 200, 0);
        this.scene.add(this.airplane);
    }

    createExhaustParticles() {
        const particleCount = 50;
        const particles = new THREE.BufferGeometry();
        const positions = new Float32Array(particleCount * 3);
        const colors = new Float32Array(particleCount * 3);
        
        for (let i = 0; i < particleCount; i++) {
            positions[i * 3] = 0;
            positions[i * 3 + 1] = 0;
            positions[i * 3 + 2] = 0;
            
            colors[i * 3] = 0.5 + Math.random() * 0.5;
            colors[i * 3 + 1] = 0.5 + Math.random() * 0.5;
            colors[i * 3 + 2] = 0.5 + Math.random() * 0.5;
        }
        
        particles.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        particles.setAttribute('color', new THREE.BufferAttribute(colors, 3));
        
        const particleMaterial = new THREE.PointsMaterial({
            size: 2,
            vertexColors: true,
            transparent: true,
            opacity: 0.6
        });
        
        this.exhaustParticles = new THREE.Points(particles, particleMaterial);
        this.exhaustParticles.position.set(-4, 0, 0);
        this.airplane.add(this.exhaustParticles);
        
        this.particles = [];
        for (let i = 0; i < particleCount; i++) {
            this.particles.push({
                position: new THREE.Vector3(),
                velocity: new THREE.Vector3(),
                life: 0
            });
        }
    }

    setupTerrain() {
        // Generate initial chunks around spawn point
        for (let x = -this.viewDistance; x <= this.viewDistance; x++) {
            for (let z = -this.viewDistance; z <= this.viewDistance; z++) {
                this.generateChunk(x, z);
            }
        }
    }

    generateChunk(chunkX, chunkZ) {
        const key = `${chunkX},${chunkZ}`;
        if (this.chunks.has(key)) return;
        
        const chunk = new THREE.Group();
        // Position chunks so their vertices align with a global grid
        // Instead of centering chunks, position them so vertices are at integer coordinates
        const worldX = chunkX * this.chunkSize;
        const worldZ = chunkZ * this.chunkSize;
        
        // Generate terrain - reverted to simpler approach
        const resolution = 64;
        const terrainGeometry = new THREE.PlaneGeometry(this.chunkSize, this.chunkSize, resolution, resolution);
        const vertices = terrainGeometry.attributes.position.array;
        const colors = new Float32Array((vertices.length / 3) * 3);
        
        for (let i = 0; i < vertices.length; i += 3) {
            // Use exact world coordinates for consistent terrain generation
            const localX = vertices[i];
            const localZ = vertices[i + 1];
            
            // Round coordinates to ensure consistent sampling across chunks
            const worldCoordX = Math.round((worldX + localX) * 100) / 100;
            const worldCoordZ = Math.round((worldZ + localZ) * 100) / 100;
            
            // Get terrain height using world coordinates
            const height = this.getTerrainHeight(worldCoordX, worldCoordZ);
            vertices[i + 2] = height;
            
            // Determine biome for this specific vertex using noise
            const biome = this.getBiomeAtPosition(worldCoordX, worldCoordZ);
            
            // Set color based on biome
            const color = new THREE.Color(biome.color);
            const vertexIndex = i / 3;
            colors[vertexIndex * 3] = color.r;
            colors[vertexIndex * 3 + 1] = color.g;
            colors[vertexIndex * 3 + 2] = color.b;
        }
        
        terrainGeometry.attributes.position.needsUpdate = true;
        terrainGeometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
        terrainGeometry.computeVertexNormals();
        
        const terrainMaterial = new THREE.MeshLambertMaterial({ 
            vertexColors: true,
            flatShading: false, // Use smooth shading to reduce visible seams
            wireframe: false
        });
        
        const terrain = new THREE.Mesh(terrainGeometry, terrainMaterial);
        terrain.rotation.x = -Math.PI / 2;
        terrain.position.set(worldX, 0, worldZ);
        terrain.receiveShadow = true;
        chunk.add(terrain);
        
        // Add features based on dominant biome in chunk center
        const centerBiome = this.getBiomeAtPosition(worldX, worldZ);
        this.addChunkFeatures(chunk, worldX, worldZ, centerBiome);
        
        // Add clouds to this chunk
        this.addChunkClouds(chunk, worldX, worldZ);
        
        chunk.position.set(0, 0, 0);
        this.scene.add(chunk);
        this.chunks.set(key, chunk);
    }

    getBiomeAtPosition(x, z) {
        if (!this.noise) return this.biomes[0];
        
        try {
            // TESTING: Make biome scale extremely huge to test if biomes cause terrain holes
            const primaryNoise = this.noise(x * 0.00001, z * 0.00001); // Extremely large biome areas (10x larger)
            const secondaryNoise = this.noise(x * 0.00003, z * 0.00003) * 0.3; // Secondary variation
            const combinedNoise = primaryNoise + secondaryNoise;
            
            const biomeIndex = Math.floor((combinedNoise + 1) * 0.5 * this.biomes.length);
            return this.biomes[Math.min(Math.max(biomeIndex, 0), this.biomes.length - 1)];
        } catch (e) {
            console.warn('Biome generation error:', e);
            return this.biomes[0];
        }
    }

    getTerrainHeight(x, z) {
        if (!this.noise) return 0;
        try {
            // Macro-scale terrain (large hills and valleys) - much larger scale
            const macroScale = this.noise(x * 0.0008, z * 0.0008) * 80; // Much larger scale, increased amplitude
            
            // Micro-scale terrain (brought back for detail)
            const microScale = this.noise(x * 0.01, z * 0.01) * 25 +
                               this.noise(x * 0.03, z * 0.03) * 12 +
                               this.noise(x * 0.08, z * 0.08) * 6;
            
            return macroScale + microScale;
        } catch (e) {
            console.warn('Noise function error:', e);
            return 0;
        }
    }

    addChunkFeatures(chunk, worldX, worldZ, biome) {
        // Add trees
        for (let i = 0; i < 20; i++) {
            if (Math.random() < biome.treeChance) {
                const tree = this.createTree();
                const x = (Math.random() - 0.5) * this.chunkSize + worldX;
                const z = (Math.random() - 0.5) * this.chunkSize + worldZ;
                const y = this.getTerrainHeight(x, z);
                tree.position.set(x, y, z);
                chunk.add(tree);
            }
        }
        
        // Add houses (rare)
        if (Math.random() < 0.1) {
            const house = this.createHouse();
            const x = (Math.random() - 0.5) * this.chunkSize * 0.5 + worldX;
            const z = (Math.random() - 0.5) * this.chunkSize * 0.5 + worldZ;
            const y = this.getTerrainHeight(x, z);
            house.position.set(x, y, z);
            chunk.add(house);
        }
        
        // Add rocks
        for (let i = 0; i < 5; i++) {
            if (Math.random() < 0.3) {
                const rock = this.createRock();
                const x = (Math.random() - 0.5) * this.chunkSize + worldX;
                const z = (Math.random() - 0.5) * this.chunkSize + worldZ;
                const y = this.getTerrainHeight(x, z);
                rock.position.set(x, y, z);
                chunk.add(rock);
            }
        }
    }

    createTree() {
        const tree = new THREE.Group();
        
        // Trunk
        const trunkGeometry = new THREE.CylinderGeometry(0.5, 0.8, 8, 6);
        const trunkMaterial = new THREE.MeshLambertMaterial({ color: 0x8b4513 });
        const trunk = new THREE.Mesh(trunkGeometry, trunkMaterial);
        trunk.position.y = 4;
        trunk.castShadow = true;
        tree.add(trunk);
        
        // Leaves
        const leavesGeometry = new THREE.ConeGeometry(4, 6, 8);
        const leavesMaterial = new THREE.MeshLambertMaterial({ color: 0x228b22 });
        const leaves = new THREE.Mesh(leavesGeometry, leavesMaterial);
        leaves.position.y = 10;
        leaves.castShadow = true;
        tree.add(leaves);
        
        return tree;
    }

    createHouse() {
        const house = new THREE.Group();
        
        // Base
        const baseGeometry = new THREE.BoxGeometry(8, 6, 8);
        const baseMaterial = new THREE.MeshLambertMaterial({ color: 0xd2691e });
        const base = new THREE.Mesh(baseGeometry, baseMaterial);
        base.position.y = 3;
        base.castShadow = true;
        house.add(base);
        
        // Roof
        const roofGeometry = new THREE.ConeGeometry(6, 4, 4);
        const roofMaterial = new THREE.MeshLambertMaterial({ color: 0x8b0000 });
        const roof = new THREE.Mesh(roofGeometry, roofMaterial);
        roof.position.y = 8;
        roof.rotation.y = Math.PI / 4;
        roof.castShadow = true;
        house.add(roof);
        
        return house;
    }

    createRock() {
        const rockGeometry = new THREE.DodecahedronGeometry(Math.random() * 2 + 1);
        const vertices = rockGeometry.attributes.position.array;
        
        // Make rocks jagged
        for (let i = 0; i < vertices.length; i += 3) {
            vertices[i] += (Math.random() - 0.5) * 0.5;
            vertices[i + 1] += (Math.random() - 0.5) * 0.5;
            vertices[i + 2] += (Math.random() - 0.5) * 0.5;
        }
        rockGeometry.attributes.position.needsUpdate = true;
        
        const rockMaterial = new THREE.MeshLambertMaterial({ 
            color: 0x696969,
            flatShading: true
        });
        const rock = new THREE.Mesh(rockGeometry, rockMaterial);
        rock.castShadow = true;
        return rock;
    }

    setupControls() {
        // Keyboard events
        document.addEventListener('keydown', (event) => {
            this.keys[event.code] = true;
            
            // Special keys
            if (event.code === 'KeyF') {
                this.toggleCamera();
            } else if (event.code === 'KeyR') {
                this.resetPlane();
            } else if (event.code === 'Escape') {
                this.togglePause();
            }
        });
        
        document.addEventListener('keyup', (event) => {
            this.keys[event.code] = false;
        });
        
        // Mouse events
        document.addEventListener('mousemove', (event) => {
            if (!this.paused) {
                this.mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
                this.mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
            }
        });
        
        // Pointer lock for better mouse control
        document.addEventListener('click', () => {
            // Initialize audio on first click
            this.initAudio();
            
            if (!this.paused) {
                document.body.requestPointerLock();
            }
        });
        
        // Also try to initialize audio on any key press
        document.addEventListener('keydown', (event) => {
            if (!this.audioInitialized) {
                this.initAudio();
            }
        });
    }

    setupUI() {
        this.createSpeedometer();
        this.updateUI();
    }

    createSpeedometer() {
        const canvas = document.createElement('canvas');
        canvas.width = 240;
        canvas.height = 240;
        canvas.style.position = 'absolute';
        canvas.style.bottom = '20px';
        canvas.style.right = '20px';
        canvas.style.width = '120px';
        canvas.style.height = '120px';
        canvas.style.pointerEvents = 'none';
        
        document.body.appendChild(canvas);
        this.speedometerCanvas = canvas;
        this.speedometerCtx = canvas.getContext('2d');
    }

    updateSpeedometer() {
        const ctx = this.speedometerCtx;
        const canvas = this.speedometerCanvas;
        
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        // Background circle
        ctx.beginPath();
        ctx.arc(120, 120, 100, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
        ctx.fill();
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 3;
        ctx.stroke();
        
        // Speed marks
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 2;
        for (let i = 0; i <= 10; i++) {
            const angle = (i / 10) * Math.PI * 1.5 - Math.PI * 0.75;
            const x1 = 120 + Math.cos(angle) * 85;
            const y1 = 120 + Math.sin(angle) * 85;
            const x2 = 120 + Math.cos(angle) * 95;
            const y2 = 120 + Math.sin(angle) * 95;
            
            ctx.beginPath();
            ctx.moveTo(x1, y1);
            ctx.lineTo(x2, y2);
            ctx.stroke();
        }
        
        // Speed needle
        const speedRatio = Math.min(this.speed / 50, 1);
        const needleAngle = speedRatio * Math.PI * 1.5 - Math.PI * 0.75;
        const needleX = 120 + Math.cos(needleAngle) * 80;
        const needleY = 120 + Math.sin(needleAngle) * 80;
        
        ctx.beginPath();
        ctx.moveTo(120, 120);
        ctx.lineTo(needleX, needleY);
        ctx.strokeStyle = '#ff4444';
        ctx.lineWidth = 4;
        ctx.stroke();
        
        // Center dot
        ctx.beginPath();
        ctx.arc(120, 120, 5, 0, Math.PI * 2);
        ctx.fillStyle = '#fff';
        ctx.fill();
        
        // Speed text
        ctx.fillStyle = '#fff';
        ctx.font = '20px Arial';
        ctx.textAlign = 'center';
        ctx.fillText(Math.round(this.speed), 120, 180);
    }

    setupAudio() {
        // Create audio context (will be initialized on first user interaction)
        this.audioContext = null;
        this.motorGain = null;
        this.motorOscillator = null;
        this.audioInitialized = false;
    }

    initAudio() {
        if (this.audioContext || this.audioInitialized) return;
        
        try {
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
            this.motorGain = this.audioContext.createGain();
            this.motorGain.connect(this.audioContext.destination);
            this.motorGain.gain.setValueAtTime(0, this.audioContext.currentTime);
            this.audioInitialized = true;
            console.log('Audio initialized successfully');
        } catch (e) {
            console.warn('Web Audio API not supported:', e);
            this.audioInitialized = false;
        }
    }

    stopAllAudio() {
        if (this.motorOscillator) {
            try {
                this.motorOscillator.stop();
            } catch (e) {
                // Oscillator might already be stopped
            }
            this.motorOscillator = null;
        }
        
        if (this.motorGain && this.audioContext) {
            this.motorGain.gain.setValueAtTime(0, this.audioContext.currentTime);
        }
        
        // Clear any pending audio creation
        this.audioCreationPending = false;
    }

    updateAudio() {
        if (!this.audioContext || !this.soundEnabled || this.crashed || this.audioCreationPending) return;
        
        // Resume audio context if suspended (required by some browsers)
        if (this.audioContext.state === 'suspended') {
            this.audioContext.resume();
        }
        
        // Create simple motor sound with much lower frequency range and reduced speed impact
        const baseFrequency = 40; // Much lower base frequency for deeper plane sound
        const frequency = baseFrequency + this.thrust * 60 + this.speed * 0.3; // Dramatically reduced speed impact
        const volume = Math.max(0.02, 0.05 + this.thrust * 0.15); // Lower volume range
        
        // Only create oscillator if one doesn't exist and we're not in a problematic state
        if (!this.motorOscillator && this.audioContext && !this.audioCreationPending) {
            this.audioCreationPending = true;
            try {
                this.motorOscillator = this.audioContext.createOscillator();
                this.motorOscillator.type = 'sawtooth';
                this.motorOscillator.frequency.setValueAtTime(frequency, this.audioContext.currentTime);
                this.motorOscillator.connect(this.motorGain);
                this.motorOscillator.start();
                
                // Handle oscillator end - don't immediately recreate
                this.motorOscillator.onended = () => {
                    this.motorOscillator = null;
                    this.audioCreationPending = false;
                };
                
                this.audioCreationPending = false;
                console.log('Motor sound started');
            } catch (e) {
                console.warn('Failed to create motor sound:', e);
                this.audioCreationPending = false;
            }
        }
        
        // Update frequency and volume of existing oscillator
        if (this.motorOscillator && this.motorGain) {
            try {
                this.motorOscillator.frequency.setValueAtTime(frequency, this.audioContext.currentTime);
                this.motorGain.gain.setValueAtTime(volume, this.audioContext.currentTime);
            } catch (e) {
                console.warn('Failed to update motor sound:', e);
                // Don't immediately recreate - let it settle
                this.motorOscillator = null;
            }
        }
    }

    updateControls() {
        if (this.paused || this.crashed) return;
        
        const pitchSpeed = 0.02;
        const yawSpeed = 0.03;
        const rollSpeed = 0.05;
        
        // Pitch (W/S)
        if (this.keys['KeyW']) {
            this.airplane.rotation.x -= pitchSpeed;
        }
        if (this.keys['KeyS']) {
            this.airplane.rotation.x += pitchSpeed;
        }
        
        // Yaw (A/D)
        if (this.keys['KeyA']) {
            this.airplane.rotation.y += yawSpeed;
        }
        if (this.keys['KeyD']) {
            this.airplane.rotation.y -= yawSpeed;
        }
        
        // Roll (Q/E)
        if (this.keys['KeyQ']) {
            this.airplane.rotation.z += rollSpeed;
        }
        if (this.keys['KeyE']) {
            this.airplane.rotation.z -= rollSpeed;
        }
        
        // Throttle (Shift)
        if (this.keys['ShiftLeft'] || this.keys['ShiftRight']) {
            this.thrust = Math.min(this.thrust + 0.005, this.maxThrust); // Reduced from 0.02
        } else {
            this.thrust = Math.max(this.thrust - 0.002, 0); // Reduced from 0.01
        }
        
        // Mouse look (subtle influence)
        this.airplane.rotation.y += this.mouse.x * 0.01;
        this.airplane.rotation.x += this.mouse.y * 0.01;
        
        // Propeller spin
        if (this.propeller) {
            this.propeller.rotation.x += (0.5 + this.thrust * 2);
        }
    }

    updatePhysics() {
        if (this.paused || this.crashed) return;
        
        // Calculate forward direction
        const forward = new THREE.Vector3(1, 0, 0);
        forward.applyQuaternion(this.airplane.quaternion);
        
        // Apply thrust
        this.acceleration.copy(forward).multiplyScalar(this.thrust);
        
        // Apply gravity
        this.acceleration.y += this.gravity;
        
        // Apply drag
        this.velocity.multiplyScalar(this.drag);
        
        // Update velocity
        this.velocity.add(this.acceleration);
        
        // Update position
        this.airplane.position.add(this.velocity);
        
        // Calculate speed and altitude
        this.speed = this.velocity.length() * 100;
        this.altitude = Math.max(0, this.airplane.position.y);
        
        // Collision detection
        this.checkCollisions();
        
        // Update exhaust particles
        this.updateExhaustParticles();
    }

    checkCollisions() {
        const terrainHeight = this.getTerrainHeight(
            this.airplane.position.x,
            this.airplane.position.z
        );
        
        const groundClearance = this.airplane.position.y - terrainHeight;
        
        // Grazing effect
        if (groundClearance < 5 && groundClearance > 0) {
            this.cameraShake.intensity = 0.5;
            this.cameraShake.duration = 10;
        }
        
        // Fast descent shake
        if (this.velocity.y < -2) {
            this.cameraShake.intensity = Math.abs(this.velocity.y) * 0.3;
            this.cameraShake.duration = 5;
        }
        
        // Crash detection
        if (groundClearance <= 0 && this.velocity.length() > 0.3) {
            this.crash();
        } else if (groundClearance <= 0) {
            // Soft landing
            this.airplane.position.y = terrainHeight + 0.5;
            this.velocity.y = 0;
        }
    }

    crash() {
        this.crashed = true;
        this.cameraShake.intensity = 5;
        this.cameraShake.duration = 60;
        
        // Create explosion particles
        this.createExplosion();
        
        // Play explosion sound
        this.playExplosionSound();
        
        // Stop motor sounds
        this.stopAllAudio();
        
        // Show reset prompt (with timeout ID to cancel if reset is pressed)
        this.crashTimeout = setTimeout(() => {
            if (this.crashed) { // Only show message if still crashed
                const crashMessage = document.getElementById('crash-message');
                if (crashMessage) {
                    crashMessage.style.display = 'block';
                }
            }
        }, 1000);
    }

    playExplosionSound() {
        if (!this.audioContext || !this.soundEnabled) return;
        
        try {
            // Create a short burst of noise for explosion effect
            const explosionGain = this.audioContext.createGain();
            explosionGain.connect(this.audioContext.destination);
            
            // Create white noise for explosion
            const bufferSize = this.audioContext.sampleRate * 0.5; // 0.5 second
            const buffer = this.audioContext.createBuffer(1, bufferSize, this.audioContext.sampleRate);
            const output = buffer.getChannelData(0);
            
            for (let i = 0; i < bufferSize; i++) {
                output[i] = Math.random() * 2 - 1;
            }
            
            const explosionSource = this.audioContext.createBufferSource();
            explosionSource.buffer = buffer;
            explosionSource.connect(explosionGain);
            
            // Envelope for explosion sound
            const currentTime = this.audioContext.currentTime;
            explosionGain.gain.setValueAtTime(0, currentTime);
            explosionGain.gain.linearRampToValueAtTime(0.3, currentTime + 0.01);
            explosionGain.gain.exponentialRampToValueAtTime(0.01, currentTime + 0.5);
            
            explosionSource.start(currentTime);
            explosionSource.stop(currentTime + 0.5);
            
            console.log('Explosion sound played');
        } catch (e) {
            console.warn('Failed to play explosion sound:', e);
        }
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
        this.explosion.position.copy(this.airplane.position);
        this.scene.add(this.explosion);
        
        // Remove explosion after a while
        this.explosionTimeout = setTimeout(() => {
            if (this.explosion) {
                this.scene.remove(this.explosion);
                this.explosion = null;
            }
        }, 3000);
    }

    updateExhaustParticles() {
        if (!this.exhaustParticles) return;
        
        const positions = this.exhaustParticles.geometry.attributes.position.array;
        
        for (let i = 0; i < this.particles.length; i++) {
            const particle = this.particles[i];
            
            if (particle.life <= 0) {
                // Respawn particle
                particle.position.set(0, 0, 0);
                particle.velocity.set(
                    (Math.random() - 0.5) * 0.5 - this.thrust * 2,
                    (Math.random() - 0.5) * 0.2,
                    (Math.random() - 0.5) * 0.2
                );
                particle.life = 1;
            }
            
            // Update particle
            particle.position.add(particle.velocity);
            particle.life -= 0.02;
            
            // Update position in buffer
            positions[i * 3] = particle.position.x;
            positions[i * 3 + 1] = particle.position.y;
            positions[i * 3 + 2] = particle.position.z;
        }
        
        this.exhaustParticles.geometry.attributes.position.needsUpdate = true;
        
        // Show/hide based on thrust
        this.exhaustParticles.visible = this.thrust > 0.1;
    }

    updateCamera() {
        let targetPosition, targetLookAt;
        
        if (this.firstPerson) {
            // First person view
            targetPosition = this.airplane.position.clone();
            targetPosition.add(new THREE.Vector3(2, 1, 0).applyQuaternion(this.airplane.quaternion));
            
            targetLookAt = this.airplane.position.clone();
            targetLookAt.add(new THREE.Vector3(10, 0, 0).applyQuaternion(this.airplane.quaternion));
        } else {
            // Third person view
            const offset = new THREE.Vector3(-20, 8, 0);
            offset.applyQuaternion(this.airplane.quaternion);
            
            targetPosition = this.airplane.position.clone().add(offset);
            targetLookAt = this.airplane.position.clone();
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

    updateTerrain() {
        const playerChunkX = Math.floor(this.airplane.position.x / this.chunkSize);
        const playerChunkZ = Math.floor(this.airplane.position.z / this.chunkSize);
        
        // Generate new chunks
        for (let x = playerChunkX - this.viewDistance; x <= playerChunkX + this.viewDistance; x++) {
            for (let z = playerChunkZ - this.viewDistance; z <= playerChunkZ + this.viewDistance; z++) {
                this.generateChunk(x, z);
            }
        }
        
        // Remove distant chunks
        for (const [key, chunk] of this.chunks) {
            const [chunkX, chunkZ] = key.split(',').map(Number);
            const distance = Math.max(Math.abs(chunkX - playerChunkX), Math.abs(chunkZ - playerChunkZ));
            
            if (distance > this.viewDistance + 1) {
                this.scene.remove(chunk);
                this.chunks.delete(key);
            }
        }
    }

    updateBiome() {
        if (!this.noise) return;
        
        try {
            this.currentBiome = this.getBiomeAtPosition(this.airplane.position.x, this.airplane.position.z);
            
            const biomeDisplay = document.getElementById('biome-display');
            if (biomeDisplay) {
                biomeDisplay.textContent = this.currentBiome.name;
            }
        } catch (e) {
            console.warn('Biome update error:', e);
        }
    }

    updateDayNightCycle() {
        this.timeOfDay += this.daySpeed;
        if (this.timeOfDay > 1) this.timeOfDay = 0;
        
        // Update sun position
        const sunAngle = this.timeOfDay * Math.PI * 2;
        this.sun.position.set(
            Math.cos(sunAngle) * 200,
            Math.sin(sunAngle) * 200,
            50
        );
        
        // Update lighting - brighter night
        const dayIntensity = Math.max(0.5, Math.sin(sunAngle)); // Increased minimum from 0.3 to 0.5
        this.sun.intensity = dayIntensity;
        
        // Update sky color - brighter night colors
        const morning = new THREE.Color(0xff7f50);
        const noon = new THREE.Color(0x87ceeb);
        const evening = new THREE.Color(0x4b0082);
        const night = new THREE.Color(0x2f4f7f); // Brighter night color (was 0x191970)
        
        let skyColor;
        if (this.timeOfDay < 0.25) {
            skyColor = night.clone().lerp(morning, this.timeOfDay * 4);
        } else if (this.timeOfDay < 0.5) {
            skyColor = morning.clone().lerp(noon, (this.timeOfDay - 0.25) * 4);
        } else if (this.timeOfDay < 0.75) {
            skyColor = noon.clone().lerp(evening, (this.timeOfDay - 0.5) * 4);
        } else {
            skyColor = evening.clone().lerp(night, (this.timeOfDay - 0.75) * 4);
        }
        
        this.renderer.setClearColor(skyColor);
        this.scene.fog.color = skyColor;
    }


    updateClouds() {
        // Update sky position to follow player (prevent visible seams)
        if (this.sky && this.airplane) {
            this.sky.position.copy(this.airplane.position);
        }
        
        // Clouds now move with chunks and are generated procedurally
        // No need to update individual cloud positions
    }

    updateUI() {
        // Update speedometer
        this.updateSpeedometer();
        
        // Update altimeter
        const altitudeIndicator = document.getElementById('altitude-indicator');
        const altitudePercent = Math.min(this.altitude / 200, 1);
        altitudeIndicator.style.bottom = `${10 + altitudePercent * 160}px`;
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
        const crashMessage = document.getElementById('crash-message');
        if (crashMessage) {
            crashMessage.style.display = 'none';
        }
        
        // Remove explosion particles immediately
        if (this.explosion) {
            this.scene.remove(this.explosion);
            this.explosion = null;
        }
        if (this.explosionTimeout) {
            clearTimeout(this.explosionTimeout);
            this.explosionTimeout = null;
        }
        
        this.crashed = false;
        this.airplane.position.set(0, 200, 0);
        this.airplane.rotation.set(0, 0, 0);
        this.velocity.set(0, 0, 0);
        this.acceleration.set(0, 0, 0);
        this.thrust = 0;
        this.speed = 0;
        this.cameraShake.intensity = 0;
        this.cameraShake.duration = 0;
        
        // Stop all sounds and restart
        this.stopAllAudio();
    }

    togglePause() {
        this.paused = !this.paused;
        const pauseMenu = document.getElementById('pause-menu');
        pauseMenu.style.display = this.paused ? 'block' : 'none';
        
        if (this.paused) {
            document.exitPointerLock();
        }
    }

    animate() {
        requestAnimationFrame(() => this.animate());
        
        if (!this.paused) {
            this.updateControls();
            this.updatePhysics();
            this.updateCamera();
            this.updateTerrain();
            this.updateBiome();
            this.updateDayNightCycle();
            this.updateClouds();
            this.updateAudio();
            this.updateUI();
        }
        
        this.renderer.render(this.scene, this.camera);
    }
}

// Global functions for UI
function togglePause() {
    if (window.game) {
        window.game.togglePause();
    }
}

function toggleSound() {
    if (window.game) {
        window.game.soundEnabled = !window.game.soundEnabled;
        if (!window.game.soundEnabled && window.game.motorOscillator) {
            window.game.motorOscillator.stop();
            window.game.motorOscillator = null;
        }
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

// Handle pointer lock
document.addEventListener('pointerlockchange', () => {
    if (document.pointerLockElement) {
        document.addEventListener('mousemove', handleMouseMove);
    } else {
        document.removeEventListener('mousemove', handleMouseMove);
    }
});

function handleMouseMove(event) {
    if (window.game && !window.game.paused) {
        window.game.mouse.x += event.movementX * 0.001;
        window.game.mouse.y -= event.movementY * 0.001;
        
        // Clamp mouse values
        window.game.mouse.x = Math.max(-1, Math.min(1, window.game.mouse.x));
        window.game.mouse.y = Math.max(-1, Math.min(1, window.game.mouse.y));
    }
}