class HaHighGaugeCard extends HTMLElement {
    config;
    iframe;
    currentSensorValue;

    // required
    setConfig(config) {
        this.config = config;
    }

    set hass(hass) {
        const sensorEntity = this.config.entity;

        if (!sensorEntity) {
            console.error("No entity defined in the card configuration.");
            return;
        }

        const sensorState = hass.states[sensorEntity]?.state || 'unavailable';

        // Update the sensor value only if it has changed
        if (this.currentSensorValue !== sensorState) {
            this.currentSensorValue = sensorState;
            this.updateIframe({ sensorValue: this.currentSensorValue });
        }

        // Create the card content if it doesn't exist
        if (!this.iframe) {
            const title = this.config.title || 'Gauge';
            const x = this.config.x || '50';
            const y = this.config.y || '50';
            const max = this.config.max || '100';
            const unit = this.config.unit || '';
            const size = this.config.zoom || '100';

            this.innerHTML = `
                <ha-card header="Gauge Sensor">
                    <div class="card-content">
                        <iframe id="gauge-iframe" 
                                src="/local/community/hahigh/hahigh-gauge-card/hahigh-gauge.html?t=${title}&x=${x}&y=${y}&m=${max}&u=${unit}&z=${size}" 
                                style="width: 100%; height: 400px; border: none;"></iframe>
                    </div>
                </ha-card>
            `;
            this.iframe = this.querySelector('#gauge-iframe');

            // Force an initial update
            this.updateIframe({ sensorValue: this.currentSensorValue });
        }
    }

    // Function to send messages to the iframe
    updateIframe(data) {
        const retryInterval = 500; // Milliseconds
        const maxRetries = 10;
        let retries = 0;

        const sendMessage = () => {
            if (this.iframe && this.iframe.contentWindow) {
                console.log('Sending message to iframe:', data);
                this.iframe.contentWindow.postMessage(data, '*');
            } else if (retries < maxRetries) {
                retries++;
                console.warn('Iframe not ready. Retrying...');
                setTimeout(sendMessage, retryInterval);
            } else {
                console.error('Failed to send message to iframe after retries:', data);
            }
        };

        sendMessage();
    }
}

customElements.define('hahigh-gauge-card', HaHighGaugeCard);
