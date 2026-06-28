/**
 * NarrativeManager.js
 *
 * Observes the state of the experience and triggers the "Voice of the Universe"
 * as well as major scene transitions (like the convergence of Main Stars).
 * Scales to the current memory set with progressive milestones and a final letter.
 */
export default class NarrativeManager {
    constructor(narrationData, uiManager, audioManager) {
        this.narrations = {};
        if (Array.isArray(narrationData)) {
            narrationData.forEach(n => {
                this.narrations[n.id] = n;
            });
        }
        
        this.uiManager = uiManager;
        this.audioManager = audioManager;
        
        // Sequence state
        this.introShown = false;
        this.memoriesUnlocked = 0;
        this.shownMilestones = new Set(); // Track which milestone narrations we've shown
        
        // Final convergence state
        this.convergenceProgress = 0; // 0 to 1
        this.totalMemories = 15;

        // Final letter
        this.finalLetterShown = false;
        this.finalLetterData = null;
        this.finalSequenceReady = false;

        // Ambient tint for emotion effects
        this.currentTint = null;
        this.tintOpacity = 0;
    }

    setFinalLetterData(data) {
        this.finalLetterData = data;
    }

    /**
     * Updates the narrative state based on time and memory progression.
     * @param {number} timeElapsed - ms since start
     * @param {number} unlockedCount - number of memories unlocked so far
     */
    update(timeElapsed, unlockedCount) {
        // 1. The Universe Awakens (Intro)
        if (!this.introShown && timeElapsed > 2000) {
            this.introShown = true;
            if (this.audioManager) this.audioManager.playNarrative();
            this._show('intro');
        }

        // 2. Reactions to milestones
        if (unlockedCount !== this.memoriesUnlocked) {
            this.memoriesUnlocked = unlockedCount;
            
            // Convergence increases smoothly with each memory
            this.convergenceProgress = Math.min(1, this.memoriesUnlocked / this.totalMemories);

            const halfwayAt = Math.max(2, Math.ceil(this.totalMemories * 0.5));
            const convergenceAt = Math.max(halfwayAt + 1, Math.ceil(this.totalMemories * 0.85));

            // Milestone: first memory
            if (this.memoriesUnlocked === 1 && !this.shownMilestones.has('first')) {
                this.shownMilestones.add('first');
                setTimeout(() => {
                    if (this.audioManager) this.audioManager.playNarrative();
                    this._show('first_memory');
                }, 12000); 
            }

            // Milestone: emotional midpoint
            if (this.memoriesUnlocked >= halfwayAt && !this.shownMilestones.has('halfway')) {
                this.shownMilestones.add('halfway');
                setTimeout(() => {
                    if (this.audioManager) this.audioManager.playNarrative();
                    this._show('halfway');
                }, 9500);
            }

            // Milestone: almost there
            if (this.memoriesUnlocked >= convergenceAt && this.memoriesUnlocked < this.totalMemories && !this.shownMilestones.has('convergence')) {
                this.shownMilestones.add('convergence');
                setTimeout(() => {
                    if (this.audioManager) this.audioManager.playNarrative();
                    this._show('convergence');
                }, 9000);
            }

            // All memories found: show final narration, then let ExperienceManager run the cinematic.
            if (this.memoriesUnlocked >= this.totalMemories && !this.finalLetterShown) {
                this.finalLetterShown = true;
                this.convergenceProgress = 1.0;
                
                setTimeout(() => {
                    if (this.audioManager) this.audioManager.playNarrative();
                    this._show('final');

                    const finalDuration = this.narrations.final?.duration ?? 10000;
                    setTimeout(() => {
                        this.finalSequenceReady = true;
                    }, finalDuration + 4500);
                }, 8500);
            }
        }
    }

    /**
     * Returns the current emotional tint color and opacity for the scene.
     */
    getEmotionTint() {
        return {
            color: this.currentTint,
            opacity: this.tintOpacity
        };
    }

    _show(id) {
        const data = this.narrations[id];
        if (data) {
            this.uiManager.showUniverseNarration(data.text, data.duration);
        }
    }
}
