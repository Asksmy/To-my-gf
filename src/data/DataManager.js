export default class DataManager {
    constructor() {
        this.memories = null;
        this.theme = null;
        this.narration = null;
    }

    async loadAll() {
        try {
            const [memoriesRes, themeRes, narrationRes] = await Promise.all([
                fetch('./data/memories.json'),
                fetch('./data/theme.json'),
                fetch('./data/narration.json')
            ]);
            
            this.memories = await memoriesRes.json();
            this.theme = await themeRes.json();
            this.narration = await narrationRes.json();
        } catch (error) {
            console.error("Failed to load JSON data:", error);
        }
    }

    getMemories() { return this.memories; }
    getTheme() { return this.theme; }
    getNarration() { return this.narration; }
}
