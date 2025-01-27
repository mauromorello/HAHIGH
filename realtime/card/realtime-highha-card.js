const version = "0.1.3"; //Setting up...

/********************************************************
 * Import LitElement libraries (version 2.4.0)
 * We use the CDN for simplicity, but you could also
 * use the version bundled with Home Assistant.
 *******************************************************/
import { html, css, LitElement } from "https://unpkg.com/lit-element@2.4.0/lit-element.js?module";

/******************************************************
 * REGISTRAZIONE CARD NEL PICKER DI LOVELACE
 ******************************************************/
window.customCards = window.customCards || [];
window.customCards.push({
  type: "realtime-highha-card",
  name: "Realtime High HA Card",
  description: "Visualizza dati in tempo reale...",
  // Facoltativo, per avere l’anteprima:
  preview: true
});

/******************************************************
 * CLASSE PRINCIPALE (già vista, semplificata)
 * - getConfigElement() e getStubConfig() per l’editor
 ******************************************************/
class RealtimeHighHaCard extends LitElement {

  static get properties() {
    console.log("getProprieties");
    return {
      _config: { type: Object },
      _chart: { type: Object },
      _pollingTimer: { type: Number }
    };
  }

  static getConfigElement() {
    console.log("Create Element");
    return document.createElement("realtime-highha-card-editor");
  }

  static getStubConfig() {
    console.log("getStubConfig");
    return {
      title: "Realtime Chart",
      entity: ["sensor.pzem_power"],
      chart: {
        type: "line",
        data_kept: 120,
        update_interval: 5
      },
      config: {}  // Opzioni extra Highcharts
    };
  }


  setConfig(config) {
      console.log("Card: setConfig chiamato con:", config);
      
      // Ferma il polling attuale se esiste
      if (this._pollingTimer) {
          console.log("🛑 Config cambiata: fermo il polling precedente.");
          clearInterval(this._pollingTimer);
          this._pollingTimer = null;
      }
    
      // Manteniamo direttamente la configurazione passata, senza sovrascrivere campi
      this._config = { ...config };
  
      // Resettiamo eventuali dati precedenti
      this._lastData = null;
      this.setupComplete = false;
  
      // Imposta l'intervallo di aggiornamento (di default 5s se non specificato)
      this.updateInterval = config.chart?.update_interval || 1;
  
      // Controlliamo se ci sono entità definite
      const entitiesDefined = Array.isArray(config.entity) && config.entity.length > 0;
  
      if (!entitiesDefined) {
          throw new Error("You must define at least one entity in the configuration.");
      }
  
      // Se Home Assistant è disponibile, recupera tutte le entità sensore
      if (this.hass) {
          this._entities = Object.keys(this.hass.states).filter((e) => e.startsWith("sensor."));
      } else {
          this._entities = []; // Inizializza la lista vuota
      }
  
      console.log("Card: Configurazione aggiornata:", this._config);
  }

  disconnectedCallback() {
      super.disconnectedCallback();
      console.log("❌ Card rimossa: sto fermando il polling!");
      
      if (this._pollingTimer) {
          clearInterval(this._pollingTimer);
          this._pollingTimer = null;
      }
  }  

  set hass(newHass) {
    if (!newHass) return;

    // Se non hai ancora una config o entità definita
    if (!this._config || !this._config.entity?.length) {
      return;
    }

    // Se non c'era un hass precedente, assegna e stop
    if (!this._hass) {
      this._hass = newHass;
      // Potresti fare un primo update del grafico
      this._updateData("HASS");
      return;
    }

    // Controlla se l'entità (o le entità) configurata è effettivamente cambiata.
    const relevantEntities = this._config.entity;
    let changed = false;

    for (const ent of relevantEntities) {
      const oldState = this._hass.states[ent];
      const newState = newHass.states[ent];
      if (!oldState || !newState) continue;

      // Se stato o attributi differiscono, segna un cambio
      if (
        oldState.state !== newState.state ||
        JSON.stringify(oldState.attributes) !== JSON.stringify(newState.attributes)
      ) {
        changed = true;
        break;
      }
    }

    if (!changed) {
      // Se non è cambiato nulla di rilevante, niente aggiornamento
      return;
    }

    // Altrimenti aggiorna e richiama la sola funzione che aggiorna il grafico
    this._hass = newHass;
    //this._updateData();  // Aggiorni i valori sul grafico
  }

