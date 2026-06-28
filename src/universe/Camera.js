/**
 * Camera.js
 * 
 * Incorporates drag panning and deep Z-depth parallax.
 * Eases back toward the center if the user strays too far into the void.
 */
export default class Camera {
    constructor() {
        this.x = 0;
        this.y = 0;

        // Soft organic drift (unchanged)
        this.driftLayers = [
            { ampX: 0.05, ampY: 0.03, freqX: 0.00010, freqY: 0.00012, phaseX: 0,    phaseY: 1.3 },
            { ampX: 0.03, ampY: 0.04, freqX: 0.00021, freqY: 0.00018, phaseX: 2.1,  phaseY: 0.7 },
            { ampX: 0.01, ampY: 0.01, freqX: 0.00051, freqY: 0.00049, phaseX: 4.2,  phaseY: 3.1 },
        ];

        // The maximum distance the user can freely pan before the elastic boundary pulls them back
        this.maxBoundary = 1500; 

        this.viewportWidth = 0;
        this.viewportHeight = 0;

        // Zoom for dramatic pull-backs
        this.zoom = 1.0;
        this.targetZoom = 1.0;
        this.zoomSpeed = 0.005;

        // Auto-pan to force camera to a spot (like center)
        this.isAutoPanning = false;
        this.autoPanX = 0;
        this.autoPanY = 0;
        this.panSpeed = 0.01;
    }

    onResize(width, height) {
        this.viewportWidth = width;
        this.viewportHeight = height;
    }

    /**
     * Start a dramatic transition: zoom out and fly to a specific coordinate
     */
    transitionTo(x, y, zoom, panSpeed = 0.01, zoomSpeed = 0.005) {
        this.isAutoPanning = true;
        this.autoPanX = x;
        this.autoPanY = y;
        this.targetZoom = zoom;
        this.panSpeed = panSpeed;
        this.zoomSpeed = zoomSpeed;
    }

    setZoomTarget(zoom, speed = 0.005) {
        this.targetZoom = zoom;
        this.zoomSpeed = speed;
    }

    /**
     * @param {number} time 
     * @param {number} panX - from InteractionManager
     * @param {number} panY - from InteractionManager
     * @param {number} dt 
     */
    update(time, panX, panY, dt) {
        let dx = 0;
        let dy = 0;

        // Organic drift
        for (const layer of this.driftLayers) {
            dx += layer.ampX * Math.sin(time * layer.freqX + layer.phaseX);
            dy += layer.ampY * Math.sin(time * layer.freqY + layer.phaseY);
        }
        
        // Base camera position
        let currentX = (dx * this.viewportWidth) + panX;
        let currentY = (dy * this.viewportHeight) + panY;

        const distanceFromHome = Math.hypot(currentX, currentY);
        if (!this.isAutoPanning && distanceFromHome > this.maxBoundary) {
            const pull = this.maxBoundary / distanceFromHome;
            currentX = currentX * pull;
            currentY = currentY * pull;
        }

        if (this.isAutoPanning) {
            // Smoothly interpolate towards the autoPan target
            currentX += (this.autoPanX - currentX) * this.panSpeed;
            currentY += (this.autoPanY - currentY) * this.panSpeed;
        }

        this.x = currentX;
        this.y = currentY;

        // Smoothly interpolate zoom
        this.zoom += (this.targetZoom - this.zoom) * this.zoomSpeed;
    }

    /**
     * Deep Parallax projection.
     * @param {number} worldX 
     * @param {number} worldY 
     * @param {number} z - Depth (0.2 far, 1.0 neutral, 2.0 close)
     */
    worldToScreen(worldX, worldY, z = 1.0) {
        const centerX = this.viewportWidth / 2;
        const centerY = this.viewportHeight / 2;

        // The center of the screen is the pivot point for parallax and zoom.
        return {
            x: centerX + (worldX - this.x) * z * this.zoom,
            y: centerY + (worldY - this.y) * z * this.zoom
        };
    }
}
