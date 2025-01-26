const version = "0.8.5"; //Selector (Highstock)

/********************************************************
 * Import LitElement libraries (version 2.4.0)
 * We use the CDN for simplicity, but you could also
 * use the version bundled with Home Assistant.
 *******************************************************/
import { html, css, LitElement } from "https://unpkg.com/lit-element@2.4.0/lit-element.js?module";

// Variabile globale per evitare caricamenti multipli
window._highchartsLoading = window._highchartsLoading || null;


/********************************************************
 *                 MAIN CARD CLASS
 * Extends LitElement but implements the same logic
 * as the previous "HighInfluxCard" you had working.
 ********************************************************/
class TimeseriesHighInfluxCard extends LitElement {
  
  constructor() {
    super();

    if (!TimeseriesHighInfluxCard._hassGlobal) {
        TimeseriesHighInfluxCard._hassGlobal = null; // 🔹 Inizializza la variabile globale
    }
  }

  /**
   * Reactive properties for the card:
   * _config: the configuration object provided by the user
   * _hass: the Home Assistant object (if needed)
   * _lastData: used to check if Influx data changed
   * _timeoutId: used to manage the auto-update interval
   * setupComplete: a flag to avoid re-initializing more than once
   */
  static get properties() {
    return {
      _config: { type: Object },
      _hass: { type: Object },
      _entities: { type: Array }, // Lista di entità disponibili
      _lastData: { type: Object },
      _timeoutId: { type: Number },
      setupComplete: { type: Boolean }
    };
  }

  /**
   * getConfigElement and getStubConfig:
   * - getConfigElement returns the custom editor element
   * - getStubConfig returns a minimal working config
   */
  static getConfigElement() {
    return document.createElement("timeseries-highinflux-card-editor");
  }

  static getStubConfig() {
    // Basic default configuration
    return {
      title: "HAHIGH!",
      influx_url: "http://localhost:8086",
      influx_db: "mydb",
      influx_user: "admin",
      influx_password: "password"
    };
  }

  /**
   * setConfig is called by Lovelace when the user adds or
   * updates the card configuration in the UI or YAML.
   */
  setConfig(config) {
    this._config = config;
    this._lastData = null;
    this.setupComplete = false;

    // Auto-update interval in ms (default: 60s)
    this.updateInterval = (config.update_interval) || 60;

    // Check if we have single-query configuration or multiple entities
    const singleQueryDefined =
      config.influx_url && config.influx_db &&
      config.influx_user && config.influx_password;

    const entitiesDefined =
      Array.isArray(config.entities) && config.entities.length > 0;

    if (!singleQueryDefined && !entitiesDefined) {
      throw new Error(
        "You must define either a set of entities (entities) or the single parameters (influx_url, influx_db, etc.)."
      );
    }
    
      // Se Home Assistant è già disponibile
      if (this.hass) {
        this._entities = Object.keys(this.hass.states).filter(
          (e) => e.startsWith("sensor.") // Filtra solo i sensori
        );
      } else {
        this._entities = []; // Inizializza vuoto
      }
      
  }
  
  
   /**
   * Per riprendesi le entità
   * once updates the card.
   */  
    updated(changedProps) {
      if (changedProps.has("hass")) {
    
        this._entities = Object.keys(this.hass.states).filter(
          (e) => e.startsWith("sensor.") // Recupera solo i sensori
        );
        
      }
    }
  

  /**
   * Called by Lovelace on each update cycle.
   * Typically used to store the hass object if needed.
   */
    set hass(hass) {
        if (!hass) {
            return;
        }


        // 🔹 Salviamo `hass` in una variabile statica globale
        TimeseriesHighInfluxCard._hassGlobal = hass;
        this._hass = hass;

        if (!this._hass.states) {
            console.warn("⚠️ `hass.states` non è disponibile! Riproverò più tardi.");
            return;
        }

        const newEntities = Object.keys(this._hass.states).filter(
            (e) => e.startsWith("sensor.")
        );

        if (JSON.stringify(newEntities) === JSON.stringify(this._entities)) {
            return;
        }

        this._entities = newEntities;
    }


