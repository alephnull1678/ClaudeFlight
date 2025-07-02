class TerrainSystem {
    constructor(scene) {
        this.scene = scene;
        this.chunks = new Map();
        this.chunkSize = 400;
        this.viewDistance = 3;
        this.waterLevel = -20;
        this.waterTime = 0;
        this.waterTexture = null;
        
        // Biomes with increased tree frequency
        this.biomes = [
            { name: 'Forest', color: 0x2d5a27, treeChance: 0.8 },
            { name: 'Desert', color: 0xc2b280, treeChance: 0.1 },
            { name: 'Mountains', color: 0x8b7355, treeChance: 0.25 },
            { name: 'Plains', color: 0x7cfc00, treeChance: 0.4 },
            { name: 'Tundra', color: 0xf0f8ff, treeChance: 0.08 },
            { name: 'Swamp', color: 0x2f4f2f, treeChance: 0.75 },
            { name: 'Canyon', color: 0xcd853f, treeChance: 0.12 },
            { name: 'Volcanic', color: 0x8b0000, treeChance: 0.03 },
            { name: 'Coastal', color: 0x87ceeb, treeChance: 0.45 },
            { name: 'Jungle', color: 0x228b22, treeChance: 0.9 }
        ];
        this.currentBiome = this.biomes[0];
        
        // Noise for terrain generation
        this.noise = window.createNoise2D ? window.createNoise2D() : null;
        
        this.createWaterTexture();
        this.setupInitialTerrain();
    }
    
    setupInitialTerrain() {
        // Generate initial chunks around spawn point
        for (let x = -this.viewDistance; x <= this.viewDistance; x++) {
            for (let z = -this.viewDistance; z <= this.viewDistance; z++) {
                this.generateChunk(x, z);
            }
        }
    }
    
    createWaterTexture() {
        const canvas = document.createElement('canvas');
        canvas.width = 256;
        canvas.height = 256;
        const ctx = canvas.getContext('2d');
        
        const imageData = ctx.createImageData(256, 256);
        const data = imageData.data;
        
        for (let y = 0; y < 256; y++) {
            for (let x = 0; x < 256; x++) {
                const i = (y * 256 + x) * 4;
                
                const wave1 = Math.sin((x + y) * 0.02) * 0.3;
                const wave2 = Math.sin(x * 0.03) * Math.sin(y * 0.03) * 0.4;
                const wave3 = Math.sin((x - y) * 0.015) * 0.2;
                const intensity = (wave1 + wave2 + wave3 + 1) * 0.5;
                
                data[i] = Math.floor(30 + intensity * 60);
                data[i + 1] = Math.floor(144 + intensity * 60);
                data[i + 2] = Math.floor(255 - intensity * 30);
                data[i + 3] = 255;
            }
        }
        
        ctx.putImageData(imageData, 0, 0);
        
        this.waterTexture = new THREE.CanvasTexture(canvas);
        this.waterTexture.wrapS = THREE.RepeatWrapping;
        this.waterTexture.wrapT = THREE.RepeatWrapping;
        this.waterTexture.repeat.set(4, 4);
    }
    
    generateChunk(chunkX, chunkZ) {
        const key = `${chunkX},${chunkZ}`;
        if (this.chunks.has(key)) return;
        
        const chunk = new THREE.Group();
        const worldX = chunkX * this.chunkSize;
        const worldZ = chunkZ * this.chunkSize;
        
        const resolution = 64;
        const terrainGeometry = new THREE.PlaneGeometry(this.chunkSize, this.chunkSize, resolution, resolution);
        
        terrainGeometry.rotateX(-Math.PI / 2);
        
        const vertices = terrainGeometry.attributes.position.array;
        const colors = new Float32Array((vertices.length / 3) * 3);
        
        for (let i = 0; i < vertices.length; i += 3) {
            const localX = vertices[i];
            const localZ = vertices[i + 2];
            
            const worldCoordX = Math.round((worldX + localX) * 100) / 100;
            const worldCoordZ = Math.round((worldZ + localZ) * 100) / 100;
            
            const height = this.getTerrainHeight(worldCoordX, worldCoordZ);
            vertices[i + 1] = height;
            
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
            flatShading: false,
            wireframe: false,
            shininess: 10,
            specular: 0x222222
        });
        
        const terrain = new THREE.Mesh(terrainGeometry, terrainMaterial);
        terrain.position.set(worldX, 0, worldZ);
        terrain.receiveShadow = true;
        chunk.add(terrain);
        
        const centerBiome = this.getBiomeAtPosition(worldX, worldZ);
        this.addChunkFeatures(chunk, worldX, worldZ, centerBiome);
        this.addWaterLayer(chunk, worldX, worldZ);
        this.addChunkClouds(chunk, worldX, worldZ);
        this.addHighAltitudeClouds(chunk, worldX, worldZ);
        
        chunk.position.set(0, 0, 0);
        this.scene.add(chunk);
        this.chunks.set(key, chunk);
    }
    
    getBiomeAtPosition(x, z) {
        if (!this.noise) return this.biomes[0];
        
        try {
            const primaryNoise = this.noise(x * 0.00005, z * 0.00005);
            const secondaryNoise = this.noise(x * 0.0002, z * 0.0002) * 0.4;
            const tertiaryNoise = this.noise(x * 0.0005, z * 0.0005) * 0.2;
            const combinedNoise = primaryNoise + secondaryNoise + tertiaryNoise;
            
            const biomeIndex = Math.floor((combinedNoise + 1) * 0.5 * this.biomes.length);
            return this.biomes[Math.min(Math.max(biomeIndex, 0), this.biomes.length - 1)];
        } catch (e) {
            console.warn('Biome generation error:', e);
            return this.biomes[0];
        }
    }
    
    getBlendedBiomeColor(x, z) {
        if (!this.noise) return new THREE.Color(this.biomes[0].color);
        
        try {
            const sampleDistance = 20;
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
            const macroScale = this.noise(x * 0.0008, z * 0.0008) * 200;
            const secondaryMacro = this.noise(x * 0.0012, z * 0.0012) * 120;
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
        // Trees
        for (let i = 0; i < 35; i++) {
            if (Math.random() < biome.treeChance) {
                const tree = this.createTree();
                const x = (Math.random() - 0.5) * this.chunkSize + worldX;
                const z = (Math.random() - 0.5) * this.chunkSize + worldZ;
                const y = this.getTerrainHeight(x, z);
                
                if (y > this.waterLevel + 2) {
                    tree.position.set(x, y, z);
                    chunk.add(tree);
                }
            }
        }
        
        // Houses
        if (Math.random() < 0.1) {
            const house = this.createHouse();
            const x = (Math.random() - 0.5) * this.chunkSize * 0.5 + worldX;
            const z = (Math.random() - 0.5) * this.chunkSize * 0.5 + worldZ;
            const y = this.getTerrainHeight(x, z);
            
            if (y > this.waterLevel + 2) {
                house.position.set(x, y, z);
                chunk.add(house);
            }
        }
        
        // Building clusters
        if ((biome.name === 'Plains' || biome.name === 'Coastal') && Math.random() < 0.2) {
            this.addBuildingCluster(chunk, worldX, worldZ);
        }
        
        // Rocks
        for (let i = 0; i < 5; i++) {
            if (Math.random() < 0.3) {
                const rock = this.createRock();
                const x = (Math.random() - 0.5) * this.chunkSize + worldX;
                const z = (Math.random() - 0.5) * this.chunkSize + worldZ;
                const y = this.getTerrainHeight(x, z);
                
                if (y > this.waterLevel + 1) {
                    rock.position.set(x, y, z);
                    chunk.add(rock);
                }
            }
        }
    }
    
    createTree() {
        const tree = new THREE.Group();
        
        const treeScale = 0.7 + Math.random() * 0.6;
        const trunkHeight = 6 + Math.random() * 4;
        
        const trunkGeometry = new THREE.CylinderGeometry(0.5 * treeScale, 0.8 * treeScale, trunkHeight, 8);
        const trunkMaterial = new THREE.MeshPhongMaterial({ 
            color: new THREE.Color().setHSL(0.08, 0.5, 0.2 + Math.random() * 0.1),
            shininess: 5,
            specular: 0x111111
        });
        const trunk = new THREE.Mesh(trunkGeometry, trunkMaterial);
        trunk.position.y = trunkHeight / 2;
        trunk.castShadow = true;
        trunk.receiveShadow = true;
        tree.add(trunk);
        
        const leavesGeometry = new THREE.ConeGeometry(3 + Math.random() * 2, 5 + Math.random() * 3, 8);
        const leafHue = 0.25 + Math.random() * 0.15;
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
        
        tree.rotation.y = Math.random() * Math.PI * 2;
        
        return tree;
    }
    
    createHouse() {
        const house = new THREE.Group();
        
        const baseGeometry = new THREE.BoxGeometry(8, 6, 8);
        const baseMaterial = new THREE.MeshLambertMaterial({ color: 0xd2691e });
        const base = new THREE.Mesh(baseGeometry, baseMaterial);
        base.position.y = 3;
        base.castShadow = true;
        house.add(base);
        
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
        
        const width = 12 + Math.random() * 16;
        const depth = 12 + Math.random() * 16;
        const height = 20 + Math.random() * 30;
        
        const baseGeometry = new THREE.BoxGeometry(width, height, depth);
        const baseMaterial = new THREE.MeshPhongMaterial({ 
            color: new THREE.Color().setHSL(0, 0, 0.4 + Math.random() * 0.3),
            shininess: 10
        });
        const base = new THREE.Mesh(baseGeometry, baseMaterial);
        base.position.y = height / 2;
        base.castShadow = true;
        base.receiveShadow = true;
        building.add(base);
        
        const windowCount = Math.floor(height / 4);
        for (let i = 0; i < windowCount; i++) {
            const windowGeometry = new THREE.BoxGeometry(width * 0.8, 2, 0.1);
            const windowMaterial = new THREE.MeshBasicMaterial({ color: 0x222222 });
            const window = new THREE.Mesh(windowGeometry, windowMaterial);
            window.position.set(0, 3 + i * 4, depth / 2 + 0.05);
            building.add(window);
        }
        
        building.rotation.y = Math.random() * Math.PI * 2;
        
        return building;
    }
    
    addBuildingCluster(chunk, worldX, worldZ) {
        const buildingCount = Math.floor(Math.random() * 8) + 8;
        const clusterCenterX = worldX + (Math.random() - 0.5) * this.chunkSize * 0.6;
        const clusterCenterZ = worldZ + (Math.random() - 0.5) * this.chunkSize * 0.6;
        
        for (let i = 0; i < buildingCount; i++) {
            const building = this.createBuilding();
            
            const angle = Math.random() * Math.PI * 2;
            const distance = Math.random() * 80;
            const x = clusterCenterX + Math.cos(angle) * distance;
            const z = clusterCenterZ + Math.sin(angle) * distance;
            const y = this.getTerrainHeight(x, z);
            
            if (y > this.waterLevel + 5) {
                building.position.set(x, y, z);
                chunk.add(building);
            }
        }
    }
    
    createRock() {
        const rockGeometry = new THREE.DodecahedronGeometry(Math.random() * 2 + 1);
        const vertices = rockGeometry.attributes.position.array;
        
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
    
    addWaterLayer(chunk, worldX, worldZ) {
        const waterGeometry = new THREE.PlaneGeometry(this.chunkSize, this.chunkSize);
        waterGeometry.rotateX(-Math.PI / 2);
        
        const waterMaterial = new THREE.MeshPhongMaterial({
            map: this.waterTexture,
            transparent: true,
            opacity: 0.6,
            side: THREE.DoubleSide,
            shininess: 100,
            specular: 0x88ccff,
            reflectivity: 0.5
        });
        
        const water = new THREE.Mesh(waterGeometry, waterMaterial);
        water.position.set(worldX, this.waterLevel, worldZ);
        water.userData.isWater = true;
        
        chunk.add(water);
    }
    
    addChunkClouds(chunk, worldX, worldZ) {
        const cloudCount = Math.floor(Math.random() * 3) + 1;
        
        for (let i = 0; i < cloudCount; i++) {
            if (Math.random() < 0.3) {
                const cloud = this.createSingleCloud();
                
                cloud.position.set(
                    worldX + (Math.random() - 0.5) * this.chunkSize,
                    Math.random() * 100 + 300,
                    worldZ + (Math.random() - 0.5) * this.chunkSize
                );
                
                chunk.add(cloud);
            }
        }
    }
    
    addHighAltitudeClouds(chunk, worldX, worldZ) {
        const cloudCount = Math.floor(Math.random() * 4) + 2;
        
        for (let i = 0; i < cloudCount; i++) {
            if (Math.random() < 0.6) {
                const cloud = this.createHighAltitudeCloud();
                
                cloud.position.set(
                    worldX + (Math.random() - 0.5) * this.chunkSize,
                    Math.random() * 150 + 500,
                    worldZ + (Math.random() - 0.5) * this.chunkSize
                );
                
                chunk.add(cloud);
            }
        }
    }
    
    createSingleCloud() {
        const cloudGroup = new THREE.Group();
        
        const sphereCount = Math.floor(Math.random() * 8) + 6;
        
        for (let i = 0; i < sphereCount; i++) {
            const radius = Math.random() * 8 + 4;
            const sphereGeometry = new THREE.SphereGeometry(radius, 8, 6);
            
            const sphereMaterial = new THREE.MeshLambertMaterial({
                color: new THREE.Color().setHSL(0, 0, 0.7 + Math.random() * 0.2),
                transparent: true,
                opacity: 0.4 + Math.random() * 0.3,
                fog: true
            });
            
            const sphere = new THREE.Mesh(sphereGeometry, sphereMaterial);
            
            const clusterRadius = 15 + Math.random() * 10;
            const angle = Math.random() * Math.PI * 2;
            const height = (Math.random() - 0.5) * 8;
            
            sphere.position.set(
                Math.cos(angle) * clusterRadius * Math.random(),
                height,
                Math.sin(angle) * clusterRadius * Math.random()
            );
            
            cloudGroup.add(sphere);
        }
        
        cloudGroup.userData.speed = Math.random() * 0.2 + 0.1;
        cloudGroup.userData.direction = Math.random() * Math.PI * 2;
        
        return cloudGroup;
    }
    
    createHighAltitudeCloud() {
        const cloudGroup = new THREE.Group();
        
        const sphereCount = Math.floor(Math.random() * 12) + 8;
        
        for (let i = 0; i < sphereCount; i++) {
            const radius = Math.random() * 25 + 15;
            const sphereGeometry = new THREE.SphereGeometry(radius, 8, 6);
            
            const sphereMaterial = new THREE.MeshLambertMaterial({
                color: new THREE.Color().setHSL(0, 0, 0.85 + Math.random() * 0.1),
                transparent: true,
                opacity: 0.3 + Math.random() * 0.2,
                fog: true
            });
            
            const sphere = new THREE.Mesh(sphereGeometry, sphereMaterial);
            
            const clusterRadius = 40 + Math.random() * 30;
            const angle = Math.random() * Math.PI * 2;
            const height = (Math.random() - 0.5) * 20;
            
            sphere.position.set(
                Math.cos(angle) * clusterRadius * Math.random(),
                height,
                Math.sin(angle) * clusterRadius * Math.random()
            );
            
            cloudGroup.add(sphere);
        }
        
        cloudGroup.userData.speed = Math.random() * 0.1 + 0.05;
        cloudGroup.userData.direction = Math.random() * Math.PI * 2;
        
        return cloudGroup;
    }
    
    updateTerrain(playerPosition) {
        const playerChunkX = Math.floor(playerPosition.x / this.chunkSize);
        const playerChunkZ = Math.floor(playerPosition.z / this.chunkSize);
        
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
    
    updateClouds() {
        this.chunks.forEach(chunk => {
            chunk.children.forEach(child => {
                if (child.userData && child.userData.speed) {
                    const speed = child.userData.speed;
                    const direction = child.userData.direction;
                    child.position.x += Math.cos(direction) * speed;
                    child.position.z += Math.sin(direction) * speed;
                }
            });
        });
    }
    
    updateWater() {
        if (this.waterTexture) {
            this.waterTime += 0.005;
            this.waterTexture.offset.x = this.waterTime * 0.1;
            this.waterTexture.offset.y = this.waterTime * 0.05;
        }
    }
    
    updateBiome(playerPosition) {
        if (!this.noise) return;
        
        try {
            this.currentBiome = this.getBiomeAtPosition(playerPosition.x, playerPosition.z);
            
            const biomeDisplay = document.getElementById('biome-display');
            if (biomeDisplay) {
                biomeDisplay.textContent = this.currentBiome.name;
            }
        } catch (e) {
            console.warn('Biome update error:', e);
        }
    }
}