/**
 * UIManager.js
 *
 * Handles the DOM-based UI overlay for narration, universe voice, and the final letter.
 * Uses GSAP via AnimationController to ensure text fades in
 * gently and organically.
 */
export default class UIManager {
    constructor(animationController) {
        this.animationController = animationController;
        this.container = document.getElementById('narration-container');
        this.universeContainer = document.getElementById('universe-narration');
        this.exploreHint = document.getElementById('explore-hint');
        this.currentTween = null;
        this.universeTween = null;
        this.hintDismissed = false;
        this.epilogueTriggered = false;
        this.secretTriggered = false;
        this.secretHandler = null;
    }

    setSecretHandler(handler) {
        this.secretHandler = handler;
    }

    _makeSecretTarget(el) {
        if (!el || el.dataset.homeSecretReady === 'true') return;
        el.dataset.homeSecretReady = 'true';
        el.classList.add('home-secret-ready');
        el.setAttribute('role', 'button');
        el.setAttribute('aria-label', 'Revelar hogar');

        const reveal = (event) => {
            if (event) event.preventDefault();
            this._triggerHomeSecret(el);
        };

        el.addEventListener('click', reveal);
        el.addEventListener('touchend', reveal);
    }

    _triggerHomeSecret(sourceEl) {
        if (this.secretTriggered) return;
        this.secretTriggered = true;

        if (sourceEl) {
            gsap.to(sourceEl, {
                opacity: 0.25,
                duration: 1.2,
                ease: "power2.inOut"
            });
        }

        if (typeof this.secretHandler === 'function') {
            this.secretHandler();
        }
    }
    showExploreHint(delay = 6000) {
        if (!this.exploreHint || this.hintDismissed) return;

        gsap.killTweensOf(this.exploreHint);
        gsap.to(this.exploreHint, {
            opacity: 1,
            duration: 2.5,
            delay: delay / 1000,
            ease: "power2.inOut"
        });
    }

    dismissExploreHint() {
        if (!this.exploreHint || this.hintDismissed) return;
        this.hintDismissed = true;

        gsap.killTweensOf(this.exploreHint);
        gsap.to(this.exploreHint, {
            opacity: 0,
            duration: 1.5,
            ease: "power2.inOut"
        });
    }

    /**
     * Displays a memory narration text — now longer hold and more opaque.
     * @param {string} text - The text to display
     * @param {number} displayDuration - How long to hold the text (in ms)
     */
    async showNarration(text, displayDuration = 10000) {
        // Kill any ongoing animation
        if (this.currentTween) {
            this.currentTween.kill();
        }

        this.container.innerText = text;
        
        // Fade In (takes 2.5 seconds, to full opacity)
        this.currentTween = gsap.to(this.container, {
            opacity: 0.95,
            duration: 2.5,
            ease: "power2.inOut"
        });
        await this.currentTween;

        // Hold for a generous duration
        await new Promise(resolve => setTimeout(resolve, displayDuration));

        // Fade Out (takes 3 seconds, slow and graceful)
        this.currentTween = gsap.to(this.container, {
            opacity: 0,
            duration: 3,
            ease: "power2.inOut"
        });
        await this.currentTween;

        // Clear text
        this.container.innerText = "";
    }

    /**
     * Displays a timeless message from the Universe itself.
     * @param {string} text - The text to display
     * @param {number} displayDuration - How long to hold the text (in ms)
     */
    async showUniverseNarration(text, displayDuration = 8000) {
        if (this.universeTween) {
            this.universeTween.kill();
        }

        this.universeContainer.innerText = text;
        
        // Fade In slowly (3 seconds)
        this.universeTween = this.animationController.fadeIn(this.universeContainer, 3);
        await this.universeTween;

        await new Promise(resolve => setTimeout(resolve, displayDuration));

        // Fade Out (3 seconds)
        this.universeTween = this.animationController.fadeOut(this.universeContainer, 3);
        await this.universeTween;

        this.universeContainer.innerText = "";
    }