  /**
   * The LitElement render() method builds the DOM that will
   * be displayed to the user. Here we place an ha-card with
   * a container for the Highcharts chart.
   */
  render() {
      // If config is not ready, render nothing
      if (!this._config) {
          return html``;
      }
  
      return html`
        <ha-card .header=${this._config.title || ""}>
          ${this._queryError ? html`
            <div style="color: red; padding: 10px; border: 1px solid red; background: #ffe6e6; margin-bottom: 10px;">
                <strong>⚠️ Errore:</strong> ${this._queryError}
            </div>
          ` : ""}
  
          <div
            id="chartContainer"
            style="width: 100%; height: ${this._config.chart_height || "100%"};"
          >
          </div>
        </ha-card>
      `;
  }


  /**
   * Optional CSS styles for the card
   */
  static get styles() {
    return css`
      :host {
        display: block;
      }
    `;
  }

  /**
   * firstUpdated is called by LitElement after the DOM
   * is rendered for the first time. A good place to
   * load Highcharts and start the data update loop.
   */
  firstUpdated() {
    // Se non è già stato configurato, carica Highcharts
    if (!this.setupComplete) {
      this._loadHighcharts().then(() => {
        this.setupComplete = true;
        this._startAutoUpdate();
      });
    }
  
  }


  /**
   * When the element is removed from the DOM,
   * clear any existing update interval.
   */
  disconnectedCallback() {
    super.disconnectedCallback();
    if (this._timeoutId) {
      clearInterval(this._timeoutId);
      this._timeoutId = null;
    }
  }

  /**
   * Starts the auto-update fetch interval if not already started
   */
  _startAutoUpdate() {
    if (this._timeoutId) {
      clearInterval(this._timeoutId);
    }
    this._fetchData(); // immediate fetch
    this._timeoutId = setInterval(() => this._fetchData(), this.updateInterval * 1000);
  }

  /**
   * Loads the Highcharts script from a CDN (if not already loaded).
   */

  
  async _loadHighcharts() {
      return new Promise((resolve, reject) => {
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
  
          // Lista di script da caricare
          // Se serve altro
          const scripts = [

              "https://code.highcharts.com/stock/highstock.js"
          ];
  
          // Carica tutti gli script in parallelo
          window._highchartsLoading = Promise.all(
              scripts.map((src) => new Promise((scriptResolve, scriptReject) => {
                  const script = document.createElement("script");
                  script.src = src;
                  script.async = true;
                  script.onload = () => {
                      scriptResolve();
                  };
                  script.onerror = () => {
                      scriptReject();
                  };
                  document.head.appendChild(script);
              }))
          ).then(resolve).catch(reject);
      });
  }


  

  /**
   * Main function to query InfluxDB, supporting either
   * - Single-parameter config (influx_query, etc.)
   * - Multiple entities (config.entities)
   */
  async _fetchData() {
  const config = this._config;
  const entitiesDefined = Array.isArray(config.entities) && config.entities.length > 0;


  if (entitiesDefined) {
    // Multiple entities => multiple queries
    try {
      const allSeriesData = await Promise.all(
        config.entities.map((entity) => this._fetchEntityData(entity))
      );

      // Costruiamo la serie per ogni entity
      const chartSeries = allSeriesData.map((dataObj, i) => {
        // Valori base della serie
        const baseSeries = {
          name: config.entities[i].name || null,
          color: config.entities[i].color || null,
          data: dataObj.parsedData,
          tooltip: {
            valueSuffix: config.entities[i].unita_misura
              ? ` ${config.entities[i].unita_misura}`
              : ""
          }
        };

        // Se ci sono opzioni extra, tentiamo di fare il parse del JSON
        let extraOptions = {};
        if (config.entities[i].options && typeof config.entities[i].options === "string") {
          try {
            const code = config.entities[i].options;
            try {
              // Passa l'oggetto Highcharts alla funzione 
              const func = new Function("Highcharts", "return " + code);
              extraOptions = func(window.Highcharts);
            } catch (e) {

              this._queryError = `Wrong chart options;`;
              extraOptions = {};
            }
 
          } catch (e) {

            this._queryError = `Configuration not valid in serie #${i};`;
            extraOptions = {};
          }
        }

        return Highcharts.merge(baseSeries, extraOptions);
      });

      // Se i dati sono cambiati, rilanciamo il rendering
      if (JSON.stringify(chartSeries) !== JSON.stringify(this._lastData)) {
        this._lastData = chartSeries;
        this._renderChart(chartSeries);
      }
    } catch (error) {
      this._queryError = `Error fetching data`;
    }
  } else {
    // Single-query mode
    this._queryError = `Need to define at least 1 entity!`;
  }
}

