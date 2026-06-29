import Camera from '../universe/Camera.js';
import Sky from '../universe/Sky.js';
import MainStar from '../universe/MainStar.js';
import Constellation from '../universe/Constellation.js';
import Explosion from '../universe/Explosion.js';

export default class SceneManager {
    constructor(animationController) {
        this.animationController = animationController;
        this.canvas = null;
        this.ctx = null;
        this.width = 0;
        this.height = 0;

        this.camera = new Camera();
        this.sky = null;
        this.mainStars = [];
        this.constellations = {}; // Map of memoryId -> Constellation
        
        this.explosion = null;

        this.currentScene = null;
        this.homeStar = null;
        this.homeParticles = [];
        this.heartPathProgress = 0;
        this.heartPathOpacity = 0;
        this.emotionVisuals = {
            nostalgia: { aura: 185, alpha: 0.20, pulse: 0.0007, ring: '#FFD79A', drift: 10 },
            joy: { aura: 170, alpha: 0.24, pulse: 0.0016, ring: '#FFEAA7', drift: 6 },
            calm: { aura: 210, alpha: 0.16, pulse: 0.00045, ring: '#A8C8E8', drift: 4 },
            longing: { aura: 230, alpha: 0.18, pulse: 0.00055, ring: '#FFB0B0', drift: 18 },
            hopeful: { aura: 200, alpha: 0.19, pulse: 0.0009, ring: '#98D8C8', drift: 8 }
        };

        // Connecting thread state — ALWAYS visible from the start
        this.threadOpacity = 0.12;
        this.threadTargetOpacity = 0.12;
        this.threadFadeSpeed = 0.0015; // per ms

        // Thread particle system
        this.threadParticles = [];
        for (let i = 0; i < 12; i++) {
            this.threadParticles.push({
                t: Math.random(), // position along thread (0-1)
                speed: 0.0002 + Math.random() * 0.0003,
                radius: 1 + Math.random() * 2,
                alpha: 0.3 + Math.random() * 0.4
            });
        }

        // Time tracking
        this.lastTime = 0;
        this.performanceMode = false;
    }

    setPerformanceMode(enabled) {
        this.performanceMode = enabled;
    }

    init(canvas, ctx, memoriesData = []) {
        this.canvas = canvas;
        this.ctx = ctx;
        this.width = canvas.width;
        this.height = canvas.height;

        this.camera.onResize(this.width, this.height);
        this.sky = new Sky(this.width, this.height, this.performanceMode ? 850 : 2000, {
            performanceMode: this.performanceMode
        });

        this.mainStars = [
            new MainStar(-this.width * 0.25, 0, { coreColor: '#FAF9F6', glowColor: '#FFD79A', coreRadius: 3, glowRadius: 25, breathSpeed: 0.0003, phase: 0 }),
            new MainStar(this.width * 0.25, 0, { coreColor: '#FAF9F6', glowColor: '#E8D5C4', coreRadius: 3, glowRadius: 25, breathSpeed: 0.00035, phase: Math.PI * 0.7 })
        ];

        // Build constellations for memories
        // We generate random gentle branching shapes for each memory
        for (const memory of memoriesData) {
            const numStars = 4 + Math.floor(Math.random() * 3);
            const positions = [{x: 0, y: 0}];
            let currentX = 0;
            let currentY = 0;

            for (let i = 1; i < numStars; i++) {
                // branch off the previous point
                const angle = Math.random() * Math.PI * 2;
                const dist = 30 + Math.random() * 40;
                currentX += Math.cos(angle) * dist;
                currentY += Math.sin(angle) * dist;
                positions.push({x: currentX, y: currentY});
            }

            const color = memory.colors ? memory.colors[0] : '#FAF9F6';
            this.constellations[memory.id] = {
                worldX: memory.worldX,
                worldY: memory.worldY,
                emotion: memory.emotion,
                seed: Math.random() * Math.PI * 2,
                graphics: new Constellation(memory.id, positions, color)
            };
        }
    }

    onResize(width, height) {
        this.width = width;
        this.height = height;
        this.camera.onResize(width, height);
        if (this.sky) this.sky.onResize(width, height);
    }

