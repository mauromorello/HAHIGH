class Hag5RendererCard extends HTMLElement {
    config;
    iframe;
    currentFileName;
    currentProgress;

    // required
    setConfig(config) {
        this.config = config;
    }

    set hass(hass) {
        const printingFileNameEntity = 'sensor.printing_file_name';
        const printProgressEntity = 'sensor.print_progress';

        const printingFileNameState = hass.states[printingFileNameEntity]?.state || 'unavailable';
        const printProgressState = hass.states[printProgressEntity]?.state || '0';

        // Aggiorna il file e la percentuale insieme ogni volta che cambia la percentuale
        if (this.currentProgress !== printProgressState) {
            this.currentFileName = printingFileNameState;
            this.currentProgress = printProgressState;
    
            // Invia il nome del file e la percentuale insieme
            this.updateIframe({ fileName: this.currentFileName, progress: this.currentProgress });
        }
        

        // Crea il contenuto della card solo se non esiste
        if (!this.iframe) {
            this.innerHTML = `
                <ha-card header="3D Print Renderer">
                    <div class="card-content">
                        <iframe id="renderer-iframe" src="/local/community/haghost5/hag5_visualizer.html" style="width: 100%; height: 400px; border: none;"></iframe>
                    </div>
                </ha-card>
            `;
            this.iframe = this.querySelector('#renderer-iframe');
            
            // Forza un aggiornamento iniziale
            this.updateIframe({ fileName: this.currentFileName, progress: this.currentProgress });

        }
    }

    // Funzione per inviare messaggi all'iframe
    updateIframe(data) {
        const retryInterval = 500; // Millisecondi
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

customElements.define('hag5-renderer-card', Hag5RendererCard);
