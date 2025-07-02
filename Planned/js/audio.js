class AudioSystem {
    constructor() {
        this.audioContext = null;
        this.motorGain = null;
        this.motorOscillator = null;
        this.audioInitialized = false;
        this.audioStopped = false;
        this.audioEndedRecently = false;
        this.audioCreationPending = false;
        this.soundEnabled = true;
    }
    
    init() {
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
        
        this.audioCreationPending = false;
        
        setTimeout(() => {
            this.audioStopped = false;
        }, 100);
    }
    
    updateMotorSound(thrust, speed, crashed) {
        if (!this.audioContext || !this.soundEnabled || crashed || this.audioCreationPending || this.audioStopped) return;
        
        if (this.audioContext.state === 'suspended') {
            this.audioContext.resume();
        }
        
        const baseFrequency = 40;
        const frequency = baseFrequency + thrust * 60 + speed * 0.3;
        const volume = Math.max(0.02, 0.05 + thrust * 0.15);
        
        if (!this.motorOscillator && this.audioContext && !this.audioCreationPending && !this.audioEndedRecently) {
            this.audioCreationPending = true;
            try {
                this.motorOscillator = this.audioContext.createOscillator();
                this.motorOscillator.type = 'sawtooth';
                this.motorOscillator.frequency.setValueAtTime(frequency, this.audioContext.currentTime);
                this.motorOscillator.connect(this.motorGain);
                this.motorOscillator.start();
                
                this.motorOscillator.onended = () => {
                    this.motorOscillator = null;
                    this.audioCreationPending = false;
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
        
        if (this.motorOscillator && this.motorGain) {
            try {
                this.motorOscillator.frequency.setValueAtTime(frequency, this.audioContext.currentTime);
                this.motorGain.gain.setValueAtTime(volume, this.audioContext.currentTime);
            } catch (e) {
                console.warn('Failed to update motor sound:', e);
                this.motorOscillator = null;
            }
        }
    }
    
    playExplosionSound() {
        if (!this.audioContext || !this.soundEnabled) return;
        
        try {
            const explosionGain = this.audioContext.createGain();
            explosionGain.connect(this.audioContext.destination);
            
            const bufferSize = this.audioContext.sampleRate * 0.5;
            const buffer = this.audioContext.createBuffer(1, bufferSize, this.audioContext.sampleRate);
            const output = buffer.getChannelData(0);
            
            for (let i = 0; i < bufferSize; i++) {
                output[i] = Math.random() * 2 - 1;
            }
            
            const explosionSource = this.audioContext.createBufferSource();
            explosionSource.buffer = buffer;
            explosionSource.connect(explosionGain);
            
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
    
    playFiringSound() {
        if (!this.audioContext || !this.soundEnabled) return;
        
        try {
            const firingGain = this.audioContext.createGain();
            firingGain.connect(this.audioContext.destination);
            
            const firingOsc = this.audioContext.createOscillator();
            firingOsc.type = 'square';
            firingOsc.frequency.setValueAtTime(800, this.audioContext.currentTime);
            firingOsc.connect(firingGain);
            
            const currentTime = this.audioContext.currentTime;
            firingGain.gain.setValueAtTime(0, currentTime);
            firingGain.gain.linearRampToValueAtTime(0.1, currentTime + 0.01);
            firingGain.gain.exponentialRampToValueAtTime(0.01, currentTime + 0.1);
            
            firingOsc.start(currentTime);
            firingOsc.stop(currentTime + 0.1);
        } catch (e) {
            console.warn('Failed to play firing sound:', e);
        }
    }
    
    toggleSound() {
        this.soundEnabled = !this.soundEnabled;
        if (!this.soundEnabled) {
            this.stopAllAudio();
        }
        
        const soundButton = document.querySelector('button[onclick="toggleSound()"]');
        if (soundButton) {
            soundButton.textContent = this.soundEnabled ? 'Sound: ON' : 'Sound: OFF';
        }
    }
}