    setMainStarsConvergence(factor) {
        for (const star of this.mainStars) {
            star.setConvergence(factor, 0, 0); // They converge toward the camera's center (0,0 world pos)
        }
    }

    /**
     * @param {number} time
     * @param {import('../core/InteractionManager.js').default|null} interaction
     * @param {Object} memoryStates
     */
    update(time, interaction = null, memoryStates = {}) {
        const dt = time - this.lastTime;
        this.lastTime = time;

        let cursorWorld = null;
        let presence = 0;
        let panX = 0;
        let panY = 0;

        if (interaction) {
            presence = interaction.presence;
            panX = interaction.panX;
            panY = interaction.panY;
            if (presence > 0.01) {
                cursorWorld = interaction.getWorldPosition(this.camera);
            }
        }

        this.camera.update(time, panX, panY, dt);

        if (this.sky) {
            this.sky.draw(this.ctx, this.camera, time, cursorWorld, presence);
            this.sky.drawShootingStars(this.ctx, this.camera, dt);
        }

        // Draw Memory Beacons and Constellations
        this.drawMemoryCalls(memoryStates, time);

        for (const id in this.constellations) {
            const constData = this.constellations[id];
            const state = memoryStates[id];
            
            const screen = this.camera.worldToScreen(constData.worldX, constData.worldY, 1.0);
            if (this.isScreenRelevant(screen, this.performanceMode ? 180 : 260)) {
                this.drawMemoryBeacon(constData, state, screen, time);
            }

            // Set constellation opacity based on progress or unlock state
            let targetOpacity = 0;
            if (!this.isFinalSequence) {
                if (state) {
                    if (state.isUnlocked && state.isNear) {
                        targetOpacity = 0.85; // Bright when nearby and unlocked
                    } else if (!state.isUnlocked && state.lingerProgress > 0) {
                        targetOpacity = state.lingerProgress * 0.7; // Fill up as you linger
                    } else if (state.isUnlocked && !state.isNear) {
                        targetOpacity = 0.35; // Stay clearly visible even when far
                    }
                }
                constData.graphics.setTargetOpacity(targetOpacity);
            }
            if (this.isScreenRelevant(screen, 160) || constData.graphics.opacity > 0.01) {
                constData.graphics.draw(this.ctx, this.camera, constData.worldX, constData.worldY, dt);
            }
        }

        if (this.isFinalSequence) {
            this.drawMemoryHeartPath();
        }

        let anyMainStarNear = false;
        const mainStarScreenPositions = [];

        for (const star of this.mainStars) {
            star.updatePosition(dt);
            const proximity = star.computeProximity(cursorWorld, presence);
            if (proximity > 0.1) anyMainStarNear = true;

            const screen = this.camera.worldToScreen(star.x, star.y, 1.0);
            mainStarScreenPositions.push(screen);
            star.draw(this.ctx, screen.x, screen.y, time);
        }

        this.threadTargetOpacity = anyMainStarNear ? 0.25 : 0.12;
        const threadDiff = this.threadTargetOpacity - this.threadOpacity;
        const threadStep = this.threadFadeSpeed * dt;
        
        if (Math.abs(threadDiff) < threadStep) {
            this.threadOpacity = this.threadTargetOpacity;
        } else {
            this.threadOpacity += Math.sign(threadDiff) * threadStep;
        }

        if (mainStarScreenPositions.length === 2) {
            this.drawConnectingThread(mainStarScreenPositions[0], mainStarScreenPositions[1], time);
        }

        if (this.explosion && this.explosion.active) {
            this.explosion.update(dt);
            this.explosion.draw(this.ctx, this.camera);
        }

        this.drawHomeStar(time);
    }

    isScreenRelevant(screen, margin = 200) {
        return (
            screen.x > -margin &&
            screen.x < this.width + margin &&
            screen.y > -margin &&
            screen.y < this.height + margin
        );
    }