  async _loadHighcharts() {
      return new Promise(async (resolve, reject) => {
          // Se Highcharts è già caricato, risolvi subito
          if (window.Highcharts) {
              resolve();
              return;
          }
  
          // Se un altro script è in fase di caricamento, aspettiamo che finisca
          if (window._highchartsLoading) {
              window._highchartsLoading.then(resolve).catch(reject);
              return;
          }
  
          // Lista di script da caricare in ordine
          const scripts = [
              "https://code.highcharts.com/highcharts.js",
              "https://code.highcharts.com/highcharts-more.js",
              "https://code.highcharts.com/modules/bullet.js",
              "https://code.highcharts.com/modules/solid-gauge.js",
          ];
  
          console.log("📥 Inizio caricamento Highcharts in sequenza...");
  
          // Funzione per caricare un singolo script e aspettare che termini
          const loadScript = (src) => {
              return new Promise((scriptResolve, scriptReject) => {
                  const script = document.createElement("script");
                  script.src = src;
                  script.async = true;
                  script.onload = () => {
                      console.log(`✅ Caricato: ${src}`);
                      scriptResolve();
                  };
                  script.onerror = () => {
                      console.error(`❌ Errore nel caricamento di: ${src}`);
                      scriptReject();
                  };
                  document.head.appendChild(script);
              });
          };
  
          // Carica gli script uno alla volta
          try {
              for (const src of scripts) {
                  await loadScript(src);
              }
              console.log("🎯 Tutti gli script di Highcharts caricati con successo!");
              resolve();
          } catch (error) {
              console.error("❌ Errore nel caricamento degli script Highcharts:", error);
              reject(error);
          }
      });
  }

  firstUpdated() {
    this._initChart();
    console.log("First Updated");
  }

  async _initChart() {
    await this._loadHighcharts();
    // Costruiamo il grafico la prima volta con una serie vuota
    console.log(window.Highcharts)
    this._renderChart([]);
    this._startPolling();

  }

  _startPolling() {
      console.log("Start Polling");
      const interval = this._config.chart?.update_interval || 1;
  
      if (this._pollingTimer) {
          console.log("⏸️ Polling già attivo, non avvio un nuovo timer.");
          return; // Evita di creare un nuovo polling
      }
  
      console.log(`Polling avviato con intervallo di ${interval} secondi`);
      this._updateData();
      
      this._pollingTimer = setInterval(() => {
          //console.log("Polling: aggiornamento dati...");
          this._updateData("polling");
      }, interval * 1000);
  }

  _updateData(source = "unknown") {  // 🔹 Aggiunto parametro `source`
      if (!this._hass || !this._chart) return;
  
      const entityId = this._config.entity?.[0] || "";
      const stateObj = this._hass.states[entityId];
      if (!stateObj) return;
  
      const val = parseFloat(stateObj.state);
      if (isNaN(val)) return;
  
      console.log(`📊 Nuovo dato al grafico: ${val} (da: ${entityId}, origine: ${source})`);
  
      const now = new Date();
      const localTime = now.getTime() - now.getTimezoneOffset() * 60000;
      const keep = this._config.chart?.data_kept || 120;
  
      this._chart.series[0].addPoint([localTime, val], true, this._chart.series[0].data.length >= keep);
  }


  _renderChart(seriesData) {
    console.log("⚙️ _renderChart called with data:", seriesData, "and config:", this._config);
    
    if (!seriesData || seriesData.length === 0) {
      // Almeno una serie "vuota" per evitare errori
      seriesData = [{
        name: "My Sensor",
        data: []
      }];
    }

    if (!window.Highcharts) {
      this._loadHighcharts().then(() => this._renderChart(seriesData));
      return;
    }
  
    const container = this.shadowRoot.getElementById("chartContainer");
    if (!container) return;
  
    // Se la config è in _config.chart, recuperiamo il type; altrimenti "line"
    let chartType = (this._config.chart && this._config.chart.type) || "line";
  
    // Se hai ancora una mappa per i tipi "areastacked", "barstacked", ecc.
    const chartTypeMap = {
      "areastacked": "area",
      "areastackedpercent": "area",
      "barstacked": "bar",
      "columnstacked": "column"
    };
    if (chartTypeMap[chartType]) {
      chartType = chartTypeMap[chartType];
    }
  
    // Opzioni base (per line/area/bar ecc.)
    const baseOptions = {
      chart: {
        type: chartType,
        zooming: { type: "xy" }
      },
      tooltip: {
        valueDecimals: 1
      },
      legend: {
        enabled: this._config.legend === true
      },
      credits: {
        enabled: false
      },
      title: {
        text: null
      },
      xAxis: {
        type: "datetime"
      },
      yAxis: {
        title: { text: null },
        max: this._config.max_y !== undefined ? this._config.max_y : null
      },
      series: seriesData
    };
  
    // Opzioni specifiche per gauge, bullet, pie ecc.
    const typeSpecificOptions = {};
  
    switch (chartType) {
      case "solidgauge":
        typeSpecificOptions.chart = { type: "solidgauge" };
        typeSpecificOptions.pane = { startAngle: -140, endAngle: 140 };
        typeSpecificOptions.yAxis = {
          min: 0,
          max: 100,
          title: { text: null }
        };
        // Disabilitiamo la leggenda se vogliamo
        typeSpecificOptions.legend = { enabled: false };
        break;
  
      case "bullet":
        typeSpecificOptions.chart = { type: "bullet" };
        typeSpecificOptions.plotOptions = {
          series: { pointPadding: 0.25, groupPadding: 0 }
        };
        break;
  
      case "pie":
        typeSpecificOptions.chart = { type: "pie" };
        delete baseOptions.xAxis;  // Non serve asse x
        delete baseOptions.yAxis;  // Non serve asse y
        break;
  
      // Altri case se occorrono
      default:
        break;
    }
  
    // Se l’utente ha definito opzioni stacking (areastacked, ecc.)
    // e/o “chart_options” globali (custom code / JSON)
    let globalChartOptions = {};
    if (this._config.chart_options) {
      try {
        const code = this._config.chart_options;
        const func = new Function("Highcharts", "return " + code);
        globalChartOptions = func(window.Highcharts);
      } catch (e) {
        this._queryError = "Chart options wrong";
        globalChartOptions = {};
      }
    }
  
    // Fusione finale di tutto
    const finalOptions = Highcharts.merge(
      {},
      baseOptions,
      typeSpecificOptions,
      this._config.stackedOptions || {},
      globalChartOptions || {}
    );
  
    // Creiamo il grafico con le opzioni finali
    // Non serve più stockChart, quindi usiamo sempre Highcharts.chart
    this._chart = Highcharts.chart(container, finalOptions);
    console.log("Finish Render");
  }