  /**
   * Utility function to fetch data for a single entity
   * (used in multiple-entities mode)
   */
  async _fetchEntityData(entity) {
      const config = this._config;
      if (!entity.query) {
          this._queryError = "❌ Query non valid;"
          this.requestUpdate();
          return { parsedData: [] };
      }
  
      const url =
          `${config.influx_url}/query?u=${encodeURIComponent(config.influx_user)}` +
          `&p=${encodeURIComponent(config.influx_password)}` +
          `&db=${encodeURIComponent(config.influx_db)}` +
          `&q=${encodeURIComponent(entity.query)}`;
  
      try {
          const response = await fetch(url);
          if (!response.ok) {
              throw new Error(`Errore HTTP: ${response.status}`);
          }
  
          const data = await response.json();
  
          if (!data.results[0] || !data.results[0].series) {
              this._queryError = "⚠️ Nessun risultato trovato per la query.";
              this.requestUpdate();
              return { parsedData: [] };
          }
  
          // Reset errore se la query ha avuto successo
          this._queryError = null;
          this.requestUpdate();
  
          const seriesValues = data.results[0].series[0].values;
          const parsedData = seriesValues.map((point) => [
              new Date(point[0]).getTime(),
              point[1]
          ]);
  
          return { parsedData };
  
      } catch (error) {
          this._queryError = `Query error: ${error.message}`;
          this.requestUpdate();
          return { parsedData: [] };
      }
  }