    drawConnectingThread(posA, posB, time) {
        const ctx = this.ctx;
        ctx.save();
        ctx.globalAlpha = this.threadOpacity;

        const gradient = ctx.createLinearGradient(posA.x, posA.y, posB.x, posB.y);
        gradient.addColorStop(0, '#FFD79A');
        gradient.addColorStop(0.5, 'rgba(255, 240, 220, 0.8)');
        gradient.addColorStop(1, '#E8D5C4');

        const midX = (posA.x + posB.x) / 2;
        const midY = (posA.y + posB.y) / 2;
        const distance = Math.hypot(posB.x - posA.x, posB.y - posA.y);
        const breath = Math.sin(time * 0.00045) * Math.min(34, distance * 0.04);
        const control = {
            x: midX,
            y: midY - Math.min(52, distance * 0.08) + breath
        };

        ctx.strokeStyle = gradient;
        ctx.lineWidth = 0.8 + Math.sin(time * 0.001) * 0.18;
        ctx.beginPath();
        ctx.moveTo(posA.x, posA.y);
        ctx.quadraticCurveTo(control.x, control.y, posB.x, posB.y);
        ctx.stroke();

        // Draw traveling particles along the thread
        for (const p of this.threadParticles) {
            p.t += p.speed;
            if (p.t > 1) p.t -= 1;
            
            const point = this.pointOnQuadratic(posA, control, posB, p.t);
            
            ctx.globalAlpha = p.alpha * this.threadOpacity * 3;
            ctx.fillStyle = '#FFF5E8';
            ctx.beginPath();
            ctx.arc(point.x, point.y, p.radius, 0, Math.PI * 2);
            ctx.fill();
        }

        ctx.restore();
    }

    drawMemoryBeacon(constData, state, screen, time) {
        const ctx = this.ctx;
        const visual = this.emotionVisuals[constData.emotion] || this.emotionVisuals.nostalgia;
        const near = state?.isNear ? 1 : 0;
        const progress = state?.lingerProgress || 0;
        const unlocked = state?.isUnlocked ? 1 : 0;
        const pulse = 0.5 + Math.sin(time * visual.pulse + constData.seed) * 0.5;
        const driftX = Math.cos(time * 0.00022 + constData.seed) * visual.drift;
        const driftY = Math.sin(time * 0.00018 + constData.seed) * visual.drift;
        const mobileScale = this.performanceMode ? 0.72 : 1;
        const radius = (visual.aura + pulse * 28 + near * 28 + unlocked * 16) * mobileScale;
        const alpha = (visual.alpha + pulse * 0.09 + near * 0.12 + unlocked * 0.04) * (this.performanceMode ? 0.82 : 1);

        ctx.save();
        ctx.globalAlpha = alpha;
        const grad = ctx.createRadialGradient(screen.x + driftX, screen.y + driftY, 0, screen.x, screen.y, radius);
        grad.addColorStop(0, constData.graphics.color);
        grad.addColorStop(0.28, `${constData.graphics.color}66`);
        grad.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(screen.x, screen.y, radius, 0, Math.PI * 2);
        ctx.fill();

        if (progress > 0 || near) {
            ctx.globalAlpha = 0.16 + progress * 0.35;
            ctx.strokeStyle = visual.ring;
            ctx.lineWidth = 0.7;
            ctx.beginPath();
            ctx.arc(screen.x, screen.y, 42 + progress * 54 + pulse * 8, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * Math.max(progress, 0.08));
            ctx.stroke();
        }

        if (constData.emotion === 'longing') {
            ctx.globalAlpha = 0.08 + pulse * 0.08;
            ctx.strokeStyle = visual.ring;
            ctx.lineWidth = 0.5;
            ctx.beginPath();
            ctx.moveTo(screen.x - radius * 0.45, screen.y + 12);
            ctx.lineTo(screen.x + radius * 0.45, screen.y - 12);
            ctx.stroke();
        }

        if (constData.emotion === 'joy') {
            ctx.globalAlpha = 0.12 + pulse * 0.12;
            ctx.fillStyle = '#FFF5E8';
            for (let i = 0; i < 3; i++) {
                const angle = constData.seed + time * 0.00035 + i * Math.PI * 2 / 3;
                ctx.beginPath();
                ctx.arc(screen.x + Math.cos(angle) * 34, screen.y + Math.sin(angle) * 34, 1.3, 0, Math.PI * 2);
                ctx.fill();
            }
        }

        ctx.restore();
    }

