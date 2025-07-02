class ControlsSystem {
    constructor(game) {
        this.game = game;
        this.keys = {};
        this.mouse = { x: 0, y: 0 };
        this.isMousePressed = false;
        this.setupEventListeners();
    }
    
    setupEventListeners() {
        // Keyboard events
        document.addEventListener('keydown', (event) => {
            this.keys[event.code] = true;
            this.handleSpecialKeys(event.code);
        });
        
        document.addEventListener('keyup', (event) => {
            this.keys[event.code] = false;
        });
        
        // Mouse events
        document.addEventListener('mousemove', (event) => {
            if (!this.game.paused) {
                this.mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
                this.mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
            }
        });
        
        // Mouse shooting controls
        document.addEventListener('mousedown', (event) => {
            if (event.button === 0 && !this.game.paused && !this.game.crashed) {
                this.isMousePressed = true;
                this.game.shootingSystem.shoot();
            }
        });
        
        document.addEventListener('mouseup', (event) => {
            if (event.button === 0) {
                this.isMousePressed = false;
            }
        });
        
        // Pointer lock for better mouse control
        document.addEventListener('click', () => {
            // Initialize audio on first click
            this.game.audioSystem.init();
            
            if (!this.game.paused) {
                document.body.requestPointerLock();
            }
        });
        
        // Handle pointer lock changes
        document.addEventListener('pointerlockchange', () => {
            if (document.pointerLockElement) {
                document.addEventListener('mousemove', this.handleMouseMove.bind(this));
            } else {
                document.removeEventListener('mousemove', this.handleMouseMove.bind(this));
            }
        });
        
        // Also try to initialize audio on any key press
        document.addEventListener('keydown', (event) => {
            if (!this.game.audioSystem.audioInitialized) {
                this.game.audioSystem.init();
            }
        });
    }
    
    handleSpecialKeys(code) {
        switch (code) {
            case 'KeyF':
                this.game.toggleCamera();
                break;
            case 'KeyR':
                this.game.resetPlane();
                break;
            case 'Escape':
                this.game.togglePause();
                break;
        }
    }
    
    handleMouseMove(event) {
        if (this.game && !this.game.paused) {
            this.mouse.x += event.movementX * 0.001;
            this.mouse.y -= event.movementY * 0.001;
            
            // Clamp mouse values
            this.mouse.x = Math.max(-1, Math.min(1, this.mouse.x));
            this.mouse.y = Math.max(-1, Math.min(1, this.mouse.y));
        }
    }
    
    updateControls(aircraft) {
        if (this.game.paused || this.game.crashed) return;
        
        const pitchSpeed = 0.02;
        const yawSpeed = 0.03;
        const rollSpeed = 0.05;
        
        // Create rotation quaternions for each axis
        const pitchQuaternion = new THREE.Quaternion();
        const yawQuaternion = new THREE.Quaternion();
        const rollQuaternion = new THREE.Quaternion();
        
        // Roll (W/S) - rotate around local Z axis (barrel roll)
        if (this.keys['KeyW']) {
            rollQuaternion.setFromAxisAngle(new THREE.Vector3(0, 0, 1), -rollSpeed);
            aircraft.group.quaternion.multiplyQuaternions(aircraft.group.quaternion, rollQuaternion);
        }
        if (this.keys['KeyS']) {
            rollQuaternion.setFromAxisAngle(new THREE.Vector3(0, 0, 1), rollSpeed);
            aircraft.group.quaternion.multiplyQuaternions(aircraft.group.quaternion, rollQuaternion);
        }
        
        // Yaw (A/D) - rotate around world Y axis (always vertical)
        if (this.keys['KeyA']) {
            yawQuaternion.setFromAxisAngle(new THREE.Vector3(0, 1, 0), yawSpeed);
            aircraft.group.quaternion.multiplyQuaternions(yawQuaternion, aircraft.group.quaternion);
        }
        if (this.keys['KeyD']) {
            yawQuaternion.setFromAxisAngle(new THREE.Vector3(0, 1, 0), -yawSpeed);
            aircraft.group.quaternion.multiplyQuaternions(yawQuaternion, aircraft.group.quaternion);
        }
        
        // Pitch (Q/E) - rotate around local X axis (nose up/down)
        if (this.keys['KeyQ']) {
            pitchQuaternion.setFromAxisAngle(new THREE.Vector3(1, 0, 0), -pitchSpeed);
            aircraft.group.quaternion.multiplyQuaternions(aircraft.group.quaternion, pitchQuaternion);
        }
        if (this.keys['KeyE']) {
            pitchQuaternion.setFromAxisAngle(new THREE.Vector3(1, 0, 0), pitchSpeed);
            aircraft.group.quaternion.multiplyQuaternions(aircraft.group.quaternion, pitchQuaternion);
        }
        
        // Mouse look (subtle influence) - applied as world-space rotations
        if (Math.abs(this.mouse.x) > 0.01 || Math.abs(this.mouse.y) > 0.01) {
            // Yaw from mouse X
            yawQuaternion.setFromAxisAngle(new THREE.Vector3(0, 1, 0), this.mouse.x * 0.01);
            aircraft.group.quaternion.multiplyQuaternions(yawQuaternion, aircraft.group.quaternion);
            
            // Pitch from mouse Y
            pitchQuaternion.setFromAxisAngle(new THREE.Vector3(1, 0, 0), this.mouse.y * 0.01);
            aircraft.group.quaternion.multiplyQuaternions(aircraft.group.quaternion, pitchQuaternion);
        }
        
        // Throttle (Shift)
        if (this.keys['ShiftLeft'] || this.keys['ShiftRight']) {
            aircraft.thrust = Math.min(aircraft.thrust + 0.005, aircraft.maxThrust);
        } else {
            aircraft.thrust = Math.max(aircraft.thrust - 0.002, 0);
        }
        
        // Update propeller
        aircraft.updatePropeller();
    }
}