    /**
     * Shows the final letter — a slow, cinematic reveal.
     * @param {string[]} paragraphs - Array of text lines
     */
    async showFinalLetter(paragraphs) {
        if (this.finalLetterStarted) return;
        this.finalLetterStarted = true;

        const letterEl = document.getElementById('final-letter');
        const epilogueEl = document.getElementById('epilogue');
        const dimEl = document.getElementById('dim-overlay');
        if (!letterEl) return;

        // Build the letter content
        letterEl.innerHTML = paragraphs.map(p => {
            if (p === '') return '<br>';
            return `<p>${p}</p>`;
        }).join('') + '<p class="letter-inscription">28 · 04 · ∞</p>';
        const inscriptionEl = letterEl.querySelector('.letter-inscription');
        this._makeSecretTarget(inscriptionEl);

        // Wait a beat, then fade in the letter
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        letterEl.classList.add('active');
        letterEl.scrollTop = 0;
        this._watchLetterBottom(letterEl, epilogueEl, dimEl);

        if (dimEl) {
            gsap.to(dimEl, {
                opacity: 0.68,
                duration: 5,
                ease: "power2.inOut"
            });
        }

        gsap.to(letterEl, {
            opacity: 1,
            duration: 5,
            ease: "power2.inOut",
            onComplete: () => {
                const lines = letterEl.querySelectorAll('p');
                gsap.to(lines, {
                    opacity: 1,
                    y: 0,
                    duration: 1.8,
                    stagger: 0.42,
                    ease: "power2.out",
                    onComplete: () => {
                        this._startLetterAutoScroll(letterEl, epilogueEl, dimEl);
                    }
                });
            }
        });
    }

    _startLetterAutoScroll(letterEl, epilogueEl, dimEl) {
        // Calculate total scroll distance
        const maxScroll = letterEl.scrollHeight - letterEl.clientHeight;
        if (maxScroll <= 0) {
            this._onLetterFinished(letterEl, epilogueEl, dimEl);
            return;
        }

        // The letter moves like a remembered voice, not like a page.
        const scrollDuration = Math.min(70, Math.max(28, maxScroll / 22)); 
        
        let scrollTween = gsap.to(letterEl, {
            scrollTop: maxScroll,
            duration: scrollDuration,
            ease: "none",
            onComplete: () => this._onLetterFinished(letterEl, epilogueEl, dimEl)
        });

        // If the user scrolls manually, kill the auto-scroll tween but still track when they reach the bottom
        letterEl.addEventListener('wheel', () => scrollTween.kill(), { once: true });
        letterEl.addEventListener('touchstart', () => scrollTween.kill(), { once: true });

        // Backup listener in case they scroll manually to the bottom
        letterEl.addEventListener('scroll', () => {
            if (letterEl.scrollTop >= maxScroll - 5 && !this.epilogueTriggered) {
                this._onLetterFinished(letterEl, epilogueEl, dimEl);
            }
        });
    }

    _watchLetterBottom(letterEl, epilogueEl, dimEl) {
        const checkBottom = () => {
            const maxScroll = letterEl.scrollHeight - letterEl.clientHeight;
            if (maxScroll > 0 && letterEl.scrollTop >= maxScroll - 12 && !this.epilogueTriggered) {
                this._onLetterFinished(letterEl, epilogueEl, dimEl);
            }
        };

        letterEl.addEventListener('scroll', checkBottom);
        letterEl.addEventListener('wheel', () => setTimeout(checkBottom, 120));
        letterEl.addEventListener('touchend', () => setTimeout(checkBottom, 120));
    }
    _onLetterFinished(letterEl, epilogueEl, dimEl) {
        if (this.epilogueTriggered) return;
        this.epilogueTriggered = true;

        // Wait a few seconds for them to read the final line, then fade out the letter
        setTimeout(() => {
            // Remove active class to ensure CSS transition can also work, but we use GSAP for pacing
            letterEl.classList.remove('active');
            gsap.to(letterEl, {
                opacity: 0,
                duration: 4,
                ease: "power2.inOut",
                onComplete: () => {
                    letterEl.style.pointerEvents = 'none';
                    letterEl.style.display = 'none'; // fully hide it from rendering
                    if (dimEl) {
                        gsap.to(dimEl, {
                            opacity: 0.28,
                            duration: 5,
                            ease: "power2.inOut"
                        });
                    }
                    // Show epilogue — starts small at bottom, grows and rises to center
                    if (epilogueEl) {
                        epilogueEl.style.pointerEvents = 'auto';
                        this._makeSecretTarget(epilogueEl);
                        // Phase 1: Fade in small at the bottom
                        gsap.to(epilogueEl, {
                            opacity: 0.6,
                            duration: 3,
                            ease: "power2.inOut",
                            onComplete: () => {
                                // Phase 2: Grow and move to center after a pause
                                setTimeout(() => {
                                    gsap.to(epilogueEl, {
                                        bottom: '50%',
                                        transform: 'translate(-50%, 50%) scale(1.2)',
                                        opacity: 0.8,
                                        fontSize: '1.6rem',
                                        letterSpacing: '0.5em',
                                        duration: 6,
                                        ease: "power2.inOut",
                                        onComplete: () => {
                                            setTimeout(() => this._triggerHomeSecret(epilogueEl), 1400);
                                        }
                                    });
                                }, 2500);
                            }
                        });
                    }
                }
            });
        }, 5000);
    }
}
