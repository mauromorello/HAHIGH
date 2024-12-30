class HaHighCard extends HTMLElement {
    setConfig(config) {
        if (!config.entity) {
            throw new Error("You need to define an entity");
        }
        this.config = config;
    }

    set hass(hass) {
        const type = this.config.type || 'default';
        const entity = this.config.entity;

        if (!this.content) {
            this.innerHTML = `
                <ha-card header="HaHigh Custom Card">
                    <div id="card-content" style="height: 400px; width: 100%;"></div>
                </ha-card>
            `;
            this.content = this.querySelector('#card-content');

            if (type === 'gauge') {
                this.content.innerHTML = `
                    <iframe 
                        src="/local/hahigh-gauge.html?entity=${entity}" 
                        style="width: 100%; height: 100%; border: none;">
                    </iframe>
                `;
            } else {
                this.content.innerHTML = '<p>Unsupported card type</p>';
            }
        }
    }
}

customElements.define('hahigh-card', HaHighCard);
