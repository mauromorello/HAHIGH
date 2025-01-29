const version = "0.1.7"; //Setting up... series sensors colors

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
    //console.log("getProprieties");
    return {
      _config: { type: Object },
      _chart: { type: Object },
      _pollingTimer: { type: Number }
    };
  }

  static getConfigElement() {
      //console.log("Create Element");
      const editor = document.createElement("realtime-highha-card-editor");
      editor.comboBoxEntities = this.comboBoxEntities || []; // Passiamo la lista di sensori all'editor
      this._editor = editor; // Salviamo un riferimento per aggiornamenti futuri
      return editor;
  }

  static getStubConfig() {
    console.log("getStubConfig");
    return {
      title: "Realtime Chart",
      entity: [
        {
          entity: "sensor.pzem_power",
          name: "POWER",
          color: "red",
          options: "{}"
        }
      ],
      chart: {
        type: "line",
        data_kept: 12,
        update_interval: 5
      },
      config: {}
    };
  }

  setConfig(config) {
      //console.log("Card: setConfig chiamato con:", config);
      
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
  
      if (!entitiesDefined){ 
          throw new Error("You must define at least one entity in the configuration.");
      }
  

  }

  disconnectedCallback() {
      super.disconnectedCallback();
      //console.log("❌ Card rimossa: sto fermando il polling!");
      
      if (this._pollingTimer) {
          clearInterval(this._pollingTimer);
          this._pollingTimer = null;
      }
  }  

  set hass(newHass) {

      if (!newHass) return;
      
      // Se la lista comboBoxEntities è vuota, popolala con i sensori disponibili in hass.states
      if (!this.comboBoxEntities || this.comboBoxEntities.length === 0) {
          if (newHass.states) {
              this.comboBoxEntities = Object.keys(newHass.states).filter(e => e.startsWith("sensor."));
              this.requestUpdate(); 
              // console.log("Popolata comboBoxEntities con sensori:", this.comboBoxEntities);
          }
      }
  
      if (!this._config || !this._config.entity?.length) {
        //console.log("NO CONFIG HASS");
        return;
      }
  
      if (!this._hass) {
        this._hass = newHass;
        this._updateData("HASS");
        //console.log("UPDATE DATA HASS");
        return;
      }
  
      const relevantEntities = this._config.entity;
      let changed = false;
  
      for (const ent of relevantEntities) {
        //console.log("RELEVANT ENTITY HASS", ent);
        const oldState = this._hass.states[ent];
        const newState = newHass.states[ent];
        if (!oldState || !newState) continue;
  
      }
  
      this._hass = newHass;
      
      // Passiamo la lista all'editor se è attivo
      if (this._editor) {
          this._editor.comboBoxEntities = this.comboBoxEntities;
          this._editor.requestUpdate();
      }
  }

  async _loadHighcharts() {
      return new Promise(async (resolve, reject) => {
          // Se Highcharts è già caricato, assicuriamoci che i moduli aggiuntivi siano presenti
          if (window.Highcharts) {
              //console.log("🔄 Highcharts già caricato, verifico i moduli...");
  
              // Controllo se mancano i moduli aggiuntivi
              const missingModules = [];
              if (!window.Highcharts.seriesTypes.solidgauge) {
                  missingModules.push("https://code.highcharts.com/modules/solid-gauge.js");
              }
              if (!window.Highcharts.seriesTypes.pie) {
                  missingModules.push("https://code.highcharts.com/highcharts-more.js");
              }
  
              // Carica solo i moduli mancanti
              if (missingModules.length > 0) {
                  //console.log("📥 Caricamento moduli mancanti:", missingModules);
                  for (const src of missingModules) {
                      await this._loadScript(src);
                  }
              } else {
                  console.log("✅ Tutti i moduli necessari sono già presenti.");
              }
  
              resolve();
              return;
          }
  
          // Se un altro script è già in fase di caricamento, aspettiamo
          if (window._highchartsLoading) {
              //console.log("⏳ Attesa caricamento Highcharts già in corso...");
              window._highchartsLoading.then(resolve).catch(reject);
              return;
          }
  
          // Impostiamo un flag per evitare caricamenti multipli simultanei
          window._highchartsLoading = new Promise(async (loadResolve, loadReject) => {
              const scripts = [
                  "https://code.highcharts.com/highcharts.js",
                  "https://code.highcharts.com/highcharts-more.js",
                  "https://code.highcharts.com/modules/solid-gauge.js"
              ];
  
              console.log("📥 Inizio caricamento Highcharts e moduli...");
  
              try {
                  for (const src of scripts) {
                      await this._loadScript(src);
                  }
                  //console.log("🎯 Tutti gli script di Highcharts caricati con successo!");
                  loadResolve();
              } catch (error) {
                  //console.error("❌ Errore nel caricamento degli script Highcharts:", error);
                  loadReject(error);
              }
          });
  
          // Aspettiamo il caricamento prima di risolvere la funzione principale
          window._highchartsLoading.then(resolve).catch(reject);
      });
  }
  
  _loadScript(src) {
      return new Promise((resolve, reject) => {
          if (document.querySelector(`script[src="${src}"]`)) {
              //console.log(`🔄 Il modulo ${src} è già stato caricato.`);
              resolve();
              return;
          }
  
          const script = document.createElement("script");
          script.src = src;
          script.async = true;
          script.onload = () => {
              console.log(`✅ Caricato: ${src}`);
              resolve();
          };
          script.onerror = () => {
              //console.error(`❌ Errore nel caricamento di: ${src}`);
              reject();
          };
          document.head.appendChild(script);
      });
  }

  firstUpdated() {
    this._initChart();
    console.log("First Updated");
  }

  async _initChart() {
    console.log("INIT CHARTS");
    await this._loadHighcharts();
    console.log("INIT CHARTS CAN RENDER");
    // Costruiamo il grafico la prima volta con una serie vuota
    //console.log(window.Highcharts)
    this._renderChart([]);
    this._startPolling();

  }

  _startPolling() {
      //console.log("Start Polling");
      const interval = this._config.chart?.update_interval || 1;
  
      if (this._pollingTimer) {
          //console.log("⏸️ Polling già attivo, non avvio un nuovo timer.");
          return; // Evita di creare un nuovo polling
      }
  
      console.log(`Polling avviato con intervallo di ${interval} secondi`);
      this._updateData("FIRST");
      
      this._pollingTimer = setInterval(() => {
          //console.log("Polling: aggiornamento dati...");
          this._updateData("polling");
      }, interval * 1000);
  }

  _updateData(source = "unknown") {
      //console.log(`🔄 _updateData chiamato da ${source}`);
      if (!this._hass || !this._chart || !this._config.entity) return;
  
      const chartType = this._getChartType();
      //console.log(`📢 Chart Type rilevato: ${chartType}`);
  
      this._config.entity.forEach((ent, index) => {
          const entityId = ent.entity;
          if (!entityId || !this._hass.states[entityId]) return;
  
          const stateObj = this._hass.states[entityId];
          const val = parseFloat(stateObj.state);
          if (isNaN(val)) return;
  
          //console.log(`📊 Nuovo dato per ${entityId}: ${val} (Origine: ${source})`);
  
          if (chartType === "solidgauge") {
            //console.log(`⚡ [SOLIDGAUGE] Tentativo di aggiornare il valore per ${entityId}: ${val}`);
        
            if (this._chart.series[index]) {
                //console.log(`✅ Serie trovata per ${entityId}:`, this._chart.series[index]);
        
                if (this._chart.series[index].points[0]) {
                    //console.log(`⏫ Aggiornamento valore Solid Gauge per ${entityId}: ${val}`);
                    this._chart.series[index].points[0].update(val, true, false);
                } else {
                    this._chart.series[index].setData([val], true);
                }
            } else {
                console.warn(`❌ La serie per ${entityId} non esiste ancora! Creazione della serie...`);

                const newSeries = {
                    name: ent.name || entityId,
                    type: "solidgauge",
                    data: [val],
                    yAxis: {
                        min: 0,
                        max: this._config.chart?.max_value || 100
                    }
                };
        
                this._chart.addSeries(newSeries, true);
            }
          } else {
              const now = new Date();
              const localTime = now.getTime() - now.getTimezoneOffset() * 60000;
              const keep = this._config.chart?.data_kept || 120;
  
              if (!this._chart.series[index]) {
                  console.warn(`❌ La serie per ${entityId} non esiste ancora! Creazione della serie...`);
                  this._chart.addSeries({ name: ent.name || entityId, data: [] }, true);
              }
              this._chart.series[index].addPoint(
                  [localTime, val],
                  true,
                  this._chart.series[index].data.length >= keep
              );
          }
      });
  }

  _getBaseChartOptions(chartType, seriesData) {
      return {
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
          xAxis: chartType === "solidgauge" ? undefined : { type: "datetime" },
          yAxis: {
              title: { text: null },
              max: this._config.chart?.max_value ?? null // 🔥 Usa il max_value configurato
          },
          series: seriesData
      };
  }

  _getTypeSpecificOptions(chartType) {
      const options = {};
  
      switch (chartType) {
          case "solidgauge":
              options.chart = { type: "solidgauge", margin: [10, 0, 5, 0], spacing: [0, 0, 0, 0] };
              options.pane ={
                              center: ['50%', '50%'],
                              size: '100%',
                              startAngle: -90,
                              endAngle: 90,
                              background: {
                                  backgroundColor: {
                                      linearGradient: {
                                          x1: 1,
                                          x2: 0,
                                          y1: 1,
                                          y2: 0
                                      },
                                      stops: [
                                          [0, '#DFDFDF'],
                                          [1, '#FDFDFD']
                                      ]
                                  },
                                  borderRadius: 5,
                                  innerRadius: '60%',
                                  outerRadius: '100%',
                                  shape: 'arc'
                              }
                          };
                          
              options.yAxis ={
                              min: 0, 
                              max: this._config.chart?.max_value !== undefined ? this._config.chart.max_value : null,
                              stops: [
                                  [0.1, '#55BF3B'], // green
                                  [0.5, '#DDDF0D'], // yellow
                                  [0.9, '#DF5353'] // red
                              ],
                              lineWidth: 0,
                              tickWidth: 0,
                              minorTickInterval: null,
                              tickAmount: 2,
                              title: {
                                  y: 0
                              },
                              labels: {
                                  y: 16
                              }
                          };
              options.legend = { enabled: false };
              options.plotOptions = {
                                    solidgauge: {
                                        borderRadius: 3,
                                        dataLabels: {
                                            y: 0,
                                            borderWidth: 0,
                                            useHTML: true
                                            }
                                        }
                                    };
              break;
  
          case "bullet":
              options.chart = { type: "bullet" };
              options.plotOptions = { series: { pointPadding: 0.25, groupPadding: 0 } };
              break;
  
          case "pie":
              options.chart = { type: "pie" };
              delete options.xAxis;
              delete options.yAxis;
              break;
  
          default:
              break;
      }
  
      return options;
  }

  _getChartType() {
      if (!this._config || !this._config.chart) {
          return "line"; // Tipo di default se la configurazione è assente
      }
  
      const chartType = this._config.chart.type || "line";
  
      const chartTypeMap = {
          "areastacked": "area",
          "areastackedpercent": "area",
          "barstacked": "bar",
          "columnstacked": "column",
          "pie": "pie", // Assicuriamoci che il tipo "pie" sia incluso
          "solidgauge": "solidgauge"  // 🔥 Deve essere esplicitamente incluso!
      };
  
      return chartTypeMap[chartType] || chartType;
  }
    
  _getGlobalChartOptions() {
      if (!this._config.chart_options) return {};
  
      try {
          const func = new Function("Highcharts", "return " + this._config.chart_options);
          return func(window.Highcharts);
      } catch (e) {
          console.error("❌ Chart options parsing error:", e);
          return {};
      }
  }

    // RENDER ++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
    // RENDER ++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
    // RENDER ++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
    
  _renderChart() {
      console.log("⚙️ _renderChart called with config:", this._config);
  
      if (!window.Highcharts) {
          this._loadHighcharts().then(() => this._renderChart());
          return;
      }
  
      const container = this.shadowRoot.getElementById("chartContainer");
      if (!container) return;
  
      // Creazione delle serie dati
      const seriesData = this._config.entity.map(ent => {
          let extraOptions = {};
          if (ent.options && typeof ent.options === "string") {
              try {
                  const func = new Function("Highcharts", "return " + ent.options);
                  extraOptions = func(window.Highcharts);
              } catch (e) {
                  console.error(`❌ Errore nelle opzioni della serie ${ent.entity}:`, e);
                  extraOptions = {};
              }
          }
      
          // 🔥 Se il grafico è solidgauge, impostiamo una serie specifica
          if (this._config.chart?.type === "solidgauge") {
              return Highcharts.merge({
                  name: ent.name || ent.entity,
                  color: ent.color || undefined,
                  data: [0],  // Inizializza con un valore di default
                  dataLabels: {
                      y: -70,
                      format: `
                          <div style="text-align:center">
                              <span class="adattivo">{y}</span>&nbsp;
                              <span class="adattivo_mis">C</span>
                          </div>
                      `
                  }
              }, extraOptions);
          }
      
          // Per tutti gli altri tipi di grafico, usiamo la configurazione standard
          return Highcharts.merge({
              name: ent.name || ent.entity,
              color: ent.color || undefined,
              data: []  
          }, extraOptions);
      });
  
      const chartType = this._getChartType();
      const baseOptions = this._getBaseChartOptions(chartType, seriesData);
      const typeSpecificOptions = this._getTypeSpecificOptions(chartType);
      const globalChartOptions = this._getGlobalChartOptions();
  
      // Fusione finale delle opzioni
      const finalOptions = Highcharts.merge({}, baseOptions, typeSpecificOptions, this._config.stackedOptions || {}, globalChartOptions || {});
  
      //console.log("🎨 Opzioni finali del grafico:", JSON.stringify(finalOptions, null, 2));
  
      // Creiamo il grafico
      this._chart = Highcharts.chart(container, finalOptions);
      //console.log("✅ Finish Render");
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
  
          <div id="chartContainer" style="width: 100%; height: ${this._config.chart_height || "100%"}; border-radius:12px;">
          </div>
        </ha-card>
      `;
  }
  
  static get styles() {
    console.log("GET STYLES");
    return css`
      .adattivo {
          font-size: clamp(16px, 8vw, 48px);
      }
      .adattivo_mis {
          font-size: clamp(12px, 8vw, 18px);
          opacity:0.4;
      }
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
      //console.log("Editor: setConfig chiamato con:", config);
      const normalizedEntities = Array.isArray(config.entity) ? config.entity : [config.entity];
  
      this._config = { ...config, entity: normalizedEntities };
  
      // Usa la lista di entità passata dalla card principale
      if (!this.comboBoxEntities || this.comboBoxEntities.length === 0) {
          this.comboBoxEntities = this.hass ? Object.keys(this.hass.states).filter((e) => e.startsWith("sensor.")) : [];
      }
  
      this.requestUpdate();
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
      let newValue = e.target.value;
  
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
      } else if (field === "max_value") {
          // Assicuriamoci che sia un numero valido o null
          const parsedValue = parseFloat(newValue);
          newConfig.chart = { 
              ...newConfig.chart, 
              max_value: isNaN(parsedValue) ? null : parsedValue 
          };
      }
  
      // Aggiorniamo la configurazione e notifichiamo il cambiamento
      this._config = newConfig;
      this._dispatchConfig();
  }


  // Aggiorna la lista di entità
  // Gestisce i cambiamenti nei parametri per ogni entità
  // Aggiorna la lista di entità (es. nome, colore, ecc.)
    _entityChanged(e) {
      if (!this._config) return;
  
      const target = e.target;
      const index = parseInt(target.getAttribute("data-index"), 10);
      const field = target.getAttribute("data-field");
      if (isNaN(index) || !field) return;
  
      // ha-combo-box di solito invia il nuovo valore in e.detail.value
      // facciamo un fallback su target.value se necessario
      const newValue = e.detail?.value ?? target.value;
  
      // Creiamo una copia dell'array di entità
      const newEntities = [...this._config.entity];
      const updatedEntity = { ...newEntities[index] };
  
      // Aggiorna solo il campo modificato
      updatedEntity[field] = newValue;
      newEntities[index] = updatedEntity;
  
      // Se la config è cambiata, aggiorniamo e notifichiamo
      if (JSON.stringify(newEntities) !== JSON.stringify(this._config.entity)) {
        this._config = { ...this._config, entity: newEntities };
        this._dispatchConfig();
      }
    }

  // Aggiunge un’entità
  _addEntity() {
    // Invece di aggiungere una semplice stringa,
    // aggiungiamo un oggetto con la proprietà "entity"
    this._config.entity = [
      ...this._config.entity,
      {
        entity: "sensor.new_sensor",
        name: "",
        color: "",
        options: "{}"
      }
    ];
    this._dispatchConfig();
  }

  // Rimuove un’entità
  _removeEntity(index) {
    const newArr = [...this._config.entity];
    newArr.splice(index, 1);
    this._config.entity = newArr;
    this._dispatchConfig();
  }
  
  _toggleEntityOptionsVisibility(index) {
      if (!this._config || !this._config.entity || !this._config.entity[index]) return;
  
      // Creiamo una nuova copia delle entità con lo stato aggiornato
      const newEntities = [...this._config.entity];
      newEntities[index] = {
          ...newEntities[index],
          isEntityOptionsVisible: !newEntities[index].isEntityOptionsVisible // Inverti lo stato attuale
      };
  
      // Aggiorniamo la configurazione
      this._config = { ...this._config, entity: newEntities };
      this._dispatchConfig(); // 🔹 Corretto il nome della funzione di aggiornamento
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

  render() {
    if (!this._config) return html``;

    // Assicuriamoci di avere un array, così evitiamo errori di "undefined.map()"
  const availableEntities = this.comboBoxEntities || [];
  //console.log("Available entities in editor:", availableEntities);

    return html`
      <div class="card-config">
        <div class="tabs">
          <mwc-button @click=${() => (this.activeTab = "entities")} ?raised=${this.activeTab === "entities"}>Entities</mwc-button>
          <mwc-button @click=${() => (this.activeTab = "chart")} ?raised=${this.activeTab === "chart"}>Chart</mwc-button>
          <mwc-button @click=${() => (this.activeTab = "advanced")} ?raised=${this.activeTab === "advanced"}>Advanced</mwc-button>
        </div>

        <!-- ENTITIES TAB -->
        <div class="entities section" style="display: ${this.activeTab === "entities" ? "block" : "none"};">
            <h4>Entities</h4>
            ${this._config.entity.map((ent, index) => html`
                <div class="entity">
                    
                    <ha-combo-box
                        label="Entity"
                        .value=${ent.entity?.startsWith("sensor.") ? ent.entity : `sensor.${ent.entity || ""}`}
                        data-field="entity"
                        data-index=${index}
                        .items=${availableEntities.map(entity => ({ value: entity, label: entity }))}
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
                            this._entityChanged(ev);
                            ev.target.blur(); // Forza la perdita del focus
                        }}
                    ></ha-combo-box>

                    <ha-textfield
                        label="Entity Name"
                        .value=${ent.name || ""}
                        data-field="name"
                        data-index=${index}
                        @input=${(e) => this._entityChanged(e)}
                    ></ha-textfield>
                    
                    <ha-textfield
                        label="Color"
                        .value=${ent.color || ""}
                        data-field="color"
                        data-index=${index}
                        @input=${(e) => this._entityChanged(e)}
                    ></ha-textfield>

                    <ha-formfield label="Show advanced options" style="margin-bottom:10px;">
                        <ha-switch
                            .checked=${ent.isEntityOptionsVisible || false}
                            data-index=${index}
                            @change=${() => this._toggleEntityOptionsVisibility(index)}
                        ></ha-switch>
                    </ha-formfield>

                    <div style="display:${ent.isEntityOptionsVisible ? `block` : `none`};">
                        <label class="mdc-text-field mdc-text-field--outlined mdc-text-field--textarea">
                            <span class="mdc-notched-outline">
                                <span class="mdc-notched-outline__leading"></span>
                                <span class="mdc-floating-label">Highcharts series options 
                                    <small><a href="https://api.highcharts.com/highcharts/series" target="_blank">API here</a></small>
                                </span>
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
                                    @input=${this._entityChanged}
                                >${ent.options || "{}"}</textarea>
                            </span>
                        </label>
                    </div>

                    <mwc-icon-button class="delete-button" @click=${() => this._removeEntity(index)}>
                        <ha-icon icon="hass:delete"></ha-icon>
                    </mwc-icon-button>
                </div>
            `)}

            <mwc-button raised label="Add entity" @click=${this._addEntity}>
                <ha-icon icon="hass:plus"></ha-icon>
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
            <mwc-list-item value="standardgauge">Standard Gauge</mwc-list-item>
            <mwc-list-item value="pie">Pie</mwc-list-item>
          </ha-select>
          
          <ha-textfield
            label="Max value"
            data-field="max_value"
            .value=${this._config.chart?.max_value ?? ""}
            @input=${this._valueChanged}
          ></ha-textfield>

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
                    // se non è JSON valido, ignoriamo
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
        
        ha-select,
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

customElements.define("realtime-highha-card-editor", RealtimeHighHaCardEditor);

customElements.define("realtime-highha-card", RealtimeHighHaCard);