  /**
   * Builds the Highcharts chart in the #chartContainer div
   */
    _renderChart(seriesData) {
      if (!window.Highcharts) {

        this._loadHighcharts().then(() => this._renderChart(seriesData));
        return;
      }
    
      const container = this.shadowRoot.getElementById("chartContainer");
      if (!container) return;
      
      // Mappa delle conversioni personalizzate
      const chartTypeMap = {
          "areastacked": "area",
          "areastackedpercent": "area",
          "barstacked": "bar",
          "columnstacked": "column"
      };

      // Se il valore esiste nella mappa, usa la versione corretta, altrimenti lascia invariato
      const chartType = chartTypeMap[this._config.chart_type] || this._config.chart_type;
    
      // Opzioni base
      const baseOptions = {
        chart: {
          type: chartType || "line",
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
    
      // Parso le eventuali opzioni globali
      let globalChartOptions = {};
      if (this._config.chart_options) {
        try {
          const code = this._config.chart_options;
          const func = new Function("Highcharts", "return " + code);
          globalChartOptions = func(window.Highcharts);
        } catch (e) {
          this._queryError = `Chart options wrong`;
          globalChartOptions = {};
        }
      }
    

      // Unisco le due parti prima di creare il grafico
      const finalOptions = Highcharts.merge(
          {},  // Un oggetto vuoto evita la modifica di baseOptions
          baseOptions,
          this._config.stackedOptions || {},  // Fusione stacking
          globalChartOptions || {}  // Fusione chart_options
      );

      
      // Creo il grafico con le opzioni finali
      const chartFunction = this._config.selector ? Highcharts.stockChart : Highcharts.chart;
      chartFunction(container, finalOptions);
    }
}

/**
 * Register the custom card in Home Assistant so it can be
 * selected in the card picker with type: "timeseries-highinflux-card".
 */
window.customCards = window.customCards || [];
window.customCards.push({
  type: "timeseries-highinflux-card",
  name: "Timeseries High Influx Card",
  description: "A card that displays data from InfluxDB using Highcharts"
});

/********************************************************
 *            CARD EDITOR (TimeseriesHighInfluxCardEditor)
 * Provides all the configurable parameters, including
 * multiple entities (entities).
 ********************************************************/
class TimeseriesHighInfluxCardEditor extends LitElement {
    
    static get properties() {
      return {
        hass: {},
        activeTab: { type: String },
        _config: {}
      };
    }
    
    constructor() {
      super();
      this.activeTab = "series"; // Tab iniziale
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

    // Funzione di supporto per ottenere `hass`, evitando errori se è undefined
    _getHass() {
        return this._hass || TimeseriesHighInfluxCard._hassGlobal;
    }

    // Gestisce i cambiamenti nei parametri di configurazione generali
    _valueChanged(ev) {
        if (!this._config) return;
    
        const target = ev.target;
        const newConfig = { ...this._config };
        const field = target.getAttribute("data-field");
        if (!field) return;
    
        if (field === "legend") {
            newConfig.legend = target.checked;
        } else if (field === "max_y") {
            newConfig.max_y = target.value.trim() === "" ? null : parseFloat(target.value);
        } else if (field === "update_interval") {
            newConfig.update_interval = parseInt(target.value, 10) || 60;
        } else if (field === "selector") {  
            // ✅ Aggiunto supporto per "selector"
            newConfig.selector = target.checked;  // Usa un ha-switch quindi target.checked
    
        } else if (field === "chart_type") {
            const validTypes = ["line", "spline", "area", "areaspline", "bar", "column", "areastacked", "areastackedpercent"];
    
            // Mantieni il valore selezionato nella select
            newConfig.chart_type = validTypes.includes(target.value) ? target.value : "line";
    
            // Mappa delle opzioni di stacking per diversi tipi di grafico
            const stackedOptionsMap = {
                "areastacked": {
                    plotOptions: {
                        area: { stacking: "normal" }
                    }
                },
                "areastackedpercent": {
                    plotOptions: {
                        area: { stacking: "percent" }
                    }
                },
                "barstacked": {
                    plotOptions: {
                        bar: { stacking: "normal" }
                    }
                },
                "columnstacked": {
                    plotOptions: {
                        column: { stacking: "normal" }
                    }
                }
            };
    
            // Se il valore esiste nella mappa, assegna le relative opzioni di stacking, altrimenti rimuovi lo stacking
            if (stackedOptionsMap[target.value]) {
                newConfig.stackedOptions = stackedOptionsMap[target.value];
            } else {
                delete newConfig.stackedOptions;
            }
    
        } else {
            newConfig[field] = target.value;
        }
    
        if (JSON.stringify(newConfig) !== JSON.stringify(this._config)) {
            this._config = newConfig;
            this._fireConfigChanged(newConfig);
        }
    }


    
    // Gestisce i cambiamenti nei parametri per ogni entità
    _entityValueChanged(ev) {
        if (!this._config) return;
    
        const target = ev.target;
        const index = parseInt(target.getAttribute("data-index"), 10);
        const field = target.getAttribute("data-field");
        if (isNaN(index) || !field) return;
    
        this._editing = true;
    
        const newEntities = [...this._config.entities];
        const updatedEntity = { ...newEntities[index] };
    
        const inputValue = ev.detail?.value || target.value || "";
        const newSensor = inputValue.replace(/^sensor\./, "");
    
        // Se cambia il sensore, aggiorna la query e cerca l'unità di misura
        if (field === "sensor" && updatedEntity.query) {

    
            updatedEntity.query = updatedEntity.query.replace(
                /("entity_id"\s*=\s*)'([^']*)'/,
                `$1'${newSensor}'`
            );

            const hass = this._getHass();
    
            if (!hass || !hass.states) {
                //console.error("❌ ERRORE: `_hass` o `hass.states` è undefined.");
            } else {
    
                const sensorData = hass.states["sensor." + newSensor];
                
                if (sensorData) {
                    const unit = sensorData.attributes?.unit_of_measurement || "";
    
                    if (unit && updatedEntity.unita_misura !== unit) {
                        
                        updatedEntity.unita_misura = unit;
                        updatedEntity.sensor = inputValue;
                        updatedEntity.name = newSensor;
    
                        updatedEntity.query = updatedEntity.query.replace(
                            /FROM\s+"([^"]+)"/i,
                            `FROM "${unit}"`
                        );
                        
                        this._forceRender = true; // 🔹 Attiviamo il rendering forzato
                    }
                } else {
                   this._queryError = `Sensor not found`;
                }
            }
    
            if (!updatedEntity.name || updatedEntity.name === updatedEntity.sensor) {
                updatedEntity.name = newSensor;
                
            }
        }
    
