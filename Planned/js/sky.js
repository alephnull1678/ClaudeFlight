class SkySystem {
    constructor(scene, renderer) {
        this.scene = scene;
        this.renderer = renderer;
        this.sky = null;
        this.sunMesh = null;
        this.moonMesh = null;
        this.stars = null;
        this.sun = null;
        this.ambientLight = null;
        this.hemisphereLight = null;
        
        // Day/night cycle
        this.timeOfDay = 0.25;
        this.daySpeed = 0.0001;
        
        this.createSky();
        this.setupLighting();
    }
    
    setupLighting() {
        // Enhanced lighting system
        this.sun = new THREE.DirectionalLight(0xfff8dc, 1.5);
        this.sun.position.set(50, 100, 50);
        this.sun.castShadow = true;
        
        // Higher quality shadows
        this.sun.shadow.mapSize.width = 4096;
        this.sun.shadow.mapSize.height = 4096;
        this.sun.shadow.camera.near = 0.1;
        this.sun.shadow.camera.far = 800;
        this.sun.shadow.camera.left = -400;
        this.sun.shadow.camera.right = 400;
        this.sun.shadow.camera.top = 400;
        this.sun.shadow.camera.bottom = -400;
        this.sun.shadow.bias = -0.0001;
        this.scene.add(this.sun);
        
        // Improved ambient lighting
        this.ambientLight = new THREE.AmbientLight(0x87ceeb, 0.4);
        this.scene.add(this.ambientLight);
        
        // Add hemisphere light for more realistic sky lighting
        this.hemisphereLight = new THREE.HemisphereLight(0x87ceeb, 0x8b7355, 0.3);
        this.scene.add(this.hemisphereLight);
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
            const normalizedY = (y + 1500) / 3000;
            
            // Sky blue to lighter blue gradient
            const topColor = new THREE.Color(0x87ceeb);
            const bottomColor = new THREE.Color(0xe0f6ff);
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
            depthWrite: false
        });
        
        this.sky = new THREE.Mesh(skyGeometry, skyMaterial);
        this.sky.renderOrder = -1;
        this.scene.add(this.sky);
        
        this.createSunMoon();
        this.createStars();
    }
    
    createSunMoon() {
        // Create sun
        const sunGeometry = new THREE.SphereGeometry(25, 16, 16);
        const sunMaterial = new THREE.MeshBasicMaterial({
            color: 0xffff00,
            emissive: 0xffff00,
            emissiveIntensity: 0.6,
            fog: false
        });
        this.sunMesh = new THREE.Mesh(sunGeometry, sunMaterial);
        this.scene.add(this.sunMesh);
        
        // Create moon
        const moonGeometry = new THREE.SphereGeometry(20, 16, 16);
        const moonMaterial = new THREE.MeshBasicMaterial({
            color: 0xeeeeee,
            emissive: 0x666666,
            emissiveIntensity: 0.3,
            fog: false
        });
        this.moonMesh = new THREE.Mesh(moonGeometry, moonMaterial);
        this.scene.add(this.moonMesh);
    }
    
    createStars() {
        const starGeometry = new THREE.BufferGeometry();
        const starCount = 1000;
        const positions = new Float32Array(starCount * 3);
        
        for (let i = 0; i < starCount; i++) {
            const i3 = i * 3;
            
            const radius = 1200;
            const theta = Math.random() * Math.PI * 2;
            const phi = Math.acos(2 * Math.random() - 1);
            
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
            fog: false
        });
        
        this.stars = new THREE.Points(starGeometry, starMaterial);
        this.stars.visible = false;
        this.scene.add(this.stars);
    }
    
    updateDayNightCycle(playerPosition) {
        this.timeOfDay += this.daySpeed;
        if (this.timeOfDay > 1) this.timeOfDay = 0;
        
        // Sun angle based on time
        const sunAngle = this.timeOfDay * Math.PI * 2;
        this.sun.position.set(
            Math.cos(sunAngle) * 200,
            Math.sin(sunAngle) * 200,
            50
        );
        
        // Calculate sun height
        const sunHeight = Math.sin(sunAngle);
        
        // Update sun and moon mesh positions
        if (this.sunMesh && this.moonMesh) {
            const sunDistance = 800;
            
            this.sunMesh.position.set(
                playerPosition.x + Math.cos(sunAngle) * sunDistance,
                playerPosition.y + sunHeight * sunDistance,
                playerPosition.z + 50
            );
            
            const moonAngle = sunAngle + Math.PI;
            const moonHeight = Math.sin(moonAngle);
            
            this.moonMesh.position.set(
                playerPosition.x + Math.cos(moonAngle) * sunDistance,
                playerPosition.y + moonHeight * sunDistance,
                playerPosition.z + 50
            );
            
            this.sunMesh.visible = sunHeight > -0.1;
            this.moonMesh.visible = moonHeight > -0.1;
            
            const sunHorizonFactor = 1 + (1 - Math.abs(sunHeight)) * 0.5;
            const moonHorizonFactor = 1 + (1 - Math.abs(moonHeight)) * 0.5;
            
            this.sunMesh.scale.setScalar(sunHorizonFactor);
            this.moonMesh.scale.setScalar(moonHorizonFactor);
        }
        
        // Sky color system
        let skyColor = this.calculateSkyColor(sunHeight);
        
        // Lighting intensity
        const dayIntensity = Math.max(0.1, Math.max(0, sunHeight) * 1.5);
        this.sun.intensity = dayIntensity;
        
        if (this.hemisphereLight) {
            this.hemisphereLight.intensity = Math.max(0.05, Math.max(0, sunHeight) * 0.3);
        }
        
        // Sun color
        let sunColor;
        if (sunHeight > 0.3) {
            sunColor = new THREE.Color(0xfff8dc);
        } else if (sunHeight > -0.1) {
            sunColor = new THREE.Color(0xffa500);
        } else {
            sunColor = new THREE.Color(0xff4500);
        }
        this.sun.color = sunColor;
        
        // Update stars
        if (this.stars) {
            this.stars.visible = sunHeight < -0.1;
            if (this.stars.visible) {
                const starOpacity = Math.max(0, Math.min(1, (-sunHeight - 0.1) / 0.3));
                this.stars.material.opacity = starOpacity;
                this.stars.position.copy(playerPosition);
            }
        }
        
        this.renderer.setClearColor(skyColor);
        this.scene.fog.color = skyColor;
    }
    
    calculateSkyColor(sunHeight) {
        const brightBlue = new THREE.Color(0x4a90e2);
        const skyBlue = new THREE.Color(0x87ceeb);
        const warmBlue = new THREE.Color(0x87ceeb);
        const orange = new THREE.Color(0xffa500);
        const red = new THREE.Color(0xff6347);
        const purple = new THREE.Color(0x8b008b);
        const darkBlue = new THREE.Color(0x191970);
        const nightBlue = new THREE.Color(0x0a0a2a);
        
        if (sunHeight > 0.8) {
            const t = Math.min(1, (sunHeight - 0.8) / 0.2);
            return skyBlue.clone().lerp(brightBlue, t);
        } else if (sunHeight > 0.3) {
            const t = (sunHeight - 0.3) / 0.5;
            return warmBlue.clone().lerp(skyBlue, t);
        } else if (sunHeight > 0.1) {
            const t = (sunHeight - 0.1) / 0.2;
            return orange.clone().lerp(warmBlue, t);
        } else if (sunHeight > -0.1) {
            const t = (sunHeight + 0.1) / 0.2;
            return red.clone().lerp(orange, t);
        } else if (sunHeight > -0.2) {
            const t = (sunHeight + 0.2) / 0.1;
            return purple.clone().lerp(red, t);
        } else if (sunHeight > -0.4) {
            const t = (sunHeight + 0.4) / 0.2;
            return darkBlue.clone().lerp(purple, t);
        } else {
            const t = Math.max(0, (sunHeight + 0.6) / 0.2);
            return nightBlue.clone().lerp(darkBlue, t);
        }
    }
    
    updateSky(playerPosition) {
        if (this.sky && playerPosition) {
            this.sky.position.copy(playerPosition);
        }
    }
}