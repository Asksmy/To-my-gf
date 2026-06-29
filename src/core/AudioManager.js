/**
 * AudioManager.js
 *
 * Handles the emotional soundscape of the universe.
 * Uses Vanilla HTML5 Audio with software-driven cross-fading.
 * Gracefully handles missing files so the experience doesn't break if mp3s are absent.
 */
export default class AudioManager {
    constructor() {
        const finalVoiceSource = this._getSupportedFinalVoiceSource();

        // Define the audio objects. We look for them in data/audio/
        this.tracks = {
            ambient: new Audio('./data/audio/ambient.mp3'),
            memory: new Audio('./data/audio/memory.mp3'),
            narrative: new Audio('./data/audio/narrative.mp3'),
            finalVoice: new Audio(finalVoiceSource)
        };

        // Ambient track should loop forever
        this.tracks.ambient.loop = true;

        // Store target volumes for fading
        this.volumes = {
            ambient: { current: 0, target: 0, speed: 0.0002 },
            memory: { current: 0, target: 0, speed: 0.005 },
            narrative: { current: 0, target: 0, speed: 0.002 },
            finalVoice: { current: 0, target: 0, speed: 0.01 }
        };

        // Initialize all tracks to volume 0
        for (const key in this.tracks) {
            this.tracks[key].volume = 0;
            this.tracks[key].preload = "auto";
        }

        this.initialized = false;
        this.usingGeneratedAmbient = false;
        this.audioContext = null;
        this.generatedGain = null;
        this.generatedOscillators = [];
        this.memoryStep = 0;
        this.finalPadGain = null;
        this.finalPadNodes = [];

        this.tracks.finalVoice.addEventListener('ended', () => {
            this.volumes.finalVoice.target = 0;
            this.volumes.ambient.target = Math.max(this.volumes.ambient.target, 0.35);
            this._setFinalAmbientBed(0.018, 2.8);
        });
    }

    _getSupportedFinalVoiceSource() {
        const probe = document.createElement('audio');
        if (probe.canPlayType('audio/mpeg')) {
            return './data/audio/final-voice.mp3';
        }
        return './data/audio/final-voice.ogg';
    }

    /**
     * Must be called inside a user interaction event (like click)
     * to unlock the browser's audio engine.
     */
    async init() {
        if (this.initialized) return;
        this.initialized = true;
        const ctx = this._ensureAudioContext();
        if (ctx?.state === 'suspended') {
            await ctx.resume();
        }

        await this._primeFinalVoiceForMobile();

        // Attempt to play ambient track, catching any errors if the file is missing
        try {
            await this.tracks.ambient.play();
            // If it succeeds, start fading it in
            this.volumes.ambient.target = 0.5; // Ambient max volume
        } catch (e) {
            console.info("Using generated ambient audio fallback.");
            this._startGeneratedAmbient();
        }
    }

    async _primeFinalVoiceForMobile() {
        const track = this.tracks.finalVoice;
        try {
            track.muted = true;
            track.volume = 0;
            await track.play();
            track.pause();
            track.currentTime = 0;
            track.muted = false;
        } catch (e) {
            track.muted = false;
        }
    }

    playMemory(emotion = 'nostalgia') {
        this._playMemoryVariation(emotion);
    }

    playNarrative() {
        this._playOneShot('narrative', 0.6);
    }

    async _playOneShot(trackId, targetVolume) {
        if (!this.initialized) return;
        
        try {
            const track = this.tracks[trackId];
            track.currentTime = 0;
            track.volume = 0;
            this.volumes[trackId].current = 0;
            this.volumes[trackId].target = targetVolume;
            
            await track.play();
        } catch (e) {
            console.info(`Using generated ${trackId} audio fallback.`);
            this._playGeneratedChime(trackId, targetVolume);
        }
    }

    _ensureAudioContext() {
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        if (!AudioCtx) return null;
        this.audioContext = this.audioContext || new AudioCtx();
        return this.audioContext;
    }

    _startGeneratedAmbient() {
        if (this.usingGeneratedAmbient) return;

        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        if (!AudioCtx) return;

        this.audioContext = this.audioContext || new AudioCtx();
        this.generatedGain = this.audioContext.createGain();
        this.generatedGain.gain.value = 0;
        this.generatedGain.connect(this.audioContext.destination);

        const tones = [146.83, 220, 329.63];
        tones.forEach((freq, index) => {
            const osc = this.audioContext.createOscillator();
            const gain = this.audioContext.createGain();

            osc.type = 'sine';
            osc.frequency.value = freq;
            gain.gain.value = 0.035 / (index + 1);
            osc.connect(gain);
            gain.connect(this.generatedGain);
            osc.start();
            this.generatedOscillators.push({ osc, gain });
        });

        this.usingGeneratedAmbient = true;
        this.volumes.ambient.target = 0.18;
    }

