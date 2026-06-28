/**
 * Constellation.js
 *
 * A visual grouping of stars connected by delicate threads of light.
 * Represents an awakened memory.
 */
export default class Constellation {
    /**
     * @param {string} id
     * @param {Array<{x:number, y:number}>} starPositions - Local offsets from center
     * @param {string} color - CSS color string for the threads
     */
    constructor(id, starPositions, color) {
        this.id = id;
        this.stars = starPositions;
        this.color = color;
        this.opacity = 0;
        this.targetOpacity = 0;
        this.drawProgress = 1.0; // 0.0 to 1.0
    }

    /**
     * Tells the constellation to fade in or out.
     */
    setTargetOpacity(target) {
        this.targetOpacity = target;
    }

    /**
     * Draw the connecting lines.
     * @param {CanvasRenderingContext2D} ctx
     * @param {import('./Camera.js').default} camera
     * @param {number} worldX - Center X of the constellation
     * @param {number} worldY - Center Y of the constellation
     * @param {number} dt - Delta time
     */
    draw(ctx, camera, worldX, worldY, dt) {
        // Ease opacity
        const diff = this.targetOpacity - this.opacity;
        if (Math.abs(diff) < 0.001) {
            this.opacity = this.targetOpacity;
        } else {
            this.opacity += diff * (1 - Math.exp(-0.002 * dt));
        }

        if (this.opacity < 0.01) return;

        ctx.save();
        ctx.globalAlpha = this.opacity;
        ctx.strokeStyle = this.color;
        ctx.lineWidth = 0.5;
        
        ctx.beginPath();
        const totalSegments = this.stars.length - 1;
        const segmentsToDraw = totalSegments * this.drawProgress;
        
        for (let i = 0; i < this.stars.length; i++) {
            const screen = camera.worldToScreen(worldX + this.stars[i].x, worldY + this.stars[i].y);
            
            if (i === 0) {
                ctx.moveTo(screen.x, screen.y);
            } else {
                const segmentIndex = i - 1;
                if (segmentIndex < segmentsToDraw) {
                    // Partially draw the last segment if needed
                    if (segmentIndex + 1 > segmentsToDraw) {
                        const prevScreen = camera.worldToScreen(worldX + this.stars[i-1].x, worldY + this.stars[i-1].y);
                        const progress = segmentsToDraw - segmentIndex;
                        const partialX = prevScreen.x + (screen.x - prevScreen.x) * progress;
                        const partialY = prevScreen.y + (screen.y - prevScreen.y) * progress;
                        ctx.lineTo(partialX, partialY);
                    } else {
                        ctx.lineTo(screen.x, screen.y);
                    }
                }
            }
        }
        
        // Connect back to first to close shape occasionally, or leave open.
        // Let's leave it open for a more organic, branching look.
        ctx.stroke();

        // Draw faint glowing nodes at the vertices
        ctx.fillStyle = '#FAF9F6';
        for (let i = 0; i < this.stars.length; i++) {
            const screen = camera.worldToScreen(worldX + this.stars[i].x, worldY + this.stars[i].y);
            ctx.beginPath();
            ctx.arc(screen.x, screen.y, 1.5, 0, Math.PI*2);
            ctx.fill();
        }

        ctx.restore();
    }
}
