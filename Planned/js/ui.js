class UISystem {
    constructor() {
        this.speedometerCanvas = null;
        this.speedometerCtx = null;
        this.createSpeedometer();
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
    
    updateSpeedometer(speed) {
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
        
        // Speed needle
        const maxSpeed = 500;
        const currentSpeed = Math.max(0, speed);
        const speedRatio = Math.min(currentSpeed / maxSpeed, 1);
        
        const needleAngle = speedRatio * Math.PI * 1.5 - Math.PI * 0.75;
        const needleX = 120 + Math.cos(needleAngle) * 80;
        const needleY = 120 + Math.sin(needleAngle) * 80;
        
        // Draw needle
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
        
        // Speed text
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 20px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(Math.round(currentSpeed), 120, 180);
    }
    
    updateAltimeter(altitude) {
        const altitudeIndicator = document.getElementById('altitude-indicator');
        if (altitudeIndicator) {
            const altitudePercent = Math.min(altitude / 200, 1);
            altitudeIndicator.style.bottom = `${10 + altitudePercent * 160}px`;
        }
    }
    
    updateBiomeDisplay(biomeName) {
        const biomeDisplay = document.getElementById('biome-display');
        if (biomeDisplay) {
            biomeDisplay.textContent = biomeName;
        }
    }
    
    showPauseMenu() {
        const pauseMenu = document.getElementById('pause-menu');
        if (pauseMenu) {
            pauseMenu.style.display = 'block';
        }
    }
    
    hidePauseMenu() {
        const pauseMenu = document.getElementById('pause-menu');
        if (pauseMenu) {
            pauseMenu.style.display = 'none';
        }
    }
    
    showCrashMessage() {
        const crashMessage = document.getElementById('crash-message');
        if (crashMessage) {
            crashMessage.style.display = 'block';
        }
    }
    
    hideCrashMessage() {
        const crashMessage = document.getElementById('crash-message');
        if (crashMessage) {
            crashMessage.style.display = 'none';
        }
    }
    
    update(aircraft) {
        this.updateSpeedometer(aircraft.speed);
        this.updateAltimeter(aircraft.altitude);
    }
}

// Global UI functions
function togglePause() {
    if (window.game) {
        window.game.togglePause();
    }
}

function toggleSound() {
    if (window.game && window.game.audioSystem) {
        window.game.audioSystem.toggleSound();
    }
}