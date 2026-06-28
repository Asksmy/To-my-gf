/**
 * Star.js
 *
 * A single ambient star in the sky.
 * It does not behave like a UI element. It behaves like living light.
 *
 * Each star breathes — its opacity oscillates gently over time
 * using a sine wave with a unique phase offset so no two stars
 * pulse in unison.
 *
 * Stars are aware of the user's presence.
 * When someone is near, the star responds — gently, as if it noticed.
 */
export default class Star {
    /**
     * @param {number} x - World X
     * @param {number} y - World Y
     * @param {number} radius
     * @param {number} baseOpacity
     * @param {number} breathSpeed
     * @param {number} breathDepth
     * @param {number} phase
     * @param {string} color
     * @param {number} z - Depth (parallax factor)
     */
    constructor(x, y, radius, baseOpacity, breathSpeed, breathDepth, phase, color = '#FAF9F6', z = 1.0) {
        this.x = x;
        this.y = y;
        this.radius = radius;
        this.baseOpacity = baseOpacity;
        this.breathSpeed = breathSpeed;
        this.breathDepth = breathDepth;
        this.phase = phase;
        this.color = color;
        this.z = z;
    }

    /**
     * Computes the current opacity based on elapsed time.
     * @param {number} time - Total elapsed time in ms
     * @param {number} proximityBoost - Extra opacity from cursor proximity (0–1)
     * @returns {number} Current opacity (clamped 0–1)
     */
    getOpacity(time, proximityBoost = 0) {
        const breath = Math.sin(time * this.breathSpeed + this.phase);
        // Proximity deepens the breathing swing
        const effectiveDepth = this.breathDepth + proximityBoost * 0.15;
        const opacity = this.baseOpacity + breath * effectiveDepth + proximityBoost * 0.3;
        return Math.max(0, Math.min(1, opacity));
    }

    /**
     * Draws this star onto the canvas, with optional proximity awareness.
     * @param {CanvasRenderingContext2D} ctx
     * @param {number} screenX - Screen-space X after camera transform
     * @param {number} screenY - Screen-space Y after camera transform
     * @param {number} time - Elapsed time for breathing
     * @param {number} proximityBoost - 0 = no cursor nearby, 1 = cursor right on top (0–1)
     */
    draw(ctx, screenX, screenY, time, proximityBoost = 0) {
        const opacity = this.getOpacity(time, proximityBoost);
        if (opacity < 0.01) return;

        // Proximity gently expands the star
        const r = this.radius * (1 + proximityBoost * 0.5);

        ctx.save();
        ctx.globalAlpha = opacity;

        // Soft radial glow
        const gradient = ctx.createRadialGradient(screenX, screenY, 0, screenX, screenY, r);
        gradient.addColorStop(0, this.color);
        gradient.addColorStop(0.4, this.color);
        gradient.addColorStop(1, 'transparent');

        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(screenX, screenY, r, 0, Math.PI * 2);
        ctx.fill();

        ctx.restore();
    }
}
