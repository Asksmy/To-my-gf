/**
 * MemoryManager.js
 *
 * Tracks memories and their states.
 * Rewards patience: if the user lingers near a memory's coordinates,
 * the memory unlocks and triggers the UI and Constellation.
 */
export default class MemoryManager {
    constructor(memoriesData, uiManager, audioManager) {
        this.uiManager = uiManager;
        this.audioManager = audioManager;
        this.memories = {};

        // Configuration
        this.lingerThreshold = 1000; 
        this.lingerRadius = 200; // Needs to be generous so it's easy to discover

        for (const memory of memoriesData) {
            this.memories[memory.id] = {
                data: memory,
                lingerTime: 0,
                isUnlocked: false,
                isNear: false,
                lingerProgress: 0 
            };
        }
    }

    /**
     * Checks all memories against cursor position and handles unlocking.
     * @param {number} dt 
     * @param {{x:number, y:number}|null} cursorWorld 
     * @param {number} presence 
     * @returns {Object} Map of memoryId -> { isUnlocked, lingerProgress, isNear, data }
     */
    update(dt, cursorWorld, presence) {
        const memoryStates = {};

        for (const id in this.memories) {
            const state = this.memories[id];
            const memory = state.data;
            let isNear = false;

            // Check distance
            if (cursorWorld && presence > 0.5) {
                const dx = memory.worldX - cursorWorld.x;
                const dy = memory.worldY - cursorWorld.y;
                const dist = Math.sqrt(dx * dx + dy * dy);

                if (dist < this.lingerRadius) {
                    isNear = true;
                }
            }

            state.isNear = isNear;

            // Accumulate or decay linger time
            if (isNear) {
                state.lingerTime += dt;
                
                if (!state.isUnlocked) {
                    state.lingerProgress = Math.min(1, state.lingerTime / this.lingerThreshold);
                    if (state.lingerTime >= this.lingerThreshold) {
                        state.isUnlocked = true;
                        state.justUnlocked = true;
                        if (this.audioManager) this.audioManager.playMemory(memory.emotion, memory.id);
                        this._onUnlock(memory);
                    }
                }
            } else {
                state.lingerTime = Math.max(0, state.lingerTime - dt * 2);
                state.lingerProgress = Math.min(1, state.lingerTime / this.lingerThreshold);
            }

            // Export state for the SceneManager
            memoryStates[id] = {
                isUnlocked: state.isUnlocked,
                justUnlocked: Boolean(state.justUnlocked),
                lingerProgress: state.lingerProgress,
                isNear: isNear,
                data: memory
            };

            state.justUnlocked = false;
        }

        return memoryStates;
    }

    _onUnlock(memory) {
        if (memory.narration) {
            this.uiManager.showNarration(memory.narration);
        }
    }
}
