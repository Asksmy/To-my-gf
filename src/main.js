import ExperienceManager from './core/ExperienceManager.js';

document.addEventListener('DOMContentLoaded', async () => {
    try {
        const experience = new ExperienceManager();
        await experience.init();
    } catch (error) {
        console.error("Failed to initialize PROJECT: HOME", error);
    }
});