  render() {
      console.log("Render chiamato a:", new Date().toLocaleTimeString());
      if (!this._config) return html``;
  
      return html`
        <ha-card .header=${this._config.title || ""}>
          ${this._queryError ? html`
            <div style="color: red; padding: 10px; border: 1px solid red; background: #ffe6e6; margin-bottom: 10px;">
                <strong>⚠️ Errore:</strong> ${this._queryError}
            </div>
          ` : ""}
  
          <div id="chartContainer" style="width: 100%; height: ${this._config.chart_height || "100%"};">
          </div>
        </ha-card>
      `;
  }

}



/******************************************************
 * EDITOR (RealtimeHaHighCardEditor)
 * - Mostra un’interfaccia minimal per configurare
 *   entities, chart (data_kept, update_interval, type), ecc.
 ******************************************************/
class RealtimeHighHaCardEditor extends LitElement {
  
  static get properties() {
    return {
      hass: {},
      _config: {},
      activeTab: {}
    };
  }

  constructor() {
    super();
    this.activeTab = "entities";
    this._config = {};
  }

    setConfig(config) {
      
      this._config = { ...config, entities: config.entities || [] };

      // 🔹 Se la configurazione non ha entità definite, usiamo quelle già trovate
      if (!this._entities || this._entities.length === 0) {
        this._entities = Object.keys(this.hass?.states || {}).filter(
          (e) => e.startsWith("sensor.")
        );

      }
    }

  get config() {
    return this._config;
  }

  // Notifica Lovelace che la configurazione è cambiata
  _dispatchConfig() {
    const newConfig = { ...this._config };
    this.dispatchEvent(new CustomEvent("config-changed", {
      detail: { config: newConfig },
      bubbles: true,
      composed: true
    }));
  }

  _valueChanged(e) {
      const field = e.target.getAttribute("data-field");
      if (!field) return;
      const newValue = e.target.value;
  
      // Creiamo una copia della configurazione per evitare modifiche dirette a oggetti immutabili
      const newConfig = { ...this._config };
  
      if (field === "title") {
          newConfig.title = newValue;
      } else if (field === "update_interval") {
          newConfig.chart = { ...newConfig.chart, update_interval: parseInt(newValue) || 5 };
      } else if (field === "data_kept") {
          newConfig.chart = { ...newConfig.chart, data_kept: parseInt(newValue) || 120 };
      } else if (field === "chart_type") {
          newConfig.chart = { ...newConfig.chart, type: newValue };
      }
  
      // Aggiorniamo la configurazione e notifichiamo il cambiamento
      this._config = newConfig;
      this._dispatchConfig();
  }

  // Aggiorna la lista di entità
  _entityChanged(e) {
    const index = parseInt(e.target.getAttribute("data-index"), 10);
    const newVal = e.target.value;
    if (!this._config.entity || index < 0) return;

    // Sovrascrive la singola entry
    const newArr = [...this._config.entity];
    newArr[index] = newVal;
    this._config.entity = newArr;
    this._dispatchConfig();
  }

  // Aggiunge un’entità
  _addEntity() {
    this._config.entity = [...this._config.entity, "sensor.new_sensor"];
    this._dispatchConfig();
  }

