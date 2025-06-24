// Flight Simulator Game
class FlightSimulator {
    constructor() {
        this.scene = new THREE.Scene();
        this.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 10000);
        this.renderer = new THREE.WebGLRenderer({ antialias: true });
        
        this.airplane = null;
        this.velocity = new THREE.Vector3(0, 0, 0);
        this.speed = 0;
        this.pitch = 0;
        this.yaw = 0;
        this.roll = 0;
        this.throttle = 0;
        
        this.keys = {};
        this.mouse = { x: 0, y: 0 };
        
        this.init();
        this.createAirplane();
        this.createTerrain();
        this.createSky();
        this.setupControls();
        this.animate();
    }
    
    init() {
        // Setup renderer
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.setClearColor(0x87CEEB);
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        document.body.appendChild(this.renderer.domElement);
        
        // Setup camera
        this.camera.position.set(0, 5, 10);
        
        // Add lights
        const ambientLight = new THREE.AmbientLight(0x404040, 0.6);
        this.scene.add(ambientLight);
        
        const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
        directionalLight.position.set(100, 100, 50);
        directionalLight.castShadow = true;
        directionalLight.shadow.mapSize.width = 2048;
        directionalLight.shadow.mapSize.height = 2048;
        this.scene.add(directionalLight);
        
        // Handle window resize
        window.addEventListener('resize', () => {
            this.camera.aspect = window.innerWidth / window.innerHeight;
            this.camera.updateProjectionMatrix();
            this.renderer.setSize(window.innerWidth, window.innerHeight);
        });
    }
    
    createAirplane() {
        this.airplane = new THREE.Group();
        
        // Fuselage (main body)
        const fuselageGeometry = new THREE.CylinderGeometry(0.3, 0.1, 3, 8);
        const fuselageMaterial = new THREE.MeshLambertMaterial({ color: 0x0066cc });
        const fuselage = new THREE.Mesh(fuselageGeometry, fuselageMaterial);
        fuselage.rotation.z = Math.PI / 2;
        fuselage.castShadow = true;
        this.airplane.add(fuselage);
        
        // Wings
        const wingGeometry = new THREE.BoxGeometry(4, 0.1, 1);
        const wingMaterial = new THREE.MeshLambertMaterial({ color: 0x0088ff });
        const wings = new THREE.Mesh(wingGeometry, wingMaterial);
        wings.position.z = -0.5;
        wings.castShadow = true;
        this.airplane.add(wings);
        
        // Tail
        const tailGeometry = new THREE.BoxGeometry(0.1, 1.5, 0.8);
        const tailMaterial = new THREE.MeshLambertMaterial({ color: 0x0088ff });
        const tail = new THREE.Mesh(tailGeometry, tailMaterial);
        tail.position.x = -1.3;
        tail.position.y = 0.5;
        tail.castShadow = true;
        this.airplane.add(tail);
        
        // Horizontal stabilizer
        const stabilizerGeometry = new THREE.BoxGeometry(1.5, 0.1, 0.3);
        const stabilizer = new THREE.Mesh(stabilizerGeometry, wingMaterial);
        stabilizer.position.x = -1.3;
        stabilizer.position.y = 0.3;
        stabilizer.castShadow = true;
        this.airplane.add(stabilizer);
        
        // Propeller
        const propGeometry = new THREE.BoxGeometry(0.1, 2, 0.05);
        const propMaterial = new THREE.MeshLambertMaterial({ color: 0x333333 });
        this.propeller = new THREE.Mesh(propGeometry, propMaterial);
        this.propeller.position.x = 1.6;
        this.airplane.add(this.propeller);
        
        this.airplane.position.set(0, 10, 0);
        this.airplane.castShadow = true;
        this.scene.add(this.airplane);
    }
    
    createTerrain() {
        // Create a simple low-poly terrain
        const terrainGeometry = new THREE.PlaneGeometry(500, 500, 32, 32);
        const terrainMaterial = new THREE.MeshLambertMaterial({ 
            color: 0x228B22,
            wireframe: false
        });
        
        // Add some randomness to terrain vertices
        const vertices = terrainGeometry.attributes.position.array;
        for (let i = 2; i < vertices.length; i += 3) {
            vertices[i] = Math.random() * 5;
        }
        terrainGeometry.attributes.position.needsUpdate = true;
        terrainGeometry.computeVertexNormals();
        
        const terrain = new THREE.Mesh(terrainGeometry, terrainMaterial);
        terrain.rotation.x = -Math.PI / 2;
        terrain.receiveShadow = true;
        this.scene.add(terrain);
        
        // Add some trees
        for (let i = 0; i < 100; i++) {
            const tree = this.createTree();
            tree.position.set(
                (Math.random() - 0.5) * 400,
                0,
                (Math.random() - 0.5) * 400
            );
            this.scene.add(tree);
        }
    }
    
    createTree() {
        const tree = new THREE.Group();
        
        // Trunk
        const trunkGeometry = new THREE.CylinderGeometry(0.3, 0.5, 3, 6);
        const trunkMaterial = new THREE.MeshLambertMaterial({ color: 0x8B4513 });
        const trunk = new THREE.Mesh(trunkGeometry, trunkMaterial);
        trunk.position.y = 1.5;
        trunk.castShadow = true;
        tree.add(trunk);
        
        // Leaves
        const leavesGeometry = new THREE.ConeGeometry(2, 4, 8);
        const leavesMaterial = new THREE.MeshLambertMaterial({ color: 0x228B22 });
        const leaves = new THREE.Mesh(leavesGeometry, leavesMaterial);
        leaves.position.y = 4.5;
        leaves.castShadow = true;
        tree.add(leaves);
        
        return tree;
    }
    
    createSky() {
        // Create a simple sky gradient
        const skyGeometry = new THREE.SphereGeometry(1000, 32, 15);
        const skyMaterial = new THREE.MeshBasicMaterial({
            color: 0x87CEEB,
            side: THREE.BackSide
        });
        const sky = new THREE.Mesh(skyGeometry, skyMaterial);
        this.scene.add(sky);
        
        // Add some clouds
        for (let i = 0; i < 20; i++) {
            const cloud = this.createCloud();
            cloud.position.set(
                (Math.random() - 0.5) * 1000,
                50 + Math.random() * 100,
                (Math.random() - 0.5) * 1000
            );
            this.scene.add(cloud);
        }
    }
    
    createCloud() {
        const cloud = new THREE.Group();
        const cloudMaterial = new THREE.MeshLambertMaterial({ 
            color: 0xffffff,
            transparent: true,
            opacity: 0.8
        });
        
        for (let i = 0; i < 5; i++) {
            const cloudGeometry = new THREE.SphereGeometry(5 + Math.random() * 5, 8, 6);
            const cloudPart = new THREE.Mesh(cloudGeometry, cloudMaterial);
            cloudPart.position.set(
                (Math.random() - 0.5) * 20,
                (Math.random() - 0.5) * 5,
                (Math.random() - 0.5) * 20
            );
            cloud.add(cloudPart);
        }
        
        return cloud;
    }
    
    setupControls() {
        // Keyboard controls
        document.addEventListener('keydown', (event) => {
            this.keys[event.code] = true;
        });
        
        document.addEventListener('keyup', (event) => {
            this.keys[event.code] = false;
        });
        
        // Mouse controls
        document.addEventListener('mousemove', (event) => {
            this.mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
            this.mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
        });
        
        // Pointer lock for better flight control
        document.addEventListener('click', () => {
            document.body.requestPointerLock();
        });
        
        document.addEventListener('mousemove', (event) => {
            if (document.pointerLockElement) {
                this.yaw -= event.movementX * 0.002;
                this.pitch -= event.movementY * 0.002;
                this.pitch = Math.max(-Math.PI/3, Math.min(Math.PI/3, this.pitch));
            }
        });
    }
    
    updateControls() {
        const deltaTime = 0.016; // Assuming 60fps
        
        // Throttle control
        if (this.keys['ShiftLeft'] || this.keys['ShiftRight']) {
            this.throttle = Math.min(1, this.throttle + deltaTime);
        } else if (this.keys['ControlLeft'] || this.keys['ControlRight']) {
            this.throttle = Math.max(0, this.throttle - deltaTime);
        }
        
        // Flight controls
        if (this.keys['KeyW']) this.pitch += deltaTime;
        if (this.keys['KeyS']) this.pitch -= deltaTime;
        if (this.keys['KeyA']) this.yaw += deltaTime;
        if (this.keys['KeyD']) this.yaw -= deltaTime;
        if (this.keys['KeyQ']) this.roll -= deltaTime;
        if (this.keys['KeyE']) this.roll += deltaTime;
        
        // Clamp values
        this.pitch = Math.max(-Math.PI/4, Math.min(Math.PI/4, this.pitch));
        this.roll = Math.max(-Math.PI/4, Math.min(Math.PI/4, this.roll));
        
        // Natural dampening
        this.pitch *= 0.95;
        this.roll *= 0.95;
    }
    
    updatePhysics() {
        const deltaTime = 0.016;
        
        // Calculate speed based on throttle
        this.speed = this.throttle * 100;
        
        // Update airplane rotation
        this.airplane.rotation.x = this.pitch;
        this.airplane.rotation.y = this.yaw;
        this.airplane.rotation.z = this.roll;
        
        // Calculate velocity based on airplane orientation
        const direction = new THREE.Vector3(1, 0, 0);
        direction.applyQuaternion(this.airplane.quaternion);
        
        this.velocity.copy(direction.multiplyScalar(this.speed * deltaTime));
        
        // Apply gravity
        this.velocity.y -= 9.8 * deltaTime * 0.1;
        
        // Update position
        this.airplane.position.add(this.velocity);
        
        // Prevent going below ground
        if (this.airplane.position.y < 2) {
            this.airplane.position.y = 2;
            this.velocity.y = 0;
        }
        
        // Rotate propeller
        if (this.propeller) {
            this.propeller.rotation.x += this.throttle * 0.5;
        }
        
        // Update camera to follow airplane
        const cameraOffset = new THREE.Vector3(-15, 5, 0);
        cameraOffset.applyQuaternion(this.airplane.quaternion);
        this.camera.position.copy(this.airplane.position.clone().add(cameraOffset));
        this.camera.lookAt(this.airplane.position);
        
        // Update UI
        document.getElementById('speed').textContent = Math.round(this.speed * 3.6);
        document.getElementById('altitude').textContent = Math.round(Math.max(0, this.airplane.position.y - 2));
    }
    
    animate() {
        requestAnimationFrame(() => this.animate());
        
        this.updateControls();
        this.updatePhysics();
        
        this.renderer.render(this.scene, this.camera);
    }
}

// Start the flight simulator when the page loads
window.addEventListener('load', () => {
    new FlightSimulator();
});