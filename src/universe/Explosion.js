/**
 * Explosion.js
 * 
 * Handles the "soft birth" explosion at the climax of the experience.
 * Emits soft circular waves and warm dust particles.
 */
export default class Explosion {
    constructor(x, y, options = {}) {
        this.x = x;
        this.y = y;
        this.particles = [];
        this.waves = [];
        this.active = true;
        this.age = 0;
        this.duration = 4000; // 4 seconds total duration
        this.performanceMode = Boolean(options.performanceMode);

        // Generate warm dust particles
        const colors = ['#FFD79A', '#FFF5E8', '#FFB0B0', '#C8A2C8', '#FFD700'];
        const particleCount = this.performanceMode ? 90 : 200;
        for (let i = 0; i < particleCount; i++) {
            const angle = Math.random() * Math.PI * 2;
            const speed = 0.05 + Math.random() * 0.4;
            const radius = 1 + Math.random() * 4;
            const color = colors[Math.floor(Math.random() * colors.length)];
            const lifetime = 2000 + Math.random() * 2000;
            
            this.particles.push({
                x: this.x,
                y: this.y,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed,
                radius: radius,
                color: color,
                alpha: 1.0,
                age: 0,
                lifetime: lifetime,
                drag: 0.98 + Math.random() * 0.015 // Particles slow down organically
            });
        }

        // Generate soft light waves
        for (let i = 0; i < 3; i++) {
            this.waves.push({
                radius: 0,
                speed: 0.3 + (i * 0.15),
                alpha: 0.6 - (i * 0.15),
                color: colors[i % colors.length]
            });
        }
    }

    update(dt) {
        this.age += dt;
        if (this.age > this.duration) {
            this.active = false;
        }

        // Update particles
        for (const p of this.particles) {
            p.age += dt;
            p.x += p.vx * dt;
            p.y += p.vy * dt;
            p.vx *= Math.pow(p.drag, dt / 16);
            p.vy *= Math.pow(p.drag, dt / 16);
            
            // Fade out in the second half of life
            if (p.age > p.lifetime * 0.5) {
                p.alpha = 1.0 - ((p.age - p.lifetime * 0.5) / (p.lifetime * 0.5));
            }
        }

        // Update waves
        for (const w of this.waves) {
            w.radius += w.speed * dt;
            w.alpha *= Math.pow(0.99, dt / 16); // Fade out over time
        }
    }

    draw(ctx, camera) {
        ctx.save();
        
        // Draw waves
        for (const w of this.waves) {
            if (w.alpha > 0.01) {
                const screen = camera.worldToScreen(this.x, this.y, 1.0);
                // Adjust wave radius by camera zoom
                const apparentRadius = w.radius * camera.zoom;
                
                ctx.globalAlpha = w.alpha;
                const grad = ctx.createRadialGradient(screen.x, screen.y, apparentRadius * 0.8, screen.x, screen.y, apparentRadius);
                grad.addColorStop(0, 'rgba(0,0,0,0)');
                grad.addColorStop(0.5, w.color);
                grad.addColorStop(1, 'rgba(0,0,0,0)');
                
                ctx.fillStyle = grad;
                ctx.beginPath();
                ctx.arc(screen.x, screen.y, apparentRadius, 0, Math.PI * 2);
                ctx.fill();
            }
        }

        // Draw particles
        for (const p of this.particles) {
            if (p.alpha > 0.01) {
                const screen = camera.worldToScreen(p.x, p.y, 1.0);
                const apparentRadius = Math.max(0.5, p.radius * camera.zoom);
                
                ctx.globalAlpha = Math.max(0, p.alpha);
                ctx.fillStyle = p.color;
                ctx.beginPath();
                ctx.arc(screen.x, screen.y, apparentRadius, 0, Math.PI * 2);
                ctx.fill();
            }
        }
        
        ctx.restore();
    }
}
