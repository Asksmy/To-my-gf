/**
 * InteractionManager.js
 *
 * Tracks mouse/touch presence for memory activation, and now tracks
 * drag/swipe gestures to pan the camera across the universe.
 * Implements an organic inertia model so panning glides to a stop.
 */
export default class InteractionManager {
    constructor(canvas) {
        this.canvas = canvas;

        // Current cursor position in screen-space (pixels)
        this.screenX = -9999;
        this.screenY = -9999;

        // Normalized cursor position (-1 to 1 from center)
        this.normalizedX = 0;
        this.normalizedY = 0;

        // Panning state
        this.isDragging = false;
        this.dragStartX = 0;
        this.dragStartY = 0;

        // Cinematic disable
        this.disabled = false;
        
        // The cumulative pan offset requested by the user
        this.panX = 0;
        this.panY = 0;
        
        // Inertia (velocity)
        this.velocityX = 0;
        this.velocityY = 0;
        this.lastEventTime = 0;

        // Fade-out logic for touch/presence
        this.presence = 0;
        this.presenceTarget = 0;
        this.presenceSpeed = 0.003;

        this._bindEvents();
    }

    _bindEvents() {
        // --- MOUSE ---
        this.canvas.addEventListener('mousedown', (e) => {
            if (this.disabled) return;
            this.isDragging = true;
            this.dragStartX = e.clientX;
            this.dragStartY = e.clientY;
            this.velocityX = 0;
            this.velocityY = 0;
            this.lastEventTime = performance.now();
        });

        this.canvas.addEventListener('mousemove', (e) => {
            if (this.disabled) return;
            this.screenX = e.clientX;
            this.screenY = e.clientY;
            this.presenceTarget = 1;

            if (this.isDragging) {
                const now = performance.now();
                const dt = Math.max(1, now - this.lastEventTime);
                
                const dx = e.clientX - this.dragStartX;
                const dy = e.clientY - this.dragStartY;
                
                // Subtract because dragging right means camera moves left to reveal left side
                this.panX -= dx;
                this.panY -= dy;
                
                // Track velocity for inertia
                this.velocityX = -dx / dt;
                this.velocityY = -dy / dt;
                
                this.dragStartX = e.clientX;
                this.dragStartY = e.clientY;
                this.lastEventTime = now;
            }
        });

        window.addEventListener('mouseup', () => {
            this.isDragging = false;
        });

        this.canvas.addEventListener('mouseleave', () => {
            this.presenceTarget = 0;
            this.isDragging = false;
        });

        // --- TOUCH ---
        this.canvas.addEventListener('touchstart', (e) => {
            if (this.disabled) return;
            const touch = e.touches[0];
            this.screenX = touch.clientX;
            this.screenY = touch.clientY;
            this.presenceTarget = 1;

            this.isDragging = true;
            this.dragStartX = touch.clientX;
            this.dragStartY = touch.clientY;
            this.velocityX = 0;
            this.velocityY = 0;
            this.lastEventTime = performance.now();
        }, { passive: false });

        this.canvas.addEventListener('touchmove', (e) => {
            e.preventDefault(); // prevent scrolling
            if (this.disabled) return;
            const touch = e.touches[0];
            this.screenX = touch.clientX;
            this.screenY = touch.clientY;
            this.presenceTarget = 1;

            if (this.isDragging) {
                const now = performance.now();
                const dt = Math.max(1, now - this.lastEventTime);

                const dx = touch.clientX - this.dragStartX;
                const dy = touch.clientY - this.dragStartY;

                this.panX -= dx;
                this.panY -= dy;

                this.velocityX = -dx / dt;
                this.velocityY = -dy / dt;

                this.dragStartX = touch.clientX;
                this.dragStartY = touch.clientY;
                this.lastEventTime = now;
            }
        }, { passive: false });

        this.canvas.addEventListener('touchend', () => {
            this.isDragging = false;
            this.presenceTarget = 0;
        });
    }

    /**
     * @param {number} dt 
     * @param {number} viewportWidth
     * @param {number} viewportHeight
     */
    update(dt, viewportWidth, viewportHeight) {
        // Presence Easing
        const diff = this.presenceTarget - this.presence;
        const step = this.presenceSpeed * dt;
        if (Math.abs(diff) < step) {
            this.presence = this.presenceTarget;
        } else {
            this.presence += Math.sign(diff) * step;
        }

        this.normalizedX = (this.screenX / viewportWidth - 0.5) * 2;
        this.normalizedY = (this.screenY / viewportHeight - 0.5) * 2;

        // Inertia only (no spring-back) — camera stays where the user left it
        if (!this.isDragging) {
            this.panX += this.velocityX * dt;
            this.panY += this.velocityY * dt;

            // Gentle friction to glide to a stop
            const friction = Math.exp(-0.003 * dt);
            this.velocityX *= friction;
            this.velocityY *= friction;

            // Stop completely when velocity is negligible
            if (Math.abs(this.velocityX) < 0.01) this.velocityX = 0;
            if (Math.abs(this.velocityY) < 0.01) this.velocityY = 0;
        }
    }

    /**
     * @param {import('../universe/Camera.js').default} camera
     */
    getWorldPosition(camera) {
        // Because of parallax, calculating world pos from screen pos requires knowing z.
        // For interactions (memories, main stars), we assume interaction plane is z=1
        const centerX = this.canvas.width / 2;
        const centerY = this.canvas.height / 2;
        
        const z = 1.0;
        const zoom = camera.zoom || 1.0;

        // Invert the camera projection:
        // screenX = centerX + (worldX - camera.x) * z * zoom
        // worldX = (screenX - centerX) / (z * zoom) + camera.x
        return {
            x: (this.screenX - centerX) / (z * zoom) + camera.x,
            y: (this.screenY - centerY) / (z * zoom) + camera.y
        };
    }
}
