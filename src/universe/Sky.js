/**
 * Sky.js
 *
 * Manages the ambient starfield: generation, culling, and rendering.
 * Now occasionally spawns subtle shooting stars in the deep background.
 */
import Star from './Star.js';
import ShootingStar from './ShootingStar.js';

export default class Sky {
    /**
     * @param {number} viewportWidth
     * @param {number} viewportHeight
     * @param {number} starCount - Total number of ambient stars
     */
    constructor(viewportWidth, viewportHeight, starCount = 600) {
        this.stars = [];
        this.shootingStars = [];
        this.viewportWidth = viewportWidth;
        this.viewportHeight = viewportHeight;

        // The world extends far beyond the viewport so exploration
        // never reveals an empty edge. Matches the memory spread.
        this.worldPadding = 2.0; // 200% extra on each side for huge explorable universe

        // Proximity influence radius — how far the cursor's warmth reaches
        this.proximityRadius = 120; // px in screen-space

        this.generate(starCount);
    }

    /**
     * Generates the starfield with varied sizes, colors, and breathing rates.
     */
    generate(count) {
        const padX = this.viewportWidth * this.worldPadding;
        const padY = this.viewportHeight * this.worldPadding;

        // Soft color palette for ambient stars
        const colors = [
            '#FAF9F6', // warm white
            '#E8E4DF', // muted ivory
            '#FFD79A', // soft gold (rare)
            '#C9D6DF', // cool pale blue
        ];
        // Weight distribution: most stars are white/ivory, few are gold/blue
        const colorWeights = [0.45, 0.30, 0.10, 0.15];

        for (let i = 0; i < count; i++) {
            // Position across the padded world
            const x = -padX + Math.random() * (this.viewportWidth + padX * 2);
            const y = -padY + Math.random() * (this.viewportHeight + padY * 2);

            // Size distribution and depth
            const sizeSeed = Math.random();
            let radius;
            let z;
            if (sizeSeed < 0.70) {
                radius = 0.5 + Math.random() * 1.0; // tiny
                z = 0.2 + Math.random() * 0.4; // far away (moves slow)
            } else if (sizeSeed < 0.92) {
                radius = 1.2 + Math.random() * 1.5; // small
                z = 0.6 + Math.random() * 0.3; // mid-ground
            } else {
                radius = 2.0 + Math.random() * 2.0; // medium
                z = 0.9 + Math.random() * 0.3; // close to interaction plane (z=1)
            }

            // Opacity: dimmer for tiny stars, brighter for larger ones
            const baseOpacity = 0.2 + (radius / 4) * 0.6 + Math.random() * 0.15;

            // Breathing: each star has a unique speed and phase
            const breathSpeed = 0.0003 + Math.random() * 0.0008;
            const breathDepth = 0.05 + Math.random() * 0.15;
            const phase = Math.random() * Math.PI * 2;

            // Pick a weighted color
            const color = this.pickWeightedColor(colors, colorWeights);

            this.stars.push(new Star(x, y, radius, baseOpacity, breathSpeed, breathDepth, phase, color, z));
        }
    }

    /**
     * Picks a color from the palette using weighted probability.
     */
    pickWeightedColor(colors, weights) {
        const r = Math.random();
        let cumulative = 0;
        for (let i = 0; i < colors.length; i++) {
            cumulative += weights[i];
            if (r <= cumulative) return colors[i];
        }
        return colors[0];
    }

    /**
     * Called when viewport resizes.
     */
    onResize(width, height) {
        this.viewportWidth = width;
        this.viewportHeight = height;
    }

    /**
     * Renders all visible stars with proximity awareness.
     * @param {CanvasRenderingContext2D} ctx
     * @param {import('./Camera.js').default} camera
     * @param {number} time - Elapsed time in ms
     * @param {{x: number, y: number}|null} cursorWorld - Cursor position in world-space, or null
     * @param {number} presence - User presence intensity (0–1)
     */
    draw(ctx, camera, time, cursorWorld = null, presence = 0) {
        const margin = 200; // Increase margin slightly because parallax makes stars move more
        this.drawDeepDust(ctx, time);

        for (const star of this.stars) {
            const screen = camera.worldToScreen(star.x, star.y, star.z);

            // Frustum culling
            if (
                screen.x < -margin || screen.x > this.viewportWidth + margin ||
                screen.y < -margin || screen.y > this.viewportHeight + margin
            ) {
                continue;
            }

            // Compute proximity boost if cursor is present
            let proximityBoost = 0;
            if (cursorWorld && presence > 0) {
                const dx = star.x - cursorWorld.x;
                const dy = star.y - cursorWorld.y;
                const dist = Math.sqrt(dx * dx + dy * dy);

                if (dist < this.proximityRadius) {
                    // Smooth falloff — closer = stronger, using cosine ease
                    const t = dist / this.proximityRadius;
                    proximityBoost = (1 - t) * (1 - t) * presence; // quadratic falloff
                }
            }

            star.draw(ctx, screen.x, screen.y, time, proximityBoost);
        }

        // --- Shooting Stars ---
        if (this.meteorShowerActive) {
            // Intense shower: allow up to 15, high spawn rate
            if (this.shootingStars.length < 15 && Math.random() < 0.05) {
                this._spawnShootingStar(camera);
            }
        } else {
            // Normal behavior: Occasionally spawn a shooting star (approx once every 8 seconds)
            // Only spawn if there are fewer than 2 active
            if (this.shootingStars.length < 2 && Math.random() < 0.002) {
                this._spawnShootingStar(camera);
            }
        }

        // dt is needed for shooting stars to move at consistent speed
        // Since Sky.draw didn't get dt previously, we calculate it or we just use 16ms approx.
        // It's better to accept dt. I will modify SceneManager to pass dt to Sky.draw next.
        // For now, I'll pass a default dt if not provided.
    }