    drawMemoryCalls(memoryStates, time) {
        const locked = Object.entries(this.constellations)
            .filter(([id]) => !memoryStates[id]?.isUnlocked)
            .map(([, constData]) => constData);

        if (!locked.length) return;

        let nearest = null;
        let nearestDistance = Infinity;

        for (const constData of locked) {
            const screen = this.camera.worldToScreen(constData.worldX, constData.worldY, 1.0);
            const dx = screen.x - this.width / 2;
            const dy = screen.y - this.height / 2;
            const distance = Math.hypot(dx, dy);

            if (distance < nearestDistance) {
                nearestDistance = distance;
                nearest = { constData, screen, dx, dy };
            }
        }

        if (!nearest) return;

        const margin = 88;
        const isVisible =
            nearest.screen.x > margin &&
            nearest.screen.x < this.width - margin &&
            nearest.screen.y > margin &&
            nearest.screen.y < this.height - margin;

        if (isVisible) return;

        const angle = Math.atan2(nearest.dy, nearest.dx);
        const x = this.width / 2 + Math.cos(angle) * (this.width * 0.42);
        const y = this.height / 2 + Math.sin(angle) * (this.height * 0.38);
        const visual = this.emotionVisuals[nearest.constData.emotion] || this.emotionVisuals.nostalgia;
        const pulse = 0.5 + Math.sin(time * 0.0008 + nearest.constData.seed) * 0.5;
        const radius = this.performanceMode ? 150 + pulse * 28 : 210 + pulse * 46;

        this.ctx.save();
        this.ctx.globalAlpha = 0.16 + pulse * 0.13;
        const grad = this.ctx.createRadialGradient(x, y, 0, x, y, radius);
        grad.addColorStop(0, visual.ring);
        grad.addColorStop(0.35, `${visual.ring}55`);
        grad.addColorStop(1, 'rgba(0,0,0,0)');
        this.ctx.fillStyle = grad;
        this.ctx.beginPath();
        this.ctx.arc(x, y, radius, 0, Math.PI * 2);
        this.ctx.fill();
        this.ctx.restore();
    }

    pointOnQuadratic(a, c, b, t) {
        const oneMinusT = 1 - t;
        return {
            x: oneMinusT * oneMinusT * a.x + 2 * oneMinusT * t * c.x + t * t * b.x,
            y: oneMinusT * oneMinusT * a.y + 2 * oneMinusT * t * c.y + t * t * b.y
        };
    }


    triggerHomeStar() {
        if (this.homeStar?.active) return;

        this.homeStar = {
            active: true,
            progress: 0,
            textProgress: 0
        };

        this.homeParticles = [];
        for (let i = 0; i < 44; i++) {
            this.homeParticles.push({
                angle: (Math.PI * 2 * i) / 44 + Math.random() * 0.35,
                distance: 180 + Math.random() * 440,
                size: 1 + Math.random() * 2.5,
                delay: Math.random() * 0.28,
                color: i % 5 === 0 ? '#FFD79A' : '#FAF9F6',
                phase: Math.random() * Math.PI * 2
            });
        }

        gsap.to(this.homeStar, {
            progress: 1,
            duration: 7,
            ease: "power2.inOut"
        });

        gsap.to(this.homeStar, {
            textProgress: 1,
            duration: 4,
            delay: 4.2,
            ease: "power2.inOut"
        });
    }

