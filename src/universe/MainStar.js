/**
 * MainStar.js
 *
 * The two main stars that represent the individuals in the relationship.
 * They have an outer glow that gently expands when the cursor is near,
 * creating a feeling of warmth and response.
 * They also accept a convergence pull to slowly drift closer together over time.
 * At full convergence, they bloom with a spectacular radiance.
 */
export default class MainStar {
    /**
     * @param {number} x - World-space base X
     * @param {number} y - World-space base Y
     * @param {object} options
     */
    constructor(x, y, options = {}) {
        this.baseX = x;
        this.baseY = y;
        this.x = x;
        this.y = y;
        this.targetX = x;
        this.targetY = y;

        this.coreColor = options.coreColor || '#FAF9F6';
        this.glowColor = options.glowColor || '#FFD79A';
        this.baseCoreRadius = options.coreRadius || 3;
        this.baseGlowRadius = options.glowRadius || 20;
        this.breathSpeed = options.breathSpeed || 0.0003;
        this.phase = options.phase || 0;

        // Base visual properties — always warm and glowing from the start
        this.glowBaseOpacity = 0.40;
        this.glowBreathDepth = 0.08;
        this.coreBaseOpacity = 0.90;
        this.coreBreathDepth = 0.10;

        // Interaction state
        this.proximityIntensity = 0; // 0 to 1

        // Interaction radius in world-space pixels
        this.interactionRadius = 120;

        // Convergence state
        this.convergenceFactor = 0;
    }

    /**
     * Set the convergence factor (0 to 1) pulling the star toward screen center.
     * At full convergence, stars nearly merge and bloom with light.
     * @param {number} factor 
     * @param {number} centerX 
     * @param {number} centerY 
     */
    setConvergence(factor, centerX, centerY) {
        this.convergenceFactor = factor;
        
        // At full convergence, they travel 100% of the way to center (fully touching)
        this.targetX = this.baseX + (centerX - this.baseX) * factor;
        this.targetY = this.baseY + (centerY - this.baseY) * factor;
    }

    /**
     * Extremely slow ease toward target coordinates.
     * @param {number} dt 
     */
    updatePosition(dt) {
        const diffX = this.targetX - this.x;
        const diffY = this.targetY - this.y;
        
        this.x += diffX * (dt * 0.00005); // Super slow movement
        this.y += diffY * (dt * 0.00005);
    }

    /**
     * Measures distance to cursor and updates internal state for visual bloom.
     * @param {{x:number, y:number}|null} cursorWorld 
     * @param {number} presence 
     * @returns {number} The computed proximity intensity (0 to 1)
     */
    computeProximity(cursorWorld, presence) {
        if (!cursorWorld || presence < 0.01) {
            this.proximityIntensity = 0;
            return 0;
        }

        const dx = cursorWorld.x - this.x;
        const dy = cursorWorld.y - this.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist > this.interactionRadius) {
            this.proximityIntensity = 0;
            return 0;
        }

        // Quadratic ease-out so it gets intensely warmer only very close
        const normalized = 1 - (dist / this.interactionRadius);
        this.proximityIntensity = normalized * normalized * presence;

        return this.proximityIntensity;
    }

    setMerged(isMerged) {
        this.isMerged = isMerged;
    }

    /**
     * Draws the main star with proximity-responsive bloom.
     * At high convergence, the stars grow brighter and larger — a visual climax.
     * @param {CanvasRenderingContext2D} ctx 
     * @param {number} screenX
     * @param {number} screenY
     * @param {number} time 
     */
    draw(ctx, screenX, screenY, time) {
        const breath = Math.sin(time * this.breathSpeed + this.phase);
        const cf = this.convergenceFactor; // 0 to 1

        // Convergence bloom: at factor 1.0, glow grows 4x and core grows 2x
        let convergenceGlowMultiplier = 1 + cf * 3.0;
        let convergenceCoreMultiplier = 1 + cf * 1.5;
        let convergenceOpacityBoost = cf * 0.4;
        
        if (this.isMerged) {
            // After explosion, they become a single permanent bright celestial body
            convergenceGlowMultiplier = 6.0;
            convergenceCoreMultiplier = 2.5;
            convergenceOpacityBoost = 0.6;
        }

        // Calculate dynamic radiuses
        const currentGlowRadius = (this.baseGlowRadius + (this.proximityIntensity * this.baseGlowRadius * 1.5)) * convergenceGlowMultiplier;
        const currentCoreRadius = (this.baseCoreRadius + (this.proximityIntensity * this.baseCoreRadius * 0.5)) * convergenceCoreMultiplier;

        // Calculate dynamic opacities
        const glowAlpha = this.glowBaseOpacity + (breath * this.glowBreathDepth) + (this.proximityIntensity * 0.20) + convergenceOpacityBoost;
        const coreAlpha = this.coreBaseOpacity + (breath * this.coreBreathDepth) + (this.proximityIntensity * 0.15) + convergenceOpacityBoost;

        ctx.save();

        // At high convergence, add an extra warm outer halo
        if (cf > 0.7 || this.isMerged) {
            const haloIntensity = this.isMerged ? 1.0 : (cf - 0.7) / 0.3; // 0 to 1 over the last 30%
            const haloRadius = currentGlowRadius * 2.5;
            ctx.globalAlpha = haloIntensity * 0.15;
            const haloGrad = ctx.createRadialGradient(screenX, screenY, 0, screenX, screenY, haloRadius);
            haloGrad.addColorStop(0, '#FFD79A');
            haloGrad.addColorStop(0.5, 'rgba(255, 215, 154, 0.3)');
            haloGrad.addColorStop(1, 'rgba(0,0,0,0)');
            ctx.fillStyle = haloGrad;
            ctx.beginPath();
            ctx.arc(screenX, screenY, haloRadius, 0, Math.PI * 2);
            ctx.fill();
        }

        // 1. Draw outer glow (Radial Gradient)
        if (currentGlowRadius > 0) {
            ctx.globalAlpha = Math.max(0, Math.min(1, glowAlpha));
            const grad = ctx.createRadialGradient(screenX, screenY, 0, screenX, screenY, currentGlowRadius);
            grad.addColorStop(0, this.isMerged ? '#FFF5E8' : this.glowColor);
            grad.addColorStop(1, 'rgba(0,0,0,0)');
            
            ctx.fillStyle = grad;
            ctx.beginPath();
            ctx.arc(screenX, screenY, currentGlowRadius, 0, Math.PI * 2);
            ctx.fill();
        }

        // 2. Draw solid core
        ctx.globalAlpha = Math.max(0, Math.min(1, coreAlpha));
        ctx.fillStyle = this.coreColor;
        ctx.beginPath();
        ctx.arc(screenX, screenY, currentCoreRadius, 0, Math.PI * 2);
        ctx.fill();

        ctx.restore();
    }
}