    drawDeepDust(ctx, time) {
        ctx.save();

        const ambient = ctx.createRadialGradient(
            this.viewportWidth * 0.65,
            this.viewportHeight * 0.35,
            0,
            this.viewportWidth * 0.65,
            this.viewportHeight * 0.35,
            Math.max(this.viewportWidth, this.viewportHeight) * 0.8
        );
        ambient.addColorStop(0, 'rgba(255, 215, 154, 0.018)');
        ambient.addColorStop(0.45, 'rgba(100, 140, 200, 0.012)');
        ambient.addColorStop(1, 'rgba(0, 0, 0, 0)');
        ctx.fillStyle = ambient;
        ctx.fillRect(0, 0, this.viewportWidth, this.viewportHeight);

        for (let i = 0; i < 120; i++) {
            const seed = i * 97.13;
            const x = (Math.sin(seed) * 0.5 + 0.5) * this.viewportWidth;
            const y = (Math.cos(seed * 1.7) * 0.5 + 0.5) * this.viewportHeight;
            const breath = 0.5 + Math.sin(time * 0.00018 + seed) * 0.5;
            const r = 0.55 + breath * 1.15;

            ctx.globalAlpha = 0.045 + breath * 0.105;
            ctx.fillStyle = i % 7 === 0 ? '#FFD79A' : '#FAF9F6';
            ctx.beginPath();
            ctx.arc(x, y, r, 0, Math.PI * 2);
            ctx.fill();
        }

        ctx.restore();
    }

    _spawnShootingStar(camera) {
        // To prevent stars from popping in during a zoomed-out cinematic (zoom ~0.4),
        // we calculate the true visible world bounds.
        const visibleWidth = this.viewportWidth / camera.zoom;
        const visibleHeight = this.viewportHeight / camera.zoom;
        
        // Spawn far outside the visible area
        const margin = 500;
        
        // We create a unified "radiant" (meteor shower origin) for a more natural,
        // sweeping cosmic event rather than chaotic screensaver bouncing.
        // They will come generally from the top-right, sweeping down-left.
        const baseAngle = Math.PI * 0.8; // ~144 degrees
        const angleVar = (Math.random() - 0.5) * 0.15; // slight variance for natural feel
        const angle = baseAngle + angleVar;

        // Choose a random spawn position along a wide line beyond the top-right
        const spawnDistance = Math.max(visibleWidth, visibleHeight) * 0.7 + margin;
        
        // We pick a random angle in the top-right quadrant to distribute the spawns
        const spawnAngle = -Math.PI * 0.25 + (Math.random() - 0.5) * Math.PI * 0.6;
        
        const startX = camera.x + Math.cos(spawnAngle) * spawnDistance;
        const startY = camera.y + Math.sin(spawnAngle) * spawnDistance;

        const speed = 0.8 + Math.random() * 1.2; // pixels per ms
        const length = 200 + Math.random() * 300;
        
        // Give them a long enough lifetime to gracefully cross the huge zoomed-out space
        const lifeTime = 3000 + Math.random() * 3000; // 3 to 6 seconds

        this.shootingStars.push(new ShootingStar(startX, startY, angle, speed, length, lifeTime));
    }

    drawShootingStars(ctx, camera, dt) {
        for (let i = this.shootingStars.length - 1; i >= 0; i--) {
            const ss = this.shootingStars[i];
            ss.update(dt);
            ss.draw(ctx, camera);

            if (ss.dead) {
                this.shootingStars.splice(i, 1);
            }
        }
    }

    triggerMeteorShower() {
        this.meteorShowerActive = true;
    }
}
