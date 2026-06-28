import DataManager from '../data/DataManager.js';
import SceneManager from './SceneManager.js';
import AnimationController from './AnimationController.js';
import InteractionManager from './InteractionManager.js';
import UIManager from '../ui/UIManager.js';
import MemoryManager from './MemoryManager.js';
import NarrativeManager from './NarrativeManager.js';
import AudioManager from './AudioManager.js';

export default class ExperienceManager {
    constructor() {
        this.dataManager = new DataManager();
        this.animationController = new AnimationController();
        this.sceneManager = new SceneManager(this.animationController);
        this.audioManager = new AudioManager();
        
        this.canvas = document.getElementById('universe-canvas');
        this.ctx = this.canvas.getContext('2d');
        
        this.isRunning = false;

        this.startTime = 0;
        this.lastFrameTime = 0;

        this.interactionManager = new InteractionManager(this.canvas);
        this.uiManager = new UIManager(this.animationController);
        this.memoryManager = null;
        this.narrativeManager = null;
        
        // Emotion tint overlay element
        this.emotionTint = document.getElementById('emotion-tint');
        this.currentEmotion = null;
        this.unlockedEmotionIds = new Set();

        // Emotion -> color map (from PROJECT_HOME.md section 9)
        this.emotionColors = {
            nostalgia: 'rgba(255, 167, 87, 0.08)',    // Sunset orange, very subtle
            calm:      'rgba(100, 140, 200, 0.06)',    // Dark navy blue
            hopeful:   'rgba(255, 215, 154, 0.07)',    // Soft gold
            longing:   'rgba(200, 100, 120, 0.07)',    // Dusty pink 
            joy:       'rgba(255, 220, 180, 0.06)'     // Warm white-gold
        };

        window.addEventListener('resize', this.onResize.bind(this));
    }

    async init() {
        await this.dataManager.loadAll();
        
        // Initialize Memory System and Narrative System
        const memoryData = this.dataManager.getMemories().memories;
        const narrativeData = this.dataManager.getNarration().universe; 
        const finalLetterData = this.dataManager.getMemories().final_letter;
        
        this.memoryManager = new MemoryManager(memoryData, this.uiManager, this.audioManager);
        this.narrativeManager = new NarrativeManager(narrativeData, this.uiManager, this.audioManager);
        this.narrativeManager.totalMemories = memoryData.length;
        
        // Pass the final letter data
        if (finalLetterData) {
            this.narrativeManager.setFinalLetterData(finalLetterData);
        }

        this.onResize();
        
        // Pass memory data to SceneManager so it can build constellations
        this.sceneManager.init(this.canvas, this.ctx, memoryData);
        this.uiManager.setSecretHandler(() => {
            this.sceneManager.triggerHomeStar();
            this.audioManager.playHome();
        });
        
        // Setup start screen
        const startScreen = document.getElementById('start-screen');
        startScreen.addEventListener('click', () => {
            startScreen.classList.add('hidden');
            
            // Unlocks browser audio (without blocking)
            this.audioManager.init();

            if (!this.isRunning) {
                this.isRunning = true;
                this.startTime = performance.now();
                this.lastFrameTime = this.startTime;
                this.uiManager.showExploreHint();
                this.render(this.startTime);
            }
        });
    }

    onResize() {
        this.canvas.width = window.innerWidth;
        this.canvas.height = window.innerHeight;
        this.sceneManager.onResize(this.canvas.width, this.canvas.height);
    }

    /**
     * Sets the emotion tint overlay based on the most recently unlocked memory's emotion.
     */
    _setEmotionTint(emotion) {
        if (emotion === this.currentEmotion) return;
        this.currentEmotion = emotion;
        
        const color = this.emotionColors[emotion];
        if (color && this.emotionTint) {
            this.emotionTint.style.backgroundColor = color;
            this.emotionTint.style.opacity = '1';
            
            // Fade it out after 8 seconds
            setTimeout(() => {
                this.emotionTint.style.opacity = '0';
            }, 8000);
        }
    }