    drawHomeStar(time) {
        if (!this.homeStar?.active) return;

        const ctx = this.ctx;
        const centerX = this.width / 2;
        const centerY = this.height / 2 - 18;
        const progress = this.homeStar.progress;
        const eased = progress * progress * (3 - 2 * progress);

        ctx.save();
        for (const particle of this.homeParticles) {
            const localProgress = Math.max(0, Math.min(1, (progress - particle.delay) / (1 - particle.delay)));
            const ease = localProgress * localProgress * (3 - 2 * localProgress);
            const swirl = Math.sin(time * 0.001 + particle.phase) * 18 * (1 - ease);
            const radius = particle.distance * (1 - ease);
            const x = centerX + Math.cos(particle.angle + ease * 1.6) * radius + Math.cos(particle.angle) * swirl;
            const y = centerY + Math.sin(particle.angle + ease * 1.6) * radius + Math.sin(particle.angle) * swirl;

            ctx.globalAlpha = 0.1 + localProgress * 0.9;
            ctx.fillStyle = particle.color;
            ctx.beginPath();
            ctx.arc(x, y, particle.size * (0.7 + ease * 0.8), 0, Math.PI * 2);
            ctx.fill();
        }

        const glow = Math.max(0, (eased - 0.35) / 0.65);
        if (glow > 0) {
            const pulse = 0.85 + Math.sin(time * 0.002) * 0.15;
            const outerRadius = 42 + glow * 110 * pulse;
            const grad = ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, outerRadius);
            grad.addColorStop(0, 'rgba(255, 245, 232, 0.95)');
            grad.addColorStop(0.18, 'rgba(255, 215, 154, 0.55)');
            grad.addColorStop(1, 'rgba(0, 0, 0, 0)');

            ctx.globalAlpha = 0.75 * glow;
            ctx.fillStyle = grad;
            ctx.beginPath();
            ctx.arc(centerX, centerY, outerRadius, 0, Math.PI * 2);
            ctx.fill();

            ctx.globalAlpha = glow;
            ctx.fillStyle = '#FFF5E8';
            ctx.beginPath();
            ctx.arc(centerX, centerY, 3.5 + glow * 2.5, 0, Math.PI * 2);
            ctx.fill();
        }

        if (this.homeStar.textProgress > 0) {
            ctx.globalAlpha = this.homeStar.textProgress * 0.9;
            ctx.fillStyle = '#FAF9F6';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.shadowColor = 'rgba(255, 215, 154, 0.45)';
            ctx.shadowBlur = 24;

            ctx.font = `${18 + this.homeStar.textProgress * 7}px Cormorant Garamond, serif`;
            ctx.fillText('Luisa', centerX, centerY + 66);

            ctx.font = `${28 + this.homeStar.textProgress * 12}px Cormorant Garamond, serif`;
            ctx.fillText('Hogar.', centerX, centerY + 104);

            ctx.globalAlpha = this.homeStar.textProgress * 0.68;
            ctx.shadowBlur = 14;
            ctx.font = `${13 + this.homeStar.textProgress * 3}px Inter, sans-serif`;
            ctx.fillText('Ti amu, mi cielo.', centerX, centerY + 146);
        }

