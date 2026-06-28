export default class AnimationController {
    constructor() {
        // We assume GSAP is loaded globally via CDN in index.html
        if (typeof gsap === 'undefined') {
            window.gsap = this._createFallbackAnimator();
        } else {
            console.log("AnimationController initialized with GSAP.");
        }
    }

    _createFallbackAnimator() {
        const active = new WeakMap();

        const toArray = (target) => {
            if (!target) return [];
            if (target instanceof NodeList || Array.isArray(target)) return Array.from(target);
            return [target];
        };

        const readValue = (target, prop) => {
            if (target instanceof Element) {
                if (prop === 'opacity') return parseFloat(getComputedStyle(target).opacity) || 0;
                if (prop === 'scrollTop') return target.scrollTop || 0;
            }

            return typeof target[prop] === 'number' ? target[prop] : 0;
        };

        const writeValue = (target, prop, value, finalValue) => {
            if (target instanceof Element) {
                if (prop === 'opacity') {
                    target.style.opacity = value;
                    return;
                }
                if (prop === 'scrollTop') {
                    target.scrollTop = value;
                    return;
                }
                if (prop === 'y') {
                    target.style.transform = `translateY(${value}px)`;
                    return;
                }
                if (['bottom', 'fontSize', 'letterSpacing'].includes(prop)) {
                    target.style[prop] = finalValue;
                    return;
                }
                if (prop === 'transform') {
                    target.style.transform = finalValue;
                    return;
                }
            } else {
                target[prop] = value;
            }
        };

        const animateOne = (target, vars, delaySeconds) => {
            let frameId = null;
            let killed = false;
            const duration = Math.max(0.01, (vars.duration || 0) * 1000);
            const delay = Math.max(0, delaySeconds * 1000);
            const numericProps = Object.keys(vars).filter((prop) => {
                if (['duration', 'delay', 'ease', 'onComplete', 'stagger'].includes(prop)) return false;
                return typeof vars[prop] === 'number';
            });
            const startValues = {};

            numericProps.forEach((prop) => {
                startValues[prop] = readValue(target, prop);
            });

            const promise = new Promise((resolve) => {
                const startAt = performance.now() + delay;

                const tick = (now) => {
                    if (killed) {
                        resolve();
                        return;
                    }

                    if (now < startAt) {
                        frameId = requestAnimationFrame(tick);
                        return;
                    }

                    const raw = Math.min(1, (now - startAt) / duration);
                    const eased = raw < 0.5 ? 2 * raw * raw : 1 - Math.pow(-2 * raw + 2, 2) / 2;

                    numericProps.forEach((prop) => {
                        const value = startValues[prop] + (vars[prop] - startValues[prop]) * eased;
                        writeValue(target, prop, value, vars[prop]);
                    });

                    if (raw < 1) {
                        frameId = requestAnimationFrame(tick);
                    } else {
                        Object.keys(vars).forEach((prop) => {
                            if (['bottom', 'fontSize', 'letterSpacing', 'transform'].includes(prop)) {
                                writeValue(target, prop, vars[prop], vars[prop]);
                            }
                        });
                        resolve();
                    }
                };

                frameId = requestAnimationFrame(tick);
            });

            const tween = {
                kill: () => {
                    killed = true;
                    if (frameId) cancelAnimationFrame(frameId);
                },
                then: (resolve, reject) => promise.then(resolve, reject),
                catch: (reject) => promise.catch(reject)
            };

            active.set(target, tween);
            return tween;
        };

        return {
            killTweensOf: (target) => {
                toArray(target).forEach((item) => active.get(item)?.kill());
            },
            to: (target, vars = {}) => {
                const targets = toArray(target);
                const stagger = vars.stagger || 0;
                const tweens = targets.map((item, index) => animateOne(item, vars, (vars.delay || 0) + index * stagger));
                const all = Promise.all(tweens);

                all.then(() => {
                    if (typeof vars.onComplete === 'function') vars.onComplete();
                });

                return {
                    kill: () => tweens.forEach((tween) => tween.kill()),
                    then: (resolve, reject) => all.then(resolve, reject),
                    catch: (reject) => all.catch(reject)
                };
            }
        };
    }

    /**
     * Fades an element in slowly and organically.
     * @param {HTMLElement|Object} target 
     * @param {number} duration 
     */
    fadeIn(target, duration = 2) {
        return gsap.to(target, {
            opacity: 1,
            duration: duration,
            ease: "power2.inOut"
        });
    }

    /**
     * Fades an element out gently.
     * @param {HTMLElement|Object} target 
     * @param {number} duration 
     */
    fadeOut(target, duration = 2) {
        return gsap.to(target, {
            opacity: 0,
            duration: duration,
            ease: "power2.inOut"
        });
    }
}
