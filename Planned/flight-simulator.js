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
    }

    setupScene() {
        // Scene with enhanced atmospheric fog
        this.scene = new THREE.Scene();
        this.scene.fog = new THREE.FogExp2(0x87ceeb, 0.0015); // Increased fog density to hide pop-in
        
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
        
        // Enhanced rendering settings for better visual quality
        this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
        this.renderer.toneMappingExposure = 1.2;
        this.renderer.outputColorSpace = THREE.SRGBColorSpace;
        document.body.appendChild(this.renderer.domElement);
        
        // Enhanced lighting system
        this.sun = new THREE.DirectionalLight(0xfff8dc, 1.5); // Warm white light
        this.sun.position.set(50, 100, 50);
        this.sun.castShadow = true;
        
        // Higher quality shadows
        this.sun.shadow.mapSize.width = 4096; // Increased from 2048
        this.sun.shadow.mapSize.height = 4096;
        this.sun.shadow.camera.near = 0.1;
        this.sun.shadow.camera.far = 800; // Increased range
        this.sun.shadow.camera.left = -400; // Larger shadow area
        this.sun.shadow.camera.right = 400;
        this.sun.shadow.camera.top = 400;
        this.sun.shadow.camera.bottom = -400;
        this.sun.shadow.bias = -0.0001; // Reduce shadow acne
        this.scene.add(this.sun);
        
        // Improved ambient lighting with subtle blue tint for sky reflection
        this.ambientLight = new THREE.AmbientLight(0x87ceeb, 0.4); // Increased intensity
        this.scene.add(this.ambientLight);
        
        // Add hemisphere light for more realistic sky lighting
        this.hemisphereLight = new THREE.HemisphereLight(0x87ceeb, 0x8b7355, 0.3);
        this.scene.add(this.hemisphereLight);
        
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
        
        // Add sun and moon to the sky
        this.createSunMoon();
        
        // Add stars for nighttime
        this.createStars();
    }

    createClouds() {
        // Initialize clouds group (now used for tracking all clouds)
        this.clouds = new THREE.Group();
        this.scene.add(this.clouds);
    }

    createSunMoon() {
        // Create sun - much larger and visible through fog
        const sunGeometry = new THREE.SphereGeometry(25, 16, 16); // Increased from 8 to 25
        const sunMaterial = new THREE.MeshBasicMaterial({
            color: 0xffff00,
            emissive: 0xffff00,
            emissiveIntensity: 0.6, // Increased brightness
            fog: false // Disable fog effect for sun
        });
        this.sunMesh = new THREE.Mesh(sunGeometry, sunMaterial);
        this.scene.add(this.sunMesh);
        
        // Create moon - much larger and visible through fog
        const moonGeometry = new THREE.SphereGeometry(20, 16, 16); // Increased from 6 to 20
        const moonMaterial = new THREE.MeshBasicMaterial({
            color: 0xeeeeee,
            emissive: 0x666666,
            emissiveIntensity: 0.3, // Increased brightness
            fog: false // Disable fog effect for moon
        });
        this.moonMesh = new THREE.Mesh(moonGeometry, moonMaterial);
        this.scene.add(this.moonMesh);
    }

    createStars() {
        // Create star field
        const starGeometry = new THREE.BufferGeometry();
        const starCount = 1000;
        const positions = new Float32Array(starCount * 3);
        
        // Generate random star positions on a sphere
        for (let i = 0; i < starCount; i++) {
            const i3 = i * 3;
            
            // Random spherical coordinates
            const radius = 1200; // Distance from center
            const theta = Math.random() * Math.PI * 2; // Azimuth
            const phi = Math.acos(2 * Math.random() - 1); // Polar angle (uniform distribution)
            
            // Convert to Cartesian coordinates
            positions[i3] = radius * Math.sin(phi) * Math.cos(theta);
            positions[i3 + 1] = radius * Math.cos(phi);
            positions[i3 + 2] = radius * Math.sin(phi) * Math.sin(theta);
        }
        
        starGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        
        const starMaterial = new THREE.PointsMaterial({
            color: 0xffffff,
            size: 2,
            transparent: true,
            opacity: 0.8,
            fog: false // Stars not affected by fog
        });
        
        this.stars = new THREE.Points(starGeometry, starMaterial);
        this.stars.visible = false; // Initially hidden
        this.scene.add(this.stars);
    }

    addChunkClouds(chunk, worldX, worldZ) {
        // Add 1-3 clouds per chunk randomly
        const cloudCount = Math.floor(Math.random() * 3) + 1;
        
        for (let i = 0; i < cloudCount; i++) {
            // Random chance to add a cloud (so not every chunk has clouds)
            if (Math.random() < 0.3) {
                const cloud = this.createSingleCloud();
                
                // Position cloud within chunk boundaries - moved much higher
                cloud.position.set(
                    worldX + (Math.random() - 0.5) * this.chunkSize,
                    Math.random() * 100 + 300, // Height between 300-400 (moved up significantly)
                    worldZ + (Math.random() - 0.5) * this.chunkSize
                );
                
                chunk.add(cloud);
            }
        }
    }

    createSingleCloud() {
        const cloudGroup = new THREE.Group();
        
        // Create multiple spheres to form a cloud clump
        const sphereCount = Math.floor(Math.random() * 8) + 6; // 6-13 spheres per cloud
        
        for (let i = 0; i < sphereCount; i++) {
            // Varying sphere sizes for natural cloud look
            const radius = Math.random() * 8 + 4; // Radius between 4-12
            const sphereGeometry = new THREE.SphereGeometry(radius, 8, 6); // Low poly for performance
            
            // Translucent gray material
            const sphereMaterial = new THREE.MeshLambertMaterial({
                color: new THREE.Color().setHSL(0, 0, 0.7 + Math.random() * 0.2), // Light gray with variation
                transparent: true,
                opacity: 0.4 + Math.random() * 0.3, // Opacity between 0.4-0.7 for natural variation
                fog: true
            });
            
            const sphere = new THREE.Mesh(sphereGeometry, sphereMaterial);
            
            // Position spheres in a roughly cloud-like cluster
            const clusterRadius = 15 + Math.random() * 10; // Cluster within radius 15-25
            const angle = Math.random() * Math.PI * 2;
            const height = (Math.random() - 0.5) * 8; // Vertical spread
            
            sphere.position.set(
                Math.cos(angle) * clusterRadius * Math.random(),
                height,
                Math.sin(angle) * clusterRadius * Math.random()
            );
            
            cloudGroup.add(sphere);
        }
        
        // Add cloud movement properties to the group
        cloudGroup.userData.speed = Math.random() * 0.2 + 0.1; // Faster scrolling
        cloudGroup.userData.direction = Math.random() * Math.PI * 2; // Random direction
        
        return cloudGroup;
    }

    addHighAltitudeClouds(chunk, worldX, worldZ) {
        // Add 2-5 high-altitude clouds per chunk with higher frequency
        const cloudCount = Math.floor(Math.random() * 4) + 2;
        
        for (let i = 0; i < cloudCount; i++) {
            // Higher chance for high-altitude clouds
            if (Math.random() < 0.6) {
                const cloud = this.createHighAltitudeCloud();
                
                // Position cloud within chunk boundaries - much higher
                cloud.position.set(
                    worldX + (Math.random() - 0.5) * this.chunkSize,
                    Math.random() * 150 + 500, // Height between 500-650 (much higher than low clouds)
                    worldZ + (Math.random() - 0.5) * this.chunkSize
                );
                
                chunk.add(cloud);
            }
        }
    }

    createHighAltitudeCloud() {
        const cloudGroup = new THREE.Group();
        
        // Create multiple larger spheres for high-altitude clouds
        const sphereCount = Math.floor(Math.random() * 12) + 8; // 8-19 spheres (more than low clouds)
        
        for (let i = 0; i < sphereCount; i++) {
            // Much larger spheres for high-altitude clouds
            const radius = Math.random() * 25 + 15; // Radius between 15-40 (much larger than 4-12)
            const sphereGeometry = new THREE.SphereGeometry(radius, 8, 6);
            
            // Lighter, more wispy material for high-altitude clouds
            const sphereMaterial = new THREE.MeshLambertMaterial({
                color: new THREE.Color().setHSL(0, 0, 0.85 + Math.random() * 0.1), // Very light gray/white
                transparent: true,
                opacity: 0.3 + Math.random() * 0.2, // Lower opacity (0.3-0.5) for wispy appearance
                fog: true
            });
            
            const sphere = new THREE.Mesh(sphereGeometry, sphereMaterial);
            
            // Position spheres in a much larger cluster for high-altitude clouds
            const clusterRadius = 40 + Math.random() * 30; // Cluster within radius 40-70 (larger than 15-25)
            const angle = Math.random() * Math.PI * 2;
            const height = (Math.random() - 0.5) * 20; // Vertical spread
            
            sphere.position.set(
                Math.cos(angle) * clusterRadius * Math.random(),
                height,
                Math.sin(angle) * clusterRadius * Math.random()
            );
            
            cloudGroup.add(sphere);
        }
        
        // Add movement properties for high-altitude clouds (slower movement)
        cloudGroup.userData.speed = Math.random() * 0.1 + 0.05; // Slower than low clouds
        cloudGroup.userData.direction = Math.random() * Math.PI * 2;
        
        return cloudGroup;
    }

    createWaterTexture() {
        // Create a canvas for the water texture
        const canvas = document.createElement('canvas');
        canvas.width = 256;
        canvas.height = 256;
        const ctx = canvas.getContext('2d');
        
        // Create a procedural water pattern
        const imageData = ctx.createImageData(256, 256);
        const data = imageData.data;
        
        for (let y = 0; y < 256; y++) {
            for (let x = 0; x < 256; x++) {
                const i = (y * 256 + x) * 4;
                
                // Create wave-like pattern using sine waves
                const wave1 = Math.sin((x + y) * 0.02) * 0.3;
                const wave2 = Math.sin(x * 0.03) * Math.sin(y * 0.03) * 0.4;
                const wave3 = Math.sin((x - y) * 0.015) * 0.2;
                const intensity = (wave1 + wave2 + wave3 + 1) * 0.5;
                
                // Blue water color with variation
                data[i] = Math.floor(30 + intensity * 60);     // Red
                data[i + 1] = Math.floor(144 + intensity * 60); // Green  
                data[i + 2] = Math.floor(255 - intensity * 30); // Blue
                data[i + 3] = 255; // Alpha
            }
        }
        
        ctx.putImageData(imageData, 0, 0);
        
        // Create texture from canvas
        this.waterTexture = new THREE.CanvasTexture(canvas);
        this.waterTexture.wrapS = THREE.RepeatWrapping;
        this.waterTexture.wrapT = THREE.RepeatWrapping;
        this.waterTexture.repeat.set(4, 4); // Repeat the texture 4x4 times
    }

    addWaterLayer(chunk, worldX, worldZ) {
        // Always add water to every chunk to prevent square holes
        const waterGeometry = new THREE.PlaneGeometry(this.chunkSize, this.chunkSize);
        waterGeometry.rotateX(-Math.PI / 2); // Make it horizontal
        
        const waterMaterial = new THREE.MeshPhongMaterial({
            map: this.waterTexture, // Use the procedural water texture
            transparent: true,
            opacity: 0.6, // More transparent (reduced from 0.85)
            side: THREE.DoubleSide, // Visible from both sides
            shininess: 100, // High shininess for water reflection
            specular: 0x88ccff, // Light blue specular highlights
            reflectivity: 0.5 // Increased reflectivity for better water appearance
        });
        
        const water = new THREE.Mesh(waterGeometry, waterMaterial);
        water.position.set(worldX, this.waterLevel, worldZ);
        water.userData.isWater = true; // Mark as water for collision detection
        
        chunk.add(water);
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
        
        // Wings - two separate rectangles extending from body
        const wingGeometry = new THREE.BoxGeometry(6, 0.3, 2);
        const wingMaterial = new THREE.MeshLambertMaterial({ color: 0x004499 });
        
        // Left wing extending to the left
        const leftWing = new THREE.Mesh(wingGeometry, wingMaterial);
        leftWing.position.set(0, -0.5, -1.5); // Much closer to body (was -2.5)
        leftWing.castShadow = true;
        this.airplane.add(leftWing);
        
        // Right wing extending to the right  
        const rightWing = new THREE.Mesh(wingGeometry, wingMaterial);
        rightWing.position.set(0, -0.5, 1.5); // Much closer to body (was 2.5)
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
        // Create a group to hold individual particle meshes
        this.exhaustParticles = new THREE.Group();
        this.exhaustParticles.position.set(-4, 0, 0);
        this.airplane.add(this.exhaustParticles);
        
        this.particles = [];
        this.particlePool = [];
        
        // Create geometry and material for square particles
        this.particleGeometry = new THREE.PlaneGeometry(1, 1);
        this.particleMaterial = new THREE.MeshBasicMaterial({
            color: 0x808080, // Grayscale
            transparent: true,
            opacity: 0.7
        });
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
        
        // Generate terrain with proper XZ plane handling (fix for stripe issue)
        const resolution = 64;
        const terrainGeometry = new THREE.PlaneGeometry(this.chunkSize, this.chunkSize, resolution, resolution);
        
        // IMMEDIATELY rotate the geometry so vertices are in X-Z plane, not X-Y
        terrainGeometry.rotateX(-Math.PI / 2);
        
        const vertices = terrainGeometry.attributes.position.array;
        const colors = new Float32Array((vertices.length / 3) * 3);
        
        // Now vertices are properly laid out as: X (east-west), Y (height), Z (north-south)
        for (let i = 0; i < vertices.length; i += 3) {
            const localX = vertices[i];     // X coordinate (east-west)
            const localZ = vertices[i + 2]; // Z coordinate (north-south) - was the issue!
            
            // Round coordinates to ensure consistent sampling across chunks
            const worldCoordX = Math.round((worldX + localX) * 100) / 100;
            const worldCoordZ = Math.round((worldZ + localZ) * 100) / 100;
            
            // Get terrain height using world coordinates
            const height = this.getTerrainHeight(worldCoordX, worldCoordZ);
            vertices[i + 1] = height; // Set Y coordinate (height)
            
            // Get blended biome color for smooth transitions
            const color = this.getBlendedBiomeColor(worldCoordX, worldCoordZ);
            const vertexIndex = i / 3;
            colors[vertexIndex * 3] = color.r;
            colors[vertexIndex * 3 + 1] = color.g;
            colors[vertexIndex * 3 + 2] = color.b;
        }
        
        terrainGeometry.attributes.position.needsUpdate = true;
        terrainGeometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
        terrainGeometry.computeVertexNormals();
        
        const terrainMaterial = new THREE.MeshPhongMaterial({ 
            vertexColors: true,
            flatShading: false, // Use smooth shading to reduce visible seams
            wireframe: false,
            shininess: 10, // Subtle shine for more realistic terrain
            specular: 0x222222 // Dark specular for natural look
        });
        
        const terrain = new THREE.Mesh(terrainGeometry, terrainMaterial);
        // No need to rotate at render time - geometry is already rotated
        terrain.position.set(worldX, 0, worldZ);
        terrain.receiveShadow = true;
        chunk.add(terrain);
        
        // Add features based on dominant biome in chunk center
        const centerBiome = this.getBiomeAtPosition(worldX, worldZ);
        this.addChunkFeatures(chunk, worldX, worldZ, centerBiome);
        
        // Add water layer if needed
        this.addWaterLayer(chunk, worldX, worldZ);
        
        // Add low-level clouds to this chunk
        this.addChunkClouds(chunk, worldX, worldZ);
        
        // Add high-altitude clouds to this chunk
        this.addHighAltitudeClouds(chunk, worldX, worldZ);
        
        chunk.position.set(0, 0, 0);
        this.scene.add(chunk);
        this.chunks.set(key, chunk);
    }

    getBiomeAtPosition(x, z) {
        if (!this.noise) return this.biomes[0];
        
        try {
            // Use multiple noise layers for natural biome transitions - larger scale for bigger biomes
            const primaryNoise = this.noise(x * 0.00005, z * 0.00005); // Main biome regions - much larger
            const secondaryNoise = this.noise(x * 0.0002, z * 0.0002) * 0.4; // Secondary variation
            const tertiaryNoise = this.noise(x * 0.0005, z * 0.0005) * 0.2; // Fine detail
            const combinedNoise = primaryNoise + secondaryNoise + tertiaryNoise;
            
            const biomeIndex = Math.floor((combinedNoise + 1) * 0.5 * this.biomes.length);
            return this.biomes[Math.min(Math.max(biomeIndex, 0), this.biomes.length - 1)];
        } catch (e) {
            console.warn('Biome generation error:', e);
            return this.biomes[0];
        }
    }

    // New function to get blended biome color for smooth transitions
    getBlendedBiomeColor(x, z) {
        if (!this.noise) return new THREE.Color(this.biomes[0].color);
        
        try {
            // Sample multiple nearby biomes for blending
            const sampleDistance = 20; // Distance between samples for blending
            const samples = [
                { pos: [x, z], weight: 1.0 },
                { pos: [x + sampleDistance, z], weight: 0.3 },
                { pos: [x - sampleDistance, z], weight: 0.3 },
                { pos: [x, z + sampleDistance], weight: 0.3 },
                { pos: [x, z - sampleDistance], weight: 0.3 }
            ];
            
            let totalRed = 0, totalGreen = 0, totalBlue = 0, totalWeight = 0;
            
            samples.forEach(sample => {
                const biome = this.getBiomeAtPosition(sample.pos[0], sample.pos[1]);
                const color = new THREE.Color(biome.color);
                totalRed += color.r * sample.weight;
                totalGreen += color.g * sample.weight;
                totalBlue += color.b * sample.weight;
                totalWeight += sample.weight;
            });
            
            return new THREE.Color(
                totalRed / totalWeight,
                totalGreen / totalWeight,
                totalBlue / totalWeight
            );
        } catch (e) {
            console.warn('Biome blending error:', e);
            return new THREE.Color(this.biomes[0].color);
        }
    }

    getTerrainHeight(x, z) {
        if (!this.noise) return 0;
        try {
            // Macro-scale terrain (large mountains and valleys) - Increased amplitude for dramatic landscapes
            const macroScale = this.noise(x * 0.0008, z * 0.0008) * 200; // Increased from 80 to 200 for more dramatic terrain
            
            // Secondary macro layer for additional mountain complexity
            const secondaryMacro = this.noise(x * 0.0012, z * 0.0012) * 120; // Additional large-scale variation
            
            // Micro-scale terrain (surface detail)
            const microScale = this.noise(x * 0.01, z * 0.01) * 25 +
                               this.noise(x * 0.03, z * 0.03) * 12 +
                               this.noise(x * 0.08, z * 0.08) * 6;
            
            return macroScale + secondaryMacro + microScale;
        } catch (e) {
            console.warn('Noise function error:', e);
            return 0;
        }
    }

    addChunkFeatures(chunk, worldX, worldZ, biome) {
        // Add trees - increased count for better coverage
        for (let i = 0; i < 35; i++) {
            if (Math.random() < biome.treeChance) {
                const tree = this.createTree();
                const x = (Math.random() - 0.5) * this.chunkSize + worldX;
                const z = (Math.random() - 0.5) * this.chunkSize + worldZ;
                const y = this.getTerrainHeight(x, z);
                
                // Only place tree if terrain is above water level
                if (y > this.waterLevel + 2) { // Add 2 unit buffer above water
                    tree.position.set(x, y, z);
                    chunk.add(tree);
                }
            }
        }
        
        // Add houses (rare)
        if (Math.random() < 0.1) {
            const house = this.createHouse();
            const x = (Math.random() - 0.5) * this.chunkSize * 0.5 + worldX;
            const z = (Math.random() - 0.5) * this.chunkSize * 0.5 + worldZ;
            const y = this.getTerrainHeight(x, z);
            
            // Only place house if terrain is above water level
            if (y > this.waterLevel + 2) { // Add 2 unit buffer above water
                house.position.set(x, y, z);
                chunk.add(house);
            }
        }
        
        // Add building clusters in certain biomes - increased frequency
        if ((biome.name === 'Plains' || biome.name === 'Coastal') && Math.random() < 0.2) {
            this.addBuildingCluster(chunk, worldX, worldZ);
        }
        
        // Add rocks
        for (let i = 0; i < 5; i++) {
            if (Math.random() < 0.3) {
                const rock = this.createRock();
                const x = (Math.random() - 0.5) * this.chunkSize + worldX;
                const z = (Math.random() - 0.5) * this.chunkSize + worldZ;
                const y = this.getTerrainHeight(x, z);
                
                // Only place rock if terrain is above water level
                if (y > this.waterLevel + 1) { // Add 1 unit buffer above water (rocks can be closer to water)
                    rock.position.set(x, y, z);
                    chunk.add(rock);
                }
            }
        }
    }

    createTree() {
        const tree = new THREE.Group();
        
        // Randomize tree size for variety
        const treeScale = 0.7 + Math.random() * 0.6; // Scale between 0.7 and 1.3
        const trunkHeight = 6 + Math.random() * 4; // Height variation
        
        // Trunk with better material
        const trunkGeometry = new THREE.CylinderGeometry(0.5 * treeScale, 0.8 * treeScale, trunkHeight, 8);
        const trunkMaterial = new THREE.MeshPhongMaterial({ 
            color: new THREE.Color().setHSL(0.08, 0.5, 0.2 + Math.random() * 0.1), // Brown with variation
            shininess: 5,
            specular: 0x111111
        });
        const trunk = new THREE.Mesh(trunkGeometry, trunkMaterial);
        trunk.position.y = trunkHeight / 2;
        trunk.castShadow = true;
        trunk.receiveShadow = true;
        tree.add(trunk);
        
        // Leaves with better material and color variation
        const leavesGeometry = new THREE.ConeGeometry(3 + Math.random() * 2, 5 + Math.random() * 3, 8);
        const leafHue = 0.25 + Math.random() * 0.15; // Green with variation
        const leavesMaterial = new THREE.MeshPhongMaterial({ 
            color: new THREE.Color().setHSL(leafHue, 0.7, 0.3 + Math.random() * 0.2),
            shininess: 20,
            specular: 0x004400
        });
        const leaves = new THREE.Mesh(leavesGeometry, leavesMaterial);
        leaves.position.y = trunkHeight + 2;
        leaves.castShadow = true;
        leaves.receiveShadow = true;
        tree.add(leaves);
        
        // Random rotation for natural placement
        tree.rotation.y = Math.random() * Math.PI * 2;
        
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

    createBuilding() {
        const building = new THREE.Group();
        
        // Randomize building dimensions - slightly reduced from previous large size
        const width = 12 + Math.random() * 16; // 12-28 units wide (reduced from 15-35)
        const depth = 12 + Math.random() * 16; // 12-28 units deep (reduced from 15-35)
        const height = 20 + Math.random() * 30; // 20-50 units tall (reduced from 25-65)
        
        // Base building
        const baseGeometry = new THREE.BoxGeometry(width, height, depth);
        const baseMaterial = new THREE.MeshPhongMaterial({ 
            color: new THREE.Color().setHSL(0, 0, 0.4 + Math.random() * 0.3), // Gray with variation
            shininess: 10
        });
        const base = new THREE.Mesh(baseGeometry, baseMaterial);
        base.position.y = height / 2;
        base.castShadow = true;
        base.receiveShadow = true;
        building.add(base);
        
        // Add some windows (simple dark rectangles)
        const windowCount = Math.floor(height / 4); // One window per 4 units of height
        for (let i = 0; i < windowCount; i++) {
            const windowGeometry = new THREE.BoxGeometry(width * 0.8, 2, 0.1);
            const windowMaterial = new THREE.MeshBasicMaterial({ color: 0x222222 });
            const window = new THREE.Mesh(windowGeometry, windowMaterial);
            window.position.set(0, 3 + i * 4, depth / 2 + 0.05);
            building.add(window);
        }
        
        // Random rotation
        building.rotation.y = Math.random() * Math.PI * 2;
        
        return building;
    }

    addBuildingCluster(chunk, worldX, worldZ) {
        // Create a much larger cluster of 8-15 buildings
        const buildingCount = Math.floor(Math.random() * 8) + 8;
        const clusterCenterX = worldX + (Math.random() - 0.5) * this.chunkSize * 0.6;
        const clusterCenterZ = worldZ + (Math.random() - 0.5) * this.chunkSize * 0.6;
        
        for (let i = 0; i < buildingCount; i++) {
            const building = this.createBuilding();
            
            // Position buildings in a cluster pattern with wider spread
            const angle = Math.random() * Math.PI * 2;
            const distance = Math.random() * 80; // Within 80 units of cluster center (doubled from 40)
            const x = clusterCenterX + Math.cos(angle) * distance;
            const z = clusterCenterZ + Math.sin(angle) * distance;
            const y = this.getTerrainHeight(x, z);
            
            // Only place building if terrain is above water level
            if (y > this.waterLevel + 5) { // Add 5 unit buffer above water for buildings
                building.position.set(x, y, z);
                chunk.add(building);
            }
        }
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
        if (!this.speedometerCtx || !this.speedometerCanvas) return;
        
        const ctx = this.speedometerCtx;
        const canvas = this.speedometerCanvas;
        
        // Clear the canvas completely
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
        
        // Speed needle - fixed calculation
        const maxSpeed = 500; // Maximum speed for full needle sweep
        const currentSpeed = Math.max(0, this.speed); // Ensure non-negative
        const speedRatio = Math.min(currentSpeed / maxSpeed, 1); // Clamp to 0-1
        
        // Calculate needle angle (sweep from -135° to +135°, total 270°)
        const needleAngle = speedRatio * Math.PI * 1.5 - Math.PI * 0.75;
        const needleX = 120 + Math.cos(needleAngle) * 80;
        const needleY = 120 + Math.sin(needleAngle) * 80;
        
        // Draw needle with proper styling
        ctx.beginPath();
        ctx.moveTo(120, 120);
        ctx.lineTo(needleX, needleY);
        ctx.strokeStyle = '#ff4444';
        ctx.lineWidth = 4;
        ctx.lineCap = 'round';
        ctx.stroke();
        
        // Center dot
        ctx.beginPath();
        ctx.arc(120, 120, 5, 0, Math.PI * 2);
        ctx.fillStyle = '#fff';
        ctx.fill();
        
        // Speed text with better formatting
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 20px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(Math.round(currentSpeed), 120, 180);
    }

    setupAudio() {
        // Create audio context (will be initialized on first user interaction)
        this.audioContext = null;
        this.motorGain = null;
        this.motorOscillator = null;
        this.audioInitialized = false;
        this.audioStopped = false;
        this.audioEndedRecently = false;
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
        // Set flag to prevent new oscillator creation
        this.audioStopped = true;
        
        if (this.motorOscillator) {
            try {
                this.motorOscillator.stop();
                this.motorOscillator.disconnect();
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
        
        // Add a small delay before allowing audio to restart
        setTimeout(() => {
            this.audioStopped = false;
        }, 100);
    }

    updateAudio() {
        if (!this.audioContext || !this.soundEnabled || this.crashed || this.audioCreationPending || this.audioStopped) return;
        
        // Resume audio context if suspended (required by some browsers)
        if (this.audioContext.state === 'suspended') {
            this.audioContext.resume();
        }
        
        // Create simple motor sound with much lower frequency range and reduced speed impact
        const baseFrequency = 40; // Much lower base frequency for deeper plane sound
        const frequency = baseFrequency + this.thrust * 60 + this.speed * 0.3; // Dramatically reduced speed impact
        const volume = Math.max(0.02, 0.05 + this.thrust * 0.15); // Lower volume range
        
        // Only create oscillator if one doesn't exist and we're not in a problematic state
        if (!this.motorOscillator && this.audioContext && !this.audioCreationPending && !this.audioEndedRecently) {
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
                    // Add flag to prevent immediate recreation after end
                    this.audioEndedRecently = true;
                    setTimeout(() => {
                        this.audioEndedRecently = false;
                    }, 500);
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
        
        // Check water collision
        const waterClearance = this.airplane.position.y - this.waterLevel;
        
        // Grazing effect (terrain or water)
        if ((groundClearance < 5 && groundClearance > 0) || (waterClearance < 5 && waterClearance > 0 && terrainHeight < this.waterLevel)) {
            this.cameraShake.intensity = 0.5;
            this.cameraShake.duration = 10;
        }
        
        // Fast descent shake
        if (this.velocity.y < -2) {
            this.cameraShake.intensity = Math.abs(this.velocity.y) * 0.3;
            this.cameraShake.duration = 5;
        }
        
        // Water collision detection - crash if hitting water
        if (terrainHeight < this.waterLevel && waterClearance <= 0 && this.velocity.length() > 0.1) {
            this.crash();
            return; // Exit early to avoid terrain collision logic
        }
        
        // Terrain crash detection
        if (groundClearance <= 0 && this.velocity.length() > 0.3) {
            this.crash();
        } else if (groundClearance <= 0) {
            // Soft landing on terrain
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
        
        const isThrusting = this.thrust > 0.01;
        const currentTime = Date.now();
        
        // Spawn new particles when thrusting
        if (isThrusting && Math.random() < 0.3) { // 30% chance each frame
            this.spawnSmokeParticle();
        }
        
        // Update existing particles
        for (let i = this.particles.length - 1; i >= 0; i--) {
            const particle = this.particles[i];
            const age = (currentTime - particle.spawnTime) / 1000; // Age in seconds
            
            if (age > 2) {
                // Remove particle after 2 seconds
                this.exhaustParticles.remove(particle.mesh);
                this.particles.splice(i, 1);
                continue;
            }
            
            // Apply physics
            particle.velocity.y -= 0.01; // Gravity
            particle.velocity.multiplyScalar(0.99); // Air resistance
            
            // Update position in world space (not relative to plane)
            const worldPosition = new THREE.Vector3();
            particle.mesh.getWorldPosition(worldPosition);
            
            // Convert velocity to world space and apply
            const worldVelocity = particle.velocity.clone();
            worldVelocity.applyQuaternion(this.airplane.quaternion);
            
            worldPosition.add(worldVelocity);
            
            // Convert back to local space relative to plane's exhaust position
            const exhaustWorldPos = new THREE.Vector3();
            this.exhaustParticles.getWorldPosition(exhaustWorldPos);
            
            particle.mesh.position.copy(worldPosition.sub(exhaustWorldPos));
            
            // Billboard effect - make particle face camera
            particle.mesh.lookAt(this.camera.position);
            
            // Fade out over time
            const fadeProgress = age / 2;
            particle.mesh.material.opacity = 0.7 * (1 - fadeProgress);
        }
    }
    
    spawnSmokeParticle() {
        // Create new smoke particle
        const particle = {
            mesh: new THREE.Mesh(this.particleGeometry, this.particleMaterial.clone()),
            velocity: new THREE.Vector3(
                -2 - Math.random() * 2, // Backward from plane
                (Math.random() - 0.5) * 0.5, // Small random Y
                (Math.random() - 0.5) * 0.5  // Small random Z
            ),
            spawnTime: Date.now()
        };
        
        // Set random gray-black color (darker)
        const grayValue = 0.1 + Math.random() * 0.3; // 0.1 to 0.4 (much darker)
        particle.mesh.material.color.setRGB(grayValue, grayValue, grayValue);
        
        // Start at exhaust position
        particle.mesh.position.set(0, 0, 0);
        
        this.exhaustParticles.add(particle.mesh);
        this.particles.push(particle);
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
        
        // Sun angle based on time - simple linear progression
        const sunAngle = this.timeOfDay * Math.PI * 2;
        this.sun.position.set(
            Math.cos(sunAngle) * 200,
            Math.sin(sunAngle) * 200,
            50
        );
        
        // Calculate sun height (normalized from -1 to 1)
        const sunHeight = Math.sin(sunAngle);
        
        // Update sun and moon mesh positions
        if (this.sunMesh && this.moonMesh) {
            // Position sun mesh relative to player
            const sunDistance = 800;
            
            this.sunMesh.position.set(
                this.airplane.position.x + Math.cos(sunAngle) * sunDistance,
                this.airplane.position.y + sunHeight * sunDistance,
                this.airplane.position.z + 50
            );
            
            // Position moon opposite to sun
            const moonAngle = sunAngle + Math.PI;
            const moonHeight = Math.sin(moonAngle);
            
            this.moonMesh.position.set(
                this.airplane.position.x + Math.cos(moonAngle) * sunDistance,
                this.airplane.position.y + moonHeight * sunDistance,
                this.airplane.position.z + 50
            );
            
            // Show/hide sun and moon based on their height
            this.sunMesh.visible = sunHeight > -0.1;
            this.moonMesh.visible = moonHeight > -0.1;
            
            // Size scaling based on proximity to horizon
            const sunHorizonFactor = 1 + (1 - Math.abs(sunHeight)) * 0.5;
            const moonHorizonFactor = 1 + (1 - Math.abs(moonHeight)) * 0.5;
            
            this.sunMesh.scale.setScalar(sunHorizonFactor);
            this.moonMesh.scale.setScalar(moonHorizonFactor);
        }
        
        // SKY COLOR SYSTEM BASED ON SUN POSITION - SMOOTH TRANSITIONS
        let skyColor;
        
        // Define key colors for different sun positions
        const brightBlue = new THREE.Color(0x4a90e2);   // High noon
        const skyBlue = new THREE.Color(0x87ceeb);      // Day
        const warmBlue = new THREE.Color(0x87ceeb);     // Afternoon  
        const orange = new THREE.Color(0xffa500);       // Sunset/sunrise
        const red = new THREE.Color(0xff6347);          // Deep sunset
        const purple = new THREE.Color(0x8b008b);       // Twilight
        const darkBlue = new THREE.Color(0x191970);     // Late twilight
        const nightBlue = new THREE.Color(0x0a0a2a);    // Night
        
        // Smooth interpolation based on sun height
        if (sunHeight > 0.8) {
            // High noon region - interpolate to bright blue
            const t = Math.min(1, (sunHeight - 0.8) / 0.2);
            skyColor = skyBlue.clone().lerp(brightBlue, t);
        } else if (sunHeight > 0.3) {
            // Day region - stable blue with slight variation
            const t = (sunHeight - 0.3) / 0.5;
            skyColor = warmBlue.clone().lerp(skyBlue, t);
        } else if (sunHeight > 0.1) {
            // Late afternoon - blue to orange transition
            const t = (sunHeight - 0.1) / 0.2;
            skyColor = orange.clone().lerp(warmBlue, t);
        } else if (sunHeight > -0.1) {
            // Sunset/Sunrise - orange to red transition  
            const t = (sunHeight + 0.1) / 0.2;
            skyColor = red.clone().lerp(orange, t);
        } else if (sunHeight > -0.2) {
            // Early twilight - red to purple
            const t = (sunHeight + 0.2) / 0.1;
            skyColor = purple.clone().lerp(red, t);
        } else if (sunHeight > -0.4) {
            // Late twilight - purple to dark blue
            const t = (sunHeight + 0.4) / 0.2;
            skyColor = darkBlue.clone().lerp(purple, t);
        } else {
            // Night - dark blue to very dark
            const t = Math.max(0, (sunHeight + 0.6) / 0.2);
            skyColor = nightBlue.clone().lerp(darkBlue, t);
        }
        
        // Lighting intensity based on sun height
        const dayIntensity = Math.max(0.1, Math.max(0, sunHeight) * 1.5);
        this.sun.intensity = dayIntensity;
        
        // Update hemisphere light
        if (this.hemisphereLight) {
            this.hemisphereLight.intensity = Math.max(0.05, Math.max(0, sunHeight) * 0.3);
        }
        
        // Sun color based on height
        let sunColor;
        if (sunHeight > 0.3) {
            sunColor = new THREE.Color(0xfff8dc); // Warm white during day
        } else if (sunHeight > -0.1) {
            sunColor = new THREE.Color(0xffa500); // Orange during sunset/sunrise
        } else {
            sunColor = new THREE.Color(0xff4500); // Red-orange when below horizon
        }
        this.sun.color = sunColor;
        
        // Update stars visibility and position
        if (this.stars) {
            this.stars.visible = sunHeight < -0.1; // Stars visible only when sun is well below horizon
            if (this.stars.visible) {
                // Fade stars in/out based on darkness
                const starOpacity = Math.max(0, Math.min(1, (-sunHeight - 0.1) / 0.3));
                this.stars.material.opacity = starOpacity;
                
                // Stars follow player position
                this.stars.position.copy(this.airplane.position);
            }
        }
        
        this.renderer.setClearColor(skyColor);
        this.scene.fog.color = skyColor;
    }


    updateClouds() {
        // Update sky position to follow player (prevent visible seams)
        if (this.sky && this.airplane) {
            this.sky.position.copy(this.airplane.position);
        }
        
        // Update cloud positions for scrolling effect
        this.chunks.forEach(chunk => {
            chunk.children.forEach(child => {
                if (child.userData && child.userData.speed) {
                    // Move clouds in their assigned direction
                    const speed = child.userData.speed;
                    const direction = child.userData.direction;
                    child.position.x += Math.cos(direction) * speed;
                    child.position.z += Math.sin(direction) * speed;
                }
            });
        });
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
        if (pauseMenu) {
            pauseMenu.style.display = this.paused ? 'block' : 'none';
        }
        
        if (this.paused) {
            // Exit pointer lock when pausing
            if (document.pointerLockElement) {
                document.exitPointerLock();
            }
        } else {
            // Optionally request pointer lock when resuming
            // But don't force it - user can click to activate
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
            this.updateWater();
            this.updateAudio();
            this.updateUI();
        }
        
        this.renderer.render(this.scene, this.camera);
    }

    updateWater() {
        if (this.waterTexture) {
            this.waterTime += 0.005;
            // Animate the water texture for flowing effect
            this.waterTexture.offset.x = this.waterTime * 0.1;
            this.waterTexture.offset.y = this.waterTime * 0.05;
        }
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
        if (!window.game.soundEnabled) {
            window.game.stopAllAudio();
        }
        
        // Update button text to reflect current state
        const soundButton = document.querySelector('button[onclick="toggleSound()"]');
        if (soundButton) {
            soundButton.textContent = window.game.soundEnabled ? 'Sound: ON' : 'Sound: OFF';
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