        // Se viene modificata manualmente l'unità di misura, aggiorna solo la query
        if (field === "unita_misura" && updatedEntity.query) {
    
            updatedEntity.query = updatedEntity.query.replace(
                /FROM\s+"([^"]+)"/i,
                `FROM "${inputValue}"`
            );
    
        }
        
        updatedEntity[field] = inputValue;
        newEntities[index] = updatedEntity;
    
        if (JSON.stringify(newEntities) !== JSON.stringify(this._config.entities)) {
            this._config = { ...this._config, entities: newEntities };
            this._fireConfigChanged(this._config);
        }
    

    }

    // Add a new blank entity
    _addEntity() {
      if (!this._config) return;
      const newEntities = [...(this._config.entities || [])];
      // Example of a "blank" entity
      newEntities.push({ name: "temperature", color: "", query: "SELECT mean(\"value\")  FROM \"°C\" \r\n WHERE (\"entity_id\" = 'temperature') AND time > now() - 90d \r\n GROUP BY time(1d) fill(null)", unita_misura: "°C", sensor: "temperature" });
  
      const newConfig = { ...this._config, entities: newEntities };
      this._config = newConfig;
      this._fireConfigChanged(newConfig);
    }
  
    // Remove the entity at the given index
    _removeEntity(index) {
      if (!this._config) return;
      const newEntities = [...this._config.entities];
      newEntities.splice(index, 1);
  
      const newConfig = { ...this._config, entities: newEntities };
      this._config = newConfig;
      this._fireConfigChanged(newConfig);
    }
  
    // Dispatch config-changed event to notify Lovelace
    _fireConfigChanged(newConfig) {
      this.dispatchEvent(
        new CustomEvent("config-changed", {
          detail: { config: newConfig },
          bubbles: true,
          composed: true
        })
      );
    }

    _toggleEntityOptionsVisibility(index) {
        if (!this._config || !this._config.entities[index]) return;
    
        // Creiamo una nuova copia delle entità con lo stato aggiornato
        const newEntities = [...this._config.entities];
        newEntities[index] = {
            ...newEntities[index],
            isEntityOptionsVisible: !newEntities[index].isEntityOptionsVisible // Inverti lo stato attuale
        };
    
        // Aggiorniamo la configurazione
        const newConfig = { ...this._config, entities: newEntities };
        this._config = newConfig;
        this._fireConfigChanged(newConfig);
    }
  
    shouldUpdate(changedProps) {
     
          if (this._forceRender) {

            this._forceRender = false; // Resettiamo il flag dopo il rendering
            this.requestUpdate();
            return true;
          }
      
          // 🔹 Se `_openCombos` è undefined, non bloccare il rendering
          if (!this._openCombos || Object.keys(this._openCombos).length === 0) {
              return true;
          }
      
          // 🔹 Se almeno un combobox è aperto, blocca il rendering
          if (Object.values(this._openCombos).some(isOpen => isOpen)) {
              return false;
          }
      

          return true;
      }

    // THE BIG RENDER *******************************************************************************************
    render() {
      if (!this._config) return html``;

      return html`
        <div class="card-config">
        
          <div class="tabs">
            <mwc-button @click=${() => this.activeTab = "series"} ?raised=${this.activeTab === "series"}>Series</mwc-button>
            <mwc-button @click=${() => this.activeTab = "graph"} ?raised=${this.activeTab === "graph"}>Graph</mwc-button>
            <mwc-button @click=${() => this.activeTab = "config"} ?raised=${this.activeTab === "config"}>Config</mwc-button>
          </div>

          <div class="section" style="display: ${this.activeTab === "config" ? "block" : "none"};">
            <h4>Database Configuration</h4>
            <ha-textfield
              label="Influx URL"
              data-field="influx_url"
              .value=${this._config.influx_url || ""}
              @input=${this._valueChanged}
            ></ha-textfield>
            <ha-textfield
              label="Database"
              data-field="influx_db"
              .value=${this._config.influx_db || ""}
              @input=${this._valueChanged}
            ></ha-textfield>
            <ha-textfield
              label="User"
              data-field="influx_user"
              .value=${this._config.influx_user || ""}
              @input=${this._valueChanged}
            ></ha-textfield>
            <ha-textfield
              label="Password"
              data-field="influx_password"
              .value=${this._config.influx_password || ""}
              @input=${this._valueChanged}
              type="password"
            ></ha-textfield>
          </div>
  
          <!-- Chart type selection -->
          <div class="section" style="display: ${this.activeTab === "graph" ? "block" : "none"};">
                
            <h4>Global chart options</h4>
            
            <ha-textfield
              label="Title"
              data-field="title"
              .value=${this._config.title || ""}
              @input=${this._valueChanged}
            ></ha-textfield>

          
            <ha-select
              label="Chart Type"
              data-field="chart_type"
              .value=${this._config.chart_type || "line"}
              @selected=${this._valueChanged}
              @closed=${(e) => e.stopPropagation()}
              style="margin-bottom:15px"
            >
              <mwc-list-item value="line">Line</mwc-list-item>
              <mwc-list-item value="spline">Spline</mwc-list-item>
              <mwc-list-item value="area">Area</mwc-list-item>
              <mwc-list-item value="areaspline">Area Spline</mwc-list-item>
              <mwc-list-item value="areastacked">Area Stacked</mwc-list-item>
              <mwc-list-item value="areastackedpercent">Area Stacked %</mwc-list-item>
              <mwc-list-item value="bar">Bar</mwc-list-item>
              <mwc-list-item value="column">Column</mwc-list-item>
            </ha-select>
  
            <ha-textfield
              label="Chart Height (e.g. 300px)"
              data-field="chart_height"
              .value=${this._config.chart_height || ""}
              @input=${this._valueChanged}
            ></ha-textfield>
            
            <ha-formfield label="Show Selector">
              <ha-switch
                data-field="selector"
                .checked=${this._config.selector === true}
                @change=${this._valueChanged}
              ></ha-switch>
            </ha-formfield>
  
            <ha-formfield label="Show legend">
              <ha-switch
                data-field="legend"
                .checked=${this._config.legend === true}
                @change=${this._valueChanged}
              ></ha-switch>
            </ha-formfield>
            
            <br>
            <ha-formfield label="Enable advanced options" style="margin-bottom:10px;">
              <ha-switch
                data-field="showChartOptions"
                @change=${this._toggleOptionsVisibility}
              ></ha-switch>
            </ha-formfield>
  
            <div style="display:${this.isOptionsVisible ?  `block` :  `none`}">
            
                <ha-textfield
                  label="Max Y"
                  data-field="max_y"
                  .value=${this._config.max_y || ""}
                  @input=${this._valueChanged}
                ></ha-textfield>
                
                <ha-textfield
                  label="Update Interval (s)"
                  data-field="update_interval"
                  .value=${this._config.update_interval || ""}
                  @input=${this._valueChanged}
                ></ha-textfield>
                
                <label class="mdc-text-field mdc-text-field--outlined mdc-text-field--textarea" >
                  <span class="mdc-notched-outline">
                    <span class="mdc-notched-outline__leading"></span>
                    <span class="mdc-floating-label">Highcharts CHART options <small><a href="https://api.highcharts.com/highcharts" TARGET="BLANK">API here</a></small></span>
                    <span class="mdc-notched-outline__trailing"></span>
                  </span>
                  <span class="mdc-text-field__resizer">
                    <textarea
                      class="mdc-text-field__input"
                      spellcheck="false"
                      rows="8"
                      cols="40"
                      style="width:100% !important;"
                      aria-label="Root Chart Options"
                      data-field="chart_options"
                      @input=${this._valueChanged}
                    >${this._config.chart_options || "{}"}</textarea>
                  </span>
                </label>
              </div>    
          </div>
  
          <!-- Multiple entities configuration -->
          <div class="entities section" style="display: ${this.activeTab === "series" ? "block" : "none"};">
            <h4>Entities</h4>
            ${this._config.entities.map((ent, index) => html`
              <div class="entity">
                
                
              <ha-combo-box
                label="Entity"
                .value=${ent.sensor?.startsWith("sensor.") ? ent.sensor : `sensor.${ent.sensor || ""}`}
                data-field="sensor"
                data-index=${index}
                .items=${this._entities.map(entity => ({ value: entity, label: entity }))}
              
                @focusin=${() => { 
                    if (!this._openCombos) this._openCombos = {}; 
                    this._openCombos[index] = true; 
                    this.requestUpdate(); 
                }}
                @focusout=${() => { 
                    if (this._openCombos) { 
                        delete this._openCombos[index]; 
                    }
                    this.requestUpdate(); 
                }}
              
                @value-changed=${(ev) => {
                    this._entityValueChanged(ev);
                    ev.target.blur(); // 🔹 Forza la perdita del focus
                }}
                              >
              </ha-combo-box>
                
                <ha-textfield
                  label="Unit of measure"
                  .value=${ent.unita_misura || ""}
                  data-field="unita_misura"
                  data-index=${index}
                  @input=${this._entityValueChanged}
                ></ha-textfield>
                
                <!-- Switch per attivare/disattivare il div secondario -->
                <ha-formfield label="Show advanced options" style="margin-bottom:10px;">
                  <ha-switch
                    .checked=${ent.isEntityOptionsVisible || false}
                    data-index=${index}
                    @change=${() => this._toggleEntityOptionsVisibility(index)}
                  ></ha-switch>
                </ha-formfield>
                
                <div style="display:${ent.isEntityOptionsVisible ? `block` : `none`};">
                    <ha-textfield
                      label="Entity Name"
                      .value=${ent.name || ""}
                      data-field="name"
                      data-index=${index}
                      @input=${this._entityValueChanged}
                    ></ha-textfield>
                    
                    <ha-textfield
                      label="Color"
                      .value=${ent.color || ""}
                      data-field="color"
                      data-index=${index}
                      @input=${this._entityValueChanged}
                    ></ha-textfield>
      
                      <label class="mdc-text-field mdc-text-field--outlined mdc-text-field--textarea">
                        <span class="mdc-notched-outline">
                          <span class="mdc-notched-outline__leading"></span>
                          <span class="mdc-floating-label">Influx Query</span>
                          <span class="mdc-notched-outline__trailing"></span>
                        </span>
                        <span class="mdc-text-field__resizer">
                          <textarea
                            class="mdc-text-field__input"
                            spellcheck="false"
                            rows="8"
                            cols="40"
                            style="width:100% !important;"
                            aria-label="Influx Query"
                            data-field="query"
                            data-index=${index}
                            @input=${this._entityValueChanged}
                          >${ent.query ||"SELECT mean(\"value\")  FROM \"°C\" \r\n WHERE (\"entity_id\" = 'temperature') AND time > now() - 90d \r\n GROUP BY time(1d) fill(null)"}
                          </textarea>
                        </span>
                      </label>
                      
                      
                      <label class="mdc-text-field mdc-text-field--outlined mdc-text-field--textarea" >
                        <span class="mdc-notched-outline">
                          <span class="mdc-notched-outline__leading"></span>
                          <span class="mdc-floating-label">Highcharts series options <small><a href="https://api.highcharts.com/highcharts/series" TARGET="BLANK">API here</a></small></span>
                          <span class="mdc-notched-outline__trailing"></span>
                        </span>
                        <span class="mdc-text-field__resizer">
                          <textarea
                            class="mdc-text-field__input"
                            spellcheck="false"
                            rows="8"
                            cols="40"
                            style="width:100% !important;"
                            aria-label="Options"
                            data-field="options"
                            data-index=${index}
                            @input=${this._entityValueChanged}
                          >${ent.options || "{}"}</textarea>
                        </span>
                      </label>
                  </div>
                <mwc-icon-button
                  class="delete-button"
                  @click=${() => this._removeEntity(index)}
                >
                  <ha-icon icon="hass:delete"></ha-icon>
                </mwc-icon-button>
              </div>
            `)}
            <mwc-button raised label="Add entity" @click=${this._addEntity}>
              <ha-icon icon="hass:plus"></ha-icon>
            </mwc-button>
            
  
            
          </div>
        </div>
      `;
  }

 
    _toggleOptionsVisibility() { this.isOptionsVisible = !this.isOptionsVisible;  }


    static get styles() {
      return css`
        .card-config {
          display: flex;
          flex-direction: column;
          gap: 16px;
        }
        .section {
          border: 1px solid var(--primary-color);
          padding: 16px;
          border-radius: 8px;
          background: var(--card-background-color);
        }
        .entities {
          margin-top: 8px;
        }
        .entity {
          display: flex;
          flex-direction: column;
          gap: 8px;
          margin-bottom: 16px;
          border: 1px dashed var(--secondary-text-color);
          padding: 8px;
          border-radius: 4px;
        }
        .delete-button {
          align-self: flex-end;
        }
        mwc-button {
          margin-top: 8px;
        }
        ha-textfield,
        textarea {
          display: block;
          margin-bottom: 8px;
        }
        ha-formfield {
          display: block;
          margin-top: 8px;
        }
        .entity-picker {
          min-height: 40px;
          display: block;
        }
        `;  // ✅ Corretta chiusura del template literal con backtick
    }
}

/**
 * Finally, register the editor, used by getConfigElement().
 */
customElements.define("timeseries-highinflux-card-editor", TimeseriesHighInfluxCardEditor);

/**
 * And register the main card class with Lit.
 */
customElements.define("timeseries-highinflux-card", TimeseriesHighInfluxCard);
