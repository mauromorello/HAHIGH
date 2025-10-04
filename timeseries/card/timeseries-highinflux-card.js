
const version = "0.9.4"; //Logica di caricamento

/********************************************************
 * Import LitElement libraries (version 2.4.0)
 * We use the CDN for simplicity, but you could also
 * use the version bundled with Home Assistant.
 *******************************************************/
import { html, css, LitElement } from "https://unpkg.com/lit-element@2.4.0/lit-element.js?module";


window.loadHighchartsUnified = function() {
  if (window._highchartsUnifiedLoading) {
    return window._highchartsUnifiedLoading;
  }
  window._highchartsUnifiedLoading = new Promise((resolve, reject) => {
    const scripts = [
      "https://code.highcharts.com/stock/highstock.js",
      "https://code.highcharts.com/highcharts-more.js",
      "https://code.highcharts.com/modules/solid-gauge.js"
    ];
    function loadNext(index) {
      if (index >= scripts.length) {
        console.log("Tutti i moduli Highcharts sono stati caricati in sequenza.");
        resolve();
        return;
      }
      const src = scripts[index];
      if (document.querySelector(`script[src="${src}"]`)) {
        // Se lo script è già presente, passa al successivo
        loadNext(index + 1);
        return;
      }
      const script = document.createElement("script");
      // Impostando async a false si forza l'esecuzione in ordine
      script.async = false;
      script.src = src;
      script.onload = () => {
        console.log(`Caricato: ${src}`);
        loadNext(index + 1);
      };
      script.onerror = () => {
        reject(new Error(`Errore nel caricamento di ${src}`));
      };
      document.head.appendChild(script);
    }
    loadNext(0);
  });
  return window._highchartsUnifiedLoading;
};


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
      influx_password: "password",
      updateInterval: 60
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

    if (!entitiesDefined) {
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
            style="width: 100%; height: ${this._config.chart_height || "100%"}; border-radius:12px;"
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
  async firstUpdated() {
    console.log("FIRST UPDATED");
    try {
      await window.loadHighchartsUnified();
      console.log("CHIAMO INITCHART");
      this.setupComplete = true;
      this._startAutoUpdate();
    } catch (error) {
      console.error("Errore nel caricamento di Highcharts:", error);
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
          this._queryError = "Query not valid;"
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
      
      this._snippets = [
            {
              title: "Chart title",
              use: "chart:",
              code: `
title: {
  useHTML: true,
  text: 'HAHIGH!<br><small style="opacity: 0.2;">My small graphic addiction</small>', 
  floating: true, 
  x: 20,   align: 'left', 
  y: 30, verticalAlign: 'bottom', 
  style: { fontSize: '24px', color: '#AAAAAA', fontWeight: 'bold' },
  
},`
            },
            {
              
              title: "Dark",
              use: "chart themes:",
              code: `
chart: {
        backgroundColor: '#2a2a2a',
        plotBorderColor: '#606063',
        plotBackgroundColor: '#2a2a2a',
    },
    title: {
        useHTML: true,
        text: 'Dark Theme',
        floating: true,
        x: 30, align:"left",
        y: 20, verticalAlign:"top",
        style: {color: '#CCC', fontSize: "24px", fontWeight: 'bold', },
        
    },
    xAxis: {
        gridLineColor: '#707073',
        gridLineDashStyle: 'shortdash',
        gridLineWidth: 1,
        labels: {
            style: {color: '#E0E0E0', }
        },
        title: {
            style: {color: '#FFFFFF', }
        }
    },
    yAxis: {
        gridLineColor: '#707073',
        alternateGridColor: '#222',
        gridLineDashStyle: 'dot',
        labels: {
            style: { color: '#E0E0E0', }
        },
        title: {
            style: {color: '#FFFFFF',  }
        }
    },
`
            },
            {
              
              title: "Transparent Background",
              use: "chart themes:",
              code: `
chart: {
  backgroundColor: 'transparent', 
},
`
            },
            {
              
              title: "Y Axis Options (chart)",
              use: "chart:",
              code: `
yAxis: {
  title: { 
    text: 'Axis title',
  }, 
  gridLineColor: "#CCC", 
  gridLineDashStyle: 'longdash', 

},
`
            },
            {
              title: "Background",
              use: "chart:",
              code: `
chart:{    
  backgroundColor: {
    linearGradient: [0, 0, 0, 300],
      stops: [
      [0, 'rgba(255, 255, 255,1)'],
      [1, 'rgba(230, 230, 255,1)']
      ],
  },
},
`
            },
            {
              title: "Opacity",
              use: "chart:",
              code: `
plotOptions: {
  series: { 
    fillOpacity: 0.1, 
  }, 
  
},
`
            },
            {
              title: "VGradient colors",
              use: "series:",
              code: `
fillColor: {
  linearGradient: {x1: 0, y1: 0, x2: 0, y2: 1 }, 
    stops: [
      [0, 'red'],
      [0.5, 'orange'], 
      [1, 'green'],
      
    ], 
  
},
`
            },
            {
              title: "Connect Nulls",
              use: "series:",
              code: `connectNulls: true,`
            },
            {
              title: "VGradient rgba",
              use: "series:",
              code: `
fillColor:  {
  linearGradient: { x1: 0, y1: 0, x2: 0, y2: 1 },
  stops: [
    [0, 'rgba(255,0,0,1)'],
    [0.5, 'rgba(200,150,0,0.5)'],
    [1, 'rgba(0,250,0,0)']
         ],
},
`
         
            },
            {
              
              title: "ABS Line VGradient rgba (Entity)",
              use: "series:",
              code: `
color:  {
  linearGradient: [0,0,0,300],
  stops: [
      [0, 'rgba(255,0,0,1)'],
      [0.5, 'rgba(200,150,0,0.5)'],
      [1, 'rgba(0,250,0,0)']
  ]
},
`
            
            },
            {
              
              title: "Line Shadow",
              use: "series:",
              code: `
shadow: {
  color: 'rgba(0, 0, 0, 0.5)',
  offsetX: 2,
  offsetY: 2,
  opacity: 0.5,
  width: 5,
},
`
            }
            
          ];
    
    
    this._lastFocusedTextarea = null;  // Per salvare l'elemento della textarea
    this._cursorPosition = null;       // Per salvare la posizione del cursore 
    
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


    //----------------------------------------------------------------------------------->
    // CLIPBOARD COPY
    //----------------------------------------------------------------------------------->
    
    _openDialog(event) {
      event.preventDefault();
      this._showDialog = true;
      this.requestUpdate();
    }
    
    // Modifica di _closeDialog per inserire il testo nell'ultima textarea
    _closeDialog() {
      this._showDialog = false;
      this.requestUpdate();
      
      if (this._lastFocusedTextarea && this._cursorPosition !== null && this._snippetTextToInsert) {
        // Inserisce il testo salvato nella posizione del cursore
        const currentValue = this._lastFocusedTextarea.value;
        const newValue =
          currentValue.slice(0, this._cursorPosition) +
          this._snippetTextToInsert +
          currentValue.slice(this._cursorPosition);
        this._lastFocusedTextarea.value = newValue;
        
        // Innesca l'evento 'input' per aggiornare la configurazione, se necessario
        this._lastFocusedTextarea.dispatchEvent(new Event('input'));
        
        // Aggiorna la posizione del cursore dopo l'inserimento (opzionale)
        const newCursorPosition = this._cursorPosition + this._snippetTextToInsert.length;
        this._cursorPosition = newCursorPosition;
        this._lastFocusedTextarea.setSelectionRange(newCursorPosition, newCursorPosition);
        
        // Reset della variabile per evitare inserimenti successivi indesiderati
        this._snippetTextToInsert = null;
      }
    }    

    // Modifica di _copyToClipboard per salvare il testo da inserire
    _copyToClipboard(text) {
      if (!text) {
        console.error("Errore: testo da copiare non trovato.");
        return;
      }
      
      // Salva il testo da inserire nella textarea
      this._snippetTextToInsert = text;
    
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(() => {
          console.log("Contenuto copiato negli appunti!");
          this._closeDialog();
        }).catch(err => {
          console.error("Errore nella copia con Clipboard API:", err);
        });
      } else {
        const textarea = document.createElement("textarea");
        textarea.value = text;
        document.body.appendChild(textarea);
        textarea.select();
        try {
          document.execCommand("copy");
          console.log("Contenuto copiato (fallback).");
          this._closeDialog();
        } catch (err) {
          console.error("Errore nella copia con execCommand:", err);
        }
        document.body.removeChild(textarea);
      }
    }


    firstUpdated() {
      // Registra gli eventi per aggiornare la posizione del cursore nelle textarea
      this.addEventListener("keyup", this._handleCursorUpdate);
      this.addEventListener("click", this._handleCursorUpdate);
      this.addEventListener("mouseup", this._handleCursorUpdate);
      this.addEventListener("focusin", this._handleFocusIn);
      console.log("FIRSTUPDATED:");
    }

    _handleCursorUpdate(e) {
      // Recupera il percorso completo dell'evento
      const path = e.composedPath ? e.composedPath() : [e.target];
      const target = path[0];
      
      if (target && target.tagName && target.tagName.toLowerCase() === "textarea") {
        this._lastFocusedTextarea = target;
        this._cursorPosition = target.selectionStart;
      }
    }

    _handleFocusIn(e) {
      if (
        e.target &&
        e.target.tagName.toLowerCase() === "textarea" &&
        this._lastFocusedTextarea === e.target &&
        this._cursorPosition !== null
      ) {
        // Il timeout assicura che il focus sia completo prima di impostare la posizione
        setTimeout(() => {
          e.target.setSelectionRange(this._cursorPosition, this._cursorPosition);
        }, 0);
      }
    }
    
    _saveCursorPosition(e) {
      const activeElement = this.shadowRoot.activeElement;
      if (activeElement && activeElement.tagName.toLowerCase() === "textarea") {
        this._lastFocusedTextarea = activeElement;
        this._cursorPosition = activeElement.selectionStart;
        console.log("Position: ", this._cursorPosition );
      }
    }

    //----------------------------------------------------------------------------------->
    
    
    // THE BIG RENDER *******************************************************************************************
    render() {
      if (!this._config) return html``;

      return html`
        <div class="card-config">
        
        ${this._showDialog ? html`
          <ha-dialog open @closed=${this._closeDialog}>
            <h2 slot="heading">Helper Instructions</h2>
            <div>
              <p>Config snippets:</p>
        
              ${Object.entries(this._snippets.reduce((acc, snippet) => {
                if (!acc[snippet.use]) {
                  acc[snippet.use] = [];
                }
                acc[snippet.use].push(snippet);
                return acc;
              }, {})).map(([use, snippets]) => html`
                <h3 style="margin-top: 10px; font-size: 16px; color: var(--primary-color);">${use}</h3>
                ${snippets.map((snippet) => html`
                  <div style="margin-bottom: 5px; display: flex; align-items: center;">
                    <!-- Icona copia -->
                    <ha-icon
                      icon="mdi:content-copy"
                      title="Copia snippet"
                      @click=${() => this._copyToClipboard(snippet.code)}
                      style="cursor: pointer; margin-right: 5px; font-size: 18px; color: var(--primary-color);"
                    ></ha-icon>
        
                    <span style="font-size: 14px;">${snippet.title}</span>
                  </div>
                `)}
              `)}
            </div>
          </ha-dialog>
        ` : ""}

          <div class="tabs">
            <mwc-button @click=${() => this.activeTab = "series"} ?raised=${this.activeTab === "series"}>Series</mwc-button>
            <mwc-button @click=${() => this.activeTab = "chart"} ?raised=${this.activeTab === "chart"}>Chart</mwc-button>
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
          <div class="section" style="display: ${this.activeTab === "chart" ? "block" : "none"};">
                
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
                      &nbsp;
                      <a href="#" 
                        @click=${(e) => this._openDialog(e)} 
                        style="cursor: pointer; text-decoration: underline; color: blue;">
                        Helpers here
                      </a>
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
                          &nbsp;
                          <a href="#" 
                            @click=${(e) => this._openDialog(e)} 
                            style="cursor: pointer; text-decoration: underline; color: blue;">
                            Helpers here
                          </a>
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
        
        .tabs {
          display: flex;
          justify-content: space-around;
          gap: 8px;
          margin: 8px 0 12px 0;
          background: var(--card-background-color);
          padding: 6px;
          border-radius: 10px;
          box-shadow: 0 1px 3px rgba(0,0,0,0.15);
        }
        
        .tabs mwc-button {
          flex: 1;
          font-weight: 500;
          text-transform: none;
          border-radius: 8px;
          transition: all 0.2s ease-in-out;
          padding: 4px 4px 4px 12px;
          cursor: pointer;
        }
        
        .tabs mwc-button[raised] {
          background: var(--primary-color);
          color: var(--text-primary-color);
          box-shadow: 0 2px 4px rgba(0,0,0,0.2);
        }
        
        .tabs mwc-button:not([raised]):hover {
          background: rgba(var(--rgb-primary-color), 0.08);
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