        ctx.restore();
    }

    // --- Cinematic Methods ---

    triggerExplosion() {
        this.explosion = new Explosion(0, 0, { performanceMode: this.performanceMode }); // Origin at center
    }

    mergeMainStars() {
        for (const star of this.mainStars) {
            star.setMerged(true);
        }
        // Immediately fade out the thread since they are merged
        this.threadOpacity = 0;
        this.threadTargetOpacity = 0;
    }

    transitionToSunset() {
        const sunsetBg = document.getElementById('sunset-bg');
        if (!sunsetBg) return;

        // Progressive sky evolution: deep blue -> violet -> pink -> orange -> golden
        const skyStages = [
            { bg: 'linear-gradient(to bottom, #050508 0%, #0a0b1e 40%, #141432 100%)', duration: 2 },
            { bg: 'linear-gradient(to bottom, #0a0b1e 0%, #1a1040 30%, #2b1138 60%, #1a1040 100%)', duration: 2 },
            { bg: 'linear-gradient(to bottom, #0a0b1e 0%, #2b1138 25%, #561d4b 55%, #903058 100%)', duration: 2.5 },
            { bg: 'linear-gradient(to bottom, #0a0b1e 0%, #2b1138 20%, #561d4b 40%, #903058 60%, #d1565a 80%, #f48b59 95%)', duration: 3 }
        ];

        sunsetBg.style.opacity = '1';
        let totalDelay = 0;

        skyStages.forEach((stage) => {
            setTimeout(() => {
                sunsetBg.style.transition = `background ${stage.duration}s ease-in-out`;
                sunsetBg.style.background = stage.bg;
            }, totalDelay);
            totalDelay += stage.duration * 800;
        });

        // Slightly dim the canvas to blend with the CSS background, but keep stars visible
        gsap.to(this.canvas, { opacity: 0.75, duration: 6, delay: 2, ease: "power1.inOut" });
    }

    startMeteorShower() {
        if (this.sky) {
            this.sky.triggerMeteorShower();
        }
    }

    revealHeartConstellations() {
        this.isFinalSequence = true;
        this.heartPathProgress = 0;
        this.heartPathOpacity = 0;
        if (this.performanceMode) {
            this.camera.transitionTo(0, 90, 0.22, 0.018, 0.04);
        }

        // The constellations are already positioned in a heart shape.
        // We will force them all to gradually appear and stay visible.
        const ids = Object.keys(this.constellations);
        ids.forEach((id, index) => {
            const c = this.constellations[id];
            c.graphics.drawProgress = 0.0;
            // Stagger: each constellation starts 0.6s after the previous
            gsap.to(c.graphics, {
                opacity: 1.0,
                targetOpacity: 1.0,
                drawProgress: 1.0,
                duration: 2.5,
                delay: index * 0.6,
                ease: "power2.out"
            });
        });

        gsap.to(this, {
            heartPathOpacity: 1,
            duration: 2.5,
            delay: 1.2,
            ease: "power2.out"
        });

        gsap.to(this, {
            heartPathProgress: 1,
            duration: 6.2,
            delay: 1.2,
            ease: "power2.inOut"
        });
    }

    drawMemoryHeartPath() {
        if (this.heartPathOpacity <= 0.001 || this.heartPathProgress <= 0.001) return;

        const samples = this.performanceMode ? 96 : 180;
        const centerX = 0;
        const centerY = 60;
        const scaleX = 54;
        const scaleY = 48;
        const points = [];

        for (let i = 0; i <= samples; i++) {
            const t = Math.PI + (Math.PI * 2 * i) / samples;
            const x = 16 * Math.pow(Math.sin(t), 3);
            const y = -(13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t));
            points.push(this.camera.worldToScreen(centerX + x * scaleX, centerY + y * scaleY, 1.0));
        }

        const segments = [];
        let total = 0;
        for (let i = 1; i < points.length; i++) {
            const a = points[i - 1];
            const b = points[i];
            const length = Math.hypot(b.x - a.x, b.y - a.y);
            segments.push({ a, b, length });
            total += length;
        }

        let remaining = total * this.heartPathProgress;
        const drawStroke = (width, alpha, blur) => {
            const ctx = this.ctx;
            ctx.save();
            ctx.globalAlpha = alpha * this.heartPathOpacity;
            ctx.strokeStyle = 'rgba(255, 215, 154, 0.92)';
            ctx.lineWidth = width;
            ctx.lineCap = 'round';
            ctx.lineJoin = 'round';
            ctx.shadowColor = 'rgba(255, 215, 154, 0.45)';
            ctx.shadowBlur = blur;
            ctx.setLineDash([9, 17]);
            ctx.lineDashOffset = -this.heartPathProgress * 60;
            ctx.beginPath();
            ctx.moveTo(points[0].x, points[0].y);

            let budget = remaining;
            for (const { a, b, length } of segments) {
                if (budget <= 0) break;
                if (budget >= length) {
                    ctx.lineTo(b.x, b.y);
                    budget -= length;
                } else {
                    const t = budget / length;
                    ctx.lineTo(a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t);
                    budget = 0;
                }
            }

            ctx.stroke();
            ctx.restore();
        };

        drawStroke(4.5, 0.09, this.performanceMode ? 10 : 24);
        drawStroke(1.15, 0.34, this.performanceMode ? 4 : 9);
    }
}