  // Rimuove un’entità
  _removeEntity(index) {
    const newArr = [...this._config.entity];
    newArr.splice(index, 1);
    this._config.entity = newArr;
    this._dispatchConfig();
  }

  render() {
    if (!this._config) return html``;

    return html`
      <div class="card-config">
        <div class="tabs">
          <mwc-button @click=${() => (this.activeTab = "entities")} ?raised=${this.activeTab === "entities"}>Entities</mwc-button>
          <mwc-button @click=${() => (this.activeTab = "chart")} ?raised=${this.activeTab === "chart"}>Chart</mwc-button>
          <mwc-button @click=${() => (this.activeTab = "advanced")} ?raised=${this.activeTab === "advanced"}>Advanced</mwc-button>
        </div>

        <!-- ENTITIES TAB -->
        <div class="section" style="display:${this.activeTab === "entities" ? "block" : "none"};">
          <h4>Entities</h4>
          ${this._config.entity.map((ent, i) => html`
            <div class="entity-row">
              <ha-textfield
                .value=${ent}
                data-index=${i}
                @input=${this._entityChanged}
              ></ha-textfield>
              <mwc-icon-button @click=${() => this._removeEntity(i)}>
                <ha-icon icon="hass:delete"></ha-icon>
              </mwc-icon-button>
            </div>
          `)}
          <mwc-button raised @click=${this._addEntity}>
            <ha-icon icon="hass:plus"></ha-icon> Add Entity
          </mwc-button>
        </div>

        <!-- CHART TAB -->
        <div class="section" style="display:${this.activeTab === "chart" ? "block" : "none"};">
          <h4>Chart Options</h4>
          <ha-textfield
            label="Title"
            data-field="title"
            .value=${this._config.title}
            @input=${this._valueChanged}
          ></ha-textfield>

          <ha-select
            label="Type"
            data-field="chart_type"
            .value=${this._config.chart?.type || "line"}
            @selected=${this._valueChanged}
            @closed=${(e) => e.stopPropagation()}
          >
            <mwc-list-item value="line">Line</mwc-list-item>
            <mwc-list-item value="spline">Spline</mwc-list-item>
            <mwc-list-item value="area">Area</mwc-list-item>
            <mwc-list-item value="areaspline">Area Spline</mwc-list-item>
            <mwc-list-item value="solidgauge">Solid Gauge</mwc-list-item>
            <mwc-list-item value="bullet">Bullet</mwc-list-item>
            <mwc-list-item value="pie">Pie</mwc-list-item>
          </ha-select>

          <ha-textfield
            label="Data Kept"
            data-field="data_kept"
            .value=${this._config.chart?.data_kept ?? 120}
            @input=${this._valueChanged}
          ></ha-textfield>

          <ha-textfield
            label="Update Interval (s)"
            data-field="update_interval"
            .value=${this._config.chart?.update_interval ?? 5}
            @input=${this._valueChanged}
          ></ha-textfield>
        </div>

        <!-- ADVANCED TAB -->
        <div class="section" style="display:${this.activeTab === "advanced" ? "block" : "none"};">
          <h4>Advanced Highcharts Config</h4>
          <p>Opzioni aggiuntive da mergiare (JSON o funzione JS). Ad esempio: <code>{ "yAxis": { "max": 100 } }</code></p>
          <label class="mdc-text-field mdc-text-field--outlined mdc-text-field--textarea">
            <span class="mdc-notched-outline">
              <span class="mdc-notched-outline__leading"></span>
              <span class="mdc-floating-label">Highcharts config</span>
              <span class="mdc-notched-outline__trailing"></span>
            </span>
            <span class="mdc-text-field__resizer">
              <textarea
                class="mdc-text-field__input"
                rows="6"
                style="width: 100%;"
                .value=${JSON.stringify(this._config.config || {}, null, 2)}
                @input=${(e) => {
                  try {
                    this._config.config = JSON.parse(e.target.value);
                    this._dispatchConfig();
                  } catch {
                    // Se l'utente non inserisce un JSON valido, ignoriamo
                  }
                }}
              ></textarea>
            </span>
          </label>
        </div>
      </div>
    `;
  }

  static get styles() {
    return css`
      .card-config {
        display: flex;
        flex-direction: column;
        gap: 16px;
      }
      .tabs {
        display: flex;
        gap: 8px;
        margin-bottom: 8px;
      }
      .section {
        border: 1px solid var(--primary-color);
        padding: 16px;
        border-radius: 8px;
        background: var(--card-background-color);
      }
      .entity-row {
        display: flex;
        align-items: center;
        gap: 6px;
        margin-bottom: 8px;
      }
      ha-textfield {
        width: 70%;
      }
    `;
  }
}

customElements.define("realtime-highha-card-editor", RealtimeHighHaCardEditor);

customElements.define("realtime-highha-card", RealtimeHighHaCard);
