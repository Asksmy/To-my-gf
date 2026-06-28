/**
 * ShootingStar.js
 *
 * Represents a brief, faint shooting star that streaks across the sky.
 */
export default class ShootingStar {
    constructor(x, y, angle, speed, length, lifeTime) {
        this.x = x;
        this.y = y;
        this.angle = angle;
        this.speed = speed;
        this.length = length;
        this.lifeTime = lifeTime;
        this.age = 0;
        this.dead = false;
        this.opacity = 0;
        
        // Random depth for parallax (usually far away)
        this.z = 0.3 + Math.random() * 0.4;
    }

    /**
     * @param {number} dt 
     */
    update(dt) {
        this.x += Math.cos(this.angle) * this.speed * dt;
        this.y += Math.sin(this.angle) * this.speed * dt;
        this.age += dt;

        if (this.age >= this.lifeTime) {
            this.dead = true;
        }

        // Smooth fade in and out (sine wave over lifetime)
        const progress = this.age / this.lifeTime;
        this.opacity = Math.sin(progress * Math.PI);
    }

    /**
     * @param {CanvasRenderingContext2D} ctx 
     * @param {import('./Camera.js').default} camera 
     */
    draw(ctx, camera) {
        const screen = camera.worldToScreen(this.x, this.y, this.z);
        
        // Calculate tail position in screen space
        // The tail points backward along the angle
        const tailX = screen.x - Math.cos(this.angle) * this.length;
        const tailY = screen.y - Math.sin(this.angle) * this.length;

        ctx.save();
        // Very subtle opacity
        ctx.globalAlpha = this.opacity * 0.4; 

        // Gradient fading to transparent
        const grad = ctx.createLinearGradient(screen.x, screen.y, tailX, tailY);
        grad.addColorStop(0, '#ffffff'); // bright head
        grad.addColorStop(1, 'rgba(255,255,255,0)'); // faded tail

        ctx.beginPath();
        ctx.moveTo(screen.x, screen.y);
        ctx.lineTo(tailX, tailY);
        ctx.strokeStyle = grad;
        ctx.lineWidth = 1.5;
        ctx.stroke();

        ctx.restore();
    }
}