    _playSoftTone(freq, start, duration, peakGain, type = 'sine', destination = null) {
        const ctx = this._ensureAudioContext();
        if (!ctx) return;

        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        const out = destination || ctx.destination;

        osc.type = type;
        osc.frequency.setValueAtTime(freq, start);
        gain.gain.setValueAtTime(0.0001, start);
        gain.gain.exponentialRampToValueAtTime(Math.max(0.0002, peakGain), start + 0.08);
        gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);

        osc.connect(gain);
        gain.connect(out);
        osc.start(start);
        osc.stop(start + duration + 0.05);
    }

    _startFinalAmbientBed() {
        const ctx = this._ensureAudioContext();
        if (!ctx) return;

        if (this.finalPadGain) {
            this.finalPadGain.gain.setTargetAtTime(0.052, ctx.currentTime, 1.8);
            return;
        }

        const master = ctx.createGain();
        const filter = ctx.createBiquadFilter();
        const delay = ctx.createDelay();
        const feedback = ctx.createGain();

        master.gain.value = 0.0001;
        filter.type = 'lowpass';
        filter.frequency.value = 780;
        delay.delayTime.value = 0.58;
        feedback.gain.value = 0.18;

        master.connect(filter);
        filter.connect(ctx.destination);
        filter.connect(delay);
        delay.connect(feedback);
        feedback.connect(delay);
        delay.connect(ctx.destination);

        [
            { freq: 130.81, detune: -7, gain: 0.32 },
            { freq: 196.00, detune: 5, gain: 0.23 },
            { freq: 246.94, detune: -3, gain: 0.18 },
            { freq: 329.63, detune: 4, gain: 0.12 }
        ].forEach(({ freq, detune, gain }) => {
            const osc = ctx.createOscillator();
            const oscGain = ctx.createGain();
            osc.type = 'sine';
            osc.frequency.value = freq;
            osc.detune.value = detune;
            oscGain.gain.value = gain;
            osc.connect(oscGain);
            oscGain.connect(master);
            osc.start();
            this.finalPadNodes.push({ osc, oscGain });
        });

        this.finalPadGain = master;
        master.gain.setTargetAtTime(0.052, ctx.currentTime, 2.2);
    }

    _setFinalAmbientBed(target, softness = 1.5) {
        const ctx = this._ensureAudioContext();
        if (!ctx || !this.finalPadGain) return;
        this.finalPadGain.gain.setTargetAtTime(target, ctx.currentTime, softness);
    }

    _playMemoryVariation(emotion = 'nostalgia') {
        if (!this.initialized) return;
        const ctx = this._ensureAudioContext();
        if (!ctx) return;

        const palettes = {
            nostalgia: [[392, 493.88, 659.25], 'sine', 0.034],
            joy: [[523.25, 659.25, 783.99, 1046.5], 'triangle', 0.03],
            calm: [[329.63, 392, 493.88], 'sine', 0.026],
            longing: [[440, 523.25, 622.25], 'sine', 0.028],
            hopeful: [[493.88, 587.33, 739.99, 987.77], 'triangle', 0.028]
        };

        const [notes, wave, gain] = palettes[emotion] || palettes.nostalgia;
        const now = ctx.currentTime;
        const output = ctx.createGain();
        const delay = ctx.createDelay();
        const feedback = ctx.createGain();

        output.gain.value = 0.82;
        delay.delayTime.value = 0.22;
        feedback.gain.value = 0.16;
        output.connect(ctx.destination);
        output.connect(delay);
        delay.connect(feedback);
        feedback.connect(delay);
        delay.connect(ctx.destination);

        const offset = this.memoryStep % notes.length;
        this.memoryStep += 1;

        notes.forEach((baseFreq, index) => {
            const freq = notes[(index + offset) % notes.length] * (0.985 + Math.random() * 0.03);
            const start = now + index * 0.13;
            const duration = 1.15 + index * 0.08;
            this._playSoftTone(freq, start, duration, gain / (1 + index * 0.18), wave, output);
        });
    }

    _playGeneratedChime(trackId, targetVolume) {
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        if (!AudioCtx) return;

        this.audioContext = this.audioContext || new AudioCtx();
        const now = this.audioContext.currentTime;
        const out = this.audioContext.createGain();
        out.gain.setValueAtTime(0, now);
        out.gain.linearRampToValueAtTime(Math.min(0.18, targetVolume * 0.18), now + 0.08);
        out.gain.exponentialRampToValueAtTime(0.001, now + 1.8);
        out.connect(this.audioContext.destination);

        const base = trackId === 'narrative' ? 392 : 523.25;
        [base, base * 1.5].forEach((freq, index) => {
            const osc = this.audioContext.createOscillator();
            const gain = this.audioContext.createGain();

            osc.type = 'sine';
            osc.frequency.setValueAtTime(freq, now);
            gain.gain.value = index === 0 ? 0.55 : 0.25;
            osc.connect(gain);
            gain.connect(out);
            osc.start(now);
            osc.stop(now + 1.9);
        });
    }

    /**
     * Called every frame to handle smooth volume fading.
     * @param {number} dt - delta time in ms
     */
    update(dt) {
        for (const key in this.volumes) {
            const state = this.volumes[key];
            const track = this.tracks[key];

            const diff = state.target - state.current;
            const step = state.speed * dt;

            if (Math.abs(diff) < step) {
                state.current = state.target;
            } else {
                state.current += Math.sign(diff) * step;
            }

            // Apply to actual audio element
            if (!isNaN(state.current)) {
                // Audio volume must be between 0 and 1
                track.volume = Math.max(0, Math.min(1, state.current));
            }
        }

        if (this.generatedGain) {
            const target = this.volumes.ambient.current;
            this.generatedGain.gain.setTargetAtTime(target, this.audioContext.currentTime, 0.8);
        }
    }


    playTransformation() {
        if (!this.initialized) return;
        const ctx = this._ensureAudioContext();
        if (!ctx) return;

        const now = ctx.currentTime;
        const master = ctx.createGain();
        master.gain.setValueAtTime(0.0001, now);
        master.gain.exponentialRampToValueAtTime(0.42, now + 0.35);
        master.gain.exponentialRampToValueAtTime(0.001, now + 5.8);
        master.connect(ctx.destination);

        const low = ctx.createOscillator();
        const lowGain = ctx.createGain();
        low.type = 'sine';
        low.frequency.setValueAtTime(88, now);
        low.frequency.exponentialRampToValueAtTime(42, now + 2.4);
        lowGain.gain.setValueAtTime(0.0001, now);
        lowGain.gain.exponentialRampToValueAtTime(0.32, now + 0.18);
        lowGain.gain.exponentialRampToValueAtTime(0.001, now + 3.0);
        low.connect(lowGain);
        lowGain.connect(master);
        low.start(now);
        low.stop(now + 3.1);

        [220, 277.18, 329.63, 440, 659.25, 880].forEach((freq, index) => {
            this._playSoftTone(freq, now + 0.35 + index * 0.18, 2.4 + index * 0.12, 0.045 / (1 + index * 0.08), index % 2 ? 'triangle' : 'sine', master);
        });

        const bufferSize = Math.floor(ctx.sampleRate * 1.8);
        const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
            const decay = 1 - i / bufferSize;
            data[i] = (Math.random() * 2 - 1) * decay * decay;
        }

        const noise = ctx.createBufferSource();
        const filter = ctx.createBiquadFilter();
        const noiseGain = ctx.createGain();
        noise.buffer = buffer;
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(900, now);
        filter.frequency.exponentialRampToValueAtTime(140, now + 1.8);
        noiseGain.gain.setValueAtTime(0.0001, now);
        noiseGain.gain.exponentialRampToValueAtTime(0.16, now + 0.08);
        noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 1.8);
        noise.connect(filter);
        filter.connect(noiseGain);
        noiseGain.connect(master);
        noise.start(now + 0.12);
        noise.stop(now + 2.0);
    }

    playHome() {
        if (!this.initialized) return;
        const ctx = this._ensureAudioContext();
        if (!ctx) return;

        this._startFinalAmbientBed();

        const now = ctx.currentTime;
        const master = ctx.createGain();
        master.gain.setValueAtTime(0.0001, now);
        master.gain.exponentialRampToValueAtTime(0.26, now + 0.4);
        master.gain.exponentialRampToValueAtTime(0.001, now + 6.5);
        master.connect(ctx.destination);

        [196, 246.94, 329.63, 392, 493.88].forEach((freq, index) => {
            this._playSoftTone(freq, now + index * 0.18, 5.2 - index * 0.25, 0.045 / (1 + index * 0.2), 'sine', master);
        });

        setTimeout(() => this._setFinalAmbientBed(0.026, 2.4), 5900);
        setTimeout(() => this.playFinalVoice(), 7200);
    }

    async playFinalVoice() {
        if (!this.initialized) return;

        try {
            const track = this.tracks.finalVoice;
            track.muted = false;
            track.currentTime = 0;
            track.volume = 0;
            this.volumes.finalVoice.current = 0;
            this.volumes.finalVoice.target = 0.9;
            this.volumes.ambient.target = Math.min(this.volumes.ambient.target, 0.22);
            this._setFinalAmbientBed(0.012, 1.4);
            await track.play();
        } catch (e) {
            console.info("Final voice note unavailable.");
            this._setFinalAmbientBed(0.022, 2.2);
        }
    }
    fadeMusicVolume(targetVolume, durationSecs) {
        const diff = targetVolume - this.volumes.ambient.current;
        const frames = (durationSecs * 1000) / 16;
        this.volumes.ambient.target = targetVolume;
        this.volumes.ambient.speed = Math.abs(diff / frames) || 0.005;
    }
}