    render() {
        if (!this.isRunning) return;

        const now = performance.now();
        const time = now - this.startTime;
        const dt = now - this.lastFrameTime;
        this.lastFrameTime = now;

        this.interactionManager.update(dt, this.canvas.width, this.canvas.height);

        // Get world cursor for memory checking
        let cursorWorld = null;
        if (this.interactionManager.presence > 0.01) {
            cursorWorld = this.interactionManager.getWorldPosition(this.sceneManager.camera);
        }

        // Update Memories
        const memoryStates = this.memoryManager.update(dt, cursorWorld, this.interactionManager.presence);
        
        // Check for newly unlocked memories to trigger emotion tint
        for (const id in memoryStates) {
            const state = memoryStates[id];
            if (state.justUnlocked && state.data.emotion && !this.unlockedEmotionIds.has(id)) {
                this.unlockedEmotionIds.add(id);
                this.uiManager.dismissExploreHint();
                this._setEmotionTint(state.data.emotion);
            }
        }

        // Update Narrative
        let unlockedCount = 0;
        for (const id in memoryStates) {
            if (memoryStates[id].isUnlocked) unlockedCount++;
        }
        this.narrativeManager.update(time, unlockedCount);
        
        // Check if all memories are unlocked to start final cinematic
        if (this.narrativeManager.finalSequenceReady && !this.finalSequenceStarted) {
            this.finalSequenceStarted = true;
            this.triggerFinalSequence();
        }

        // Apply convergence to scene
        this.sceneManager.setMainStarsConvergence(this.narrativeManager.convergenceProgress);

        // Update Audio fading
        this.audioManager.update(dt);

        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        
        this.sceneManager.update(time, this.interactionManager, memoryStates);
        
        requestAnimationFrame(this.render.bind(this));
    }

    /**
     * Executes the final cinematic sequence with precise pacing.
     */
    triggerFinalSequence() {
        // Disable manual interaction
        this.interactionManager.disabled = true;

        // 1. Slow zoom in to center as stars converge, and smoothly return camera pan to center (0,0)
        this.sceneManager.camera.transitionTo(0, 0, 1.5, 0.005, 0.001);
        gsap.to(this.interactionManager, {
            panX: 0,
            panY: 0,
            duration: 4,
            ease: "power2.inOut"
        });

        // Tell NarrativeManager to ease convergence over 4 seconds
        // (Wait, NarrativeManager handles it currently, let's just use GSAP here for the pacing since we need exact timings)
        gsap.to(this.narrativeManager, {
            convergenceProgress: 1.0,
            duration: 4,
            ease: "power2.inOut",
            onComplete: () => {
                // 2. Pause & glow intensely for 1 second
                // (MainStar.js bloom automatically intensifies when convergenceFactor == 1.0)
                
                setTimeout(() => {
                    // 3. EXPLOSION (Birth)
                    if (this.audioManager) this.audioManager.playTransformation();
                    this.sceneManager.triggerExplosion();
                    
                    // Merge stars into one
                    this.sceneManager.mergeMainStars();

                    // Camera pulls back slowly
                    this.sceneManager.camera.transitionTo(0, 0, 0.35, 0.005, 0.002);
                    
                    // Audio silence
                    if (this.audioManager) this.audioManager.fadeMusicVolume(0, 2);

                    setTimeout(() => {
                        // 4. Sunset transition
                        this.sceneManager.transitionToSunset();
                        
                        // Audio return
                        if (this.audioManager) this.audioManager.fadeMusicVolume(1, 4);

                        setTimeout(() => {
                            // 5. Meteor shower + Heart constellations
                            this.sceneManager.startMeteorShower();
                            this.sceneManager.revealHeartConstellations();

                            // 6. Letter
                            setTimeout(() => {
                                if (this.narrativeManager.finalLetterData) {
                                    this.uiManager.showFinalLetter(this.narrativeManager.finalLetterData);
                                }
                            }, 5000); // 5 seconds after sunset

                        }, 3000); // 3 seconds for sunset fade

                    }, 2500); // 2.5 seconds of silence and explosion bloom

                }, 1000); // 1 second glow pause
            }
        });
    }
}
