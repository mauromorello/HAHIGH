const version = "0.2.6"; //Aggiunto standardgauge

/********************************************************
 * Import LitElement libraries (version 2.4.0)
 * We use the CDN for simplicity, but you could also
 * use the version bundled with Home Assistant.
 *******************************************************/
import { html, css, LitElement } from "https://unpkg.com/lit-element@2.4.0/lit-element.js?module";



/**
 * Funzione unificata per caricare Highcharts e i moduli extra.
 * Viene memorizzata in una variabile globale per evitare caricamenti multipli.
 */
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
        //console.log("Tutti i moduli Highcharts sono stati caricati in sequenza.");
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
        //console.log(`Caricato: ${src}`);
        loadNext(index + 1);
      };
      script.onerror = () => {
        reject(new Error(`Errore nel caricamento di ${src}`));
      };
      document.head.appendChild(script);
    }
    loadNext(0);
  });
  console.log("HAHIGH realtime v:" + version);
  return window._highchartsUnifiedLoading;

};



/******************************************************
 * REGISTRAZIONE CARD NEL PICKER DI LOVELACE
 ******************************************************/
window.customCards = window.customCards || [];
window.customCards.push({
  type: "realtime-highha-card",
  name: "Realtime High HA Card",
  description: "Realtime HA data with Highcharts Graph",
  // Facoltativo, per avere l’anteprima:
  //preview: true
});

/******************************************************
 * CLASSE PRINCIPALE (già vista, semplificata)
 * - getConfigElement() e getStubConfig() per l’editor
 ******************************************************/
class RealtimeHighHaCard extends LitElement {

  constructor() {
      super();
      this._chartInitialized = false; // 🔥 Flag per evitare doppio redraw
  }

  static get properties() {
    return {
      _config: { type: Object },
      _chart: { type: Object },
      _pollingTimer: { type: Number }
    };
  }

  static getConfigElement() {
      const editor = document.createElement("realtime-highha-card-editor");
      editor.comboBoxEntities = this.comboBoxEntities || []; // Passiamo la lista di sensori all'editor
      this._editor = editor; // Salviamo un riferimento per aggiornamenti futuri
      return editor;
  }

  static getStubConfig() {
 
    return {
      title: "Realtime Chart",
      entity: [
        {
          entity: "sensor.new_sensor",
          name: "NAME",
          color: "",
          uMeasure: "",
          options: "{}"
        }
      ],
      chart: {
        type: "line",
        data_kept: 12,
        update_interval: 5,
        card_height: "100%"
      },
      config: {}
    };
  }

  setConfig(config) {

      
      // Ferma il polling attuale se esiste
      if (this._pollingTimer) {

          clearInterval(this._pollingTimer);
          this._pollingTimer = null;
      }
  
      // Manteniamo direttamente la configurazione passata, con gestione esplicita di card_height
      this._config = { 
          ...config, 
          chart: { 
              ...config.chart, 
              card_height: config.chart?.card_height || "100%" // 🔹 Imposta un default se mancante
          } 
      };
  
      // Resettiamo eventuali dati precedenti
      this._lastData = null;
      this.setupComplete = false;
  
      // Imposta l'intervallo di aggiornamento (di default 5s se non specificato)
      this.updateInterval = this._config.chart.update_interval || 1;
  
      // Controlliamo se ci sono entità definite
      const entitiesDefined = Array.isArray(this._config.entity) && this._config.entity.length > 0;
  
      if (!entitiesDefined) { 
          throw new Error("You must define at least one entity in the configuration.");
      }
      
  }

  connectedCallback() {
      super.connectedCallback();
      this._startPolling();
  }
  
  disconnectedCallback() {
      super.disconnectedCallback();
      this._stopPolling();
  }

  set hass(newHass) {

      if (!newHass) return;
      
      // Se la lista comboBoxEntities è vuota, popolala con i sensori disponibili in hass.states
      if (!this.comboBoxEntities || this.comboBoxEntities.length === 0) {
          if (newHass.states) {
              this.comboBoxEntities = Object.keys(newHass.states).filter(e => e.startsWith("sensor."));
              this.requestUpdate(); 

          }
      }
  
      if (!this._config || !this._config.entity?.length) {
        return;
      }
  
      if (!this._hass) {
        this._hass = newHass;
        this._updateData("HASS");

        return;
      }
  
      const relevantEntities = this._config.entity;
      let changed = false;
  
      for (const ent of relevantEntities) {
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

  async firstUpdated() {
    //console.log("FIRST UPDATED");
    try {
      await window.loadHighchartsUnified();
      //console.log("CHIAMO INITCHART");
      this._initChart();
    } catch (error) {
      console.error("Errore nel caricamento di Highcharts:", error);
    }
  }

  async _initChart() {
      //console.log("INIT CHART");
      //await this._loadHighcharts(true);
      this._renderChart([]);
      
      setTimeout(() => { // 🔥 Ritarda il primo update per evitare doppio disegno
          this._chartInitialized = true;
          this._updateData("INIT");
          this._startPolling();
      }, 300); // Aspetta 300ms per evitare race condition
  }

  _startPolling() {
      if (this._pollingTimer) {
          return;
      }
  
      const interval = this._config.chart?.update_interval || 1;
  
      this._pollingTimer = setInterval(() => {
          this._updateData("polling");
      }, interval * 1000);
  }
  
  _stopPolling() {
      if (this._pollingTimer) {
          clearInterval(this._pollingTimer);
          this._pollingTimer = null;
      }
  }


  _updateData(source = "unknown") {
      
      if (!this._hass || !this._chart || !this._config.entity) return;
  
      const chartType = this._getChartType();
      
      //if (chartType === "line" || chartType === "pie") {
      if (!this._chartInitialized) return; // 🔥 Evita aggiornamenti prematuri
      //}
      
      if (chartType === "multiplegauge") {
          this._config.entity.forEach((ent, index) => {
              const entityId = ent.entity;
              if (!entityId || !this._hass.states[entityId]) return;
      
              const stateObj = this._hass.states[entityId];
              const val = parseFloat(stateObj.state);
              if (isNaN(val)) return;
      
              if (this._chart.series[index]) {
                  // 🔥 Se la serie esiste, aggiorna solo il valore
                  if (this._chart.series[index].points[0]) {
                      this._chart.series[index].points[0].update(val, false);
                  } else {
                      this._chart.series[index].setData([val], false);
                  }
              } else {
                  // 🔥 Se la serie non esiste, la creiamo
                  const newSeries = {
                      name: ent.name || entityId,
                      data: [{ y: val, radius: `${112 - index * 25}%`, innerRadius: `${88 - index * 25}%` }],
                      color: ent.color || Highcharts.getOptions().colors[index % Highcharts.getOptions().colors.length]
                  };
                  this._chart.addSeries(newSeries, false);
              }
          });
      
          this._chart.redraw();
          return;
      }

      if (chartType === "pie") {
          let pieData = [];
      
          this._config.entity.forEach((ent, index) => {
              const entityId = ent.entity;
              if (!entityId || !this._hass.states[entityId]) return;
      
              const stateObj = this._hass.states[entityId];
              const val = parseFloat(stateObj.state);
              if (isNaN(val)) return;
      
              // Aggiungiamo i dati per ogni entità con nome, valore, colore e unità di misura
              pieData.push({
                  name: ent.name || entityId,
                  y: val,
                  color: ent.color || undefined, // Usa il colore se definito
                  uMeasure: ent.uMeasure || ""  // Usa l'unità di misura o stringa vuota
              });
          });
      
          if (this._chart.series[0]) {
              // 🔥 Evitiamo il setData se i dati sono identici
              const currentData = this._chart.series[0].data.map(point => point.y);
              const newData = pieData.map(point => point.y);
      
              if (JSON.stringify(currentData) !== JSON.stringify(newData)) {
                  this._chart.series[0].setData(pieData, true);
              }
          } else {
              // 🔥 Creiamo la serie pie solo se non esiste
              this._chart.addSeries({
                  name: "Pie Chart",
                  data: pieData,
                  type: "pie",
                  tooltip: {
                      pointFormatter: function () {
                          return `<b>${this.name}</b>: ${this.y} ${this.uMeasure}`;
                      }
                  }
              }, true);
          }
      
          return; // Uscita anticipata per evitare il resto del codice
      }


  
      this._config.entity.forEach((ent, index) => {
          const entityId = ent.entity;
          if (!entityId || !this._hass.states[entityId]) return;
  
          const stateObj = this._hass.states[entityId];
          const val = parseFloat(stateObj.state);
          if (isNaN(val)) return;
  

  
          if (chartType === "solidgauge" || chartType === "standardgauge") {

        
            if (this._chart.series[index]) {

        
                if (this._chart.series[index].points[0]) {

                    this._chart.series[index].points[0].update(val, true, false);
                } else {
                    this._chart.series[index].setData([val], true);
                }
            } else {
                  const newSeries = {
                      name: ent.name || entityId,
                      data: [{ y: val}],
                      color: ent.color || Highcharts.getOptions().colors[index % Highcharts.getOptions().colors.length]
                  };
                this._chart.addSeries(newSeries, true);
            }
          } else {
              const now = new Date();
              const localTime = now.getTime() - now.getTimezoneOffset() * 60000;
              const keep = this._config.chart?.data_kept || 120;
  
              if (!this._chart.series[index]) {

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
              zooming: { type: "xy" },
              height:  this._config.chart?.card_height ?? "100%"
          },
          tooltip: {
              valueDecimals: 1
          },
          legend: {
              enabled: this._config.chart?.legend === true
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
       const maxValue = this._config.chart?.max_value ?? 100;
  
      switch (chartType) {
          case "solidgauge":
            options.chart = {
              type: "solidgauge",
              margin: [10, 0, 5, 0],
              spacing: [0, 0, 0, 0],
              events: {
                load: function () {
                  const chartWidth = this.chartWidth;
                  

                  
                  // Nuovo calcolo della font-size con una scala più accentuata
                  let fontSize;
                  const maxSize = 42; // Font-size massimo
                  const minSize = 16; // Font-size minimo
                  const maxWidth = 486; // Larghezza in cui il font è massimo
                  const minWidth = 238; // Larghezza in cui il font è minimo
            
                  if (chartWidth >= maxWidth) {
                    fontSize = maxSize;
                  } else if (chartWidth <= minWidth) {
                    fontSize = minSize;
                  } else {
                    // Calcolo con scala più accentuata
                    fontSize = (chartWidth - minWidth) / (maxWidth - minWidth) * (maxSize - minSize) + minSize;
                  }
            
                  this.series[0].update({
                    dataLabels: {
                      style: {
                        fontSize: `${fontSize}px`
                      }
                    }
                  }, false);
                  this.redraw();
                }
              }
            };


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
              options.tooltip = { enabled: false };
              options.plotOptions = {
                                    solidgauge: {
                                        borderRadius: 3,
                                        dataLabels: {
                                            borderWidth: 0
                                            }
                                        }
                                    };
              break;
  
          case "multiplegauge":
              options.chart = {
                  type: "solidgauge"
              };
          
              options.pane = {
                  startAngle: 0,
                  endAngle: 360
              };
          
              options.yAxis = {
                  min: 0,
                  max: this._config.chart?.max_value !== undefined ? this._config.chart.max_value : null,
                  stops: [
                      [0.1, '#55BF3B'], // green
                      [0.5, '#DDDF0D'], // yellow
                      [0.9, '#DF5353'] // red
                  ],
                  lineWidth: 1,
                  tickWidth: 2,
                  minorTickInterval: null,
                  tickAmount: 4,                  
                  lineWidth: 1,
                  //tickPositions: []
              };
          
              options.plotOptions = {
                  solidgauge: {
                      dataLabels: { enabled: true},
                      linecap: "round",
                      stickyTracking: false,
                      rounded: false
                  }
              };
          
              options.series = [

              ];
          
              break;
              
          case "standardgauge":
              options.chart = {
                    type: 'gauge',
                    plotBackgroundColor: null,
                    plotBackgroundImage: null,
                    plotBorderWidth: 0,
                    plotShadow: false,
                    height: '80%',
                    events: {
                        load: function () {
                          const chartWidth = this.chartWidth;
                          
        
                          
                          // Nuovo calcolo della font-size con una scala più accentuata
                          let fontSize;
                          const maxSize = 42; // Font-size massimo
                          const minSize = 16; // Font-size minimo
                          const maxWidth = 486; // Larghezza in cui il font è massimo
                          const minWidth = 238; // Larghezza in cui il font è minimo
                    
                          if (chartWidth >= maxWidth) {
                            fontSize = maxSize;
                          } else if (chartWidth <= minWidth) {
                            fontSize = minSize;
                          } else {
                            // Calcolo con scala più accentuata
                            fontSize = (chartWidth - minWidth) / (maxWidth - minWidth) * (maxSize - minSize) + minSize;
                          }
                    
                          this.series[0].update({
                            dataLabels: {
                              style: {
                                fontSize: `${fontSize}px`
                              }
                            }
                          }, false);
                          this.redraw();
                        }
                      }
              };
              
              options.tooltip = { enabled: false };    
              
              options.pane = {
                    startAngle: -90,
                    endAngle: 89.9,
                    background: null,
                    center: ['50%', '75%'],
                    size: '110%'
              };
              
              let maxValueHelper;
              maxValueHelper = this._config.chart?.max_value !== null? this._config.chart.max_value : 1000;
              
              options.yAxis = {
                  min: 0,
                  max: maxValueHelper,
                    tickPixelInterval: 50,
                    tickPosition: 'inside',
                    tickColor: '#FFFFFF',
                    tickLength: 20,
                    tickWidth: 2,
                    minorTickInterval: null,
                    labels: {
                        distance: 20,
                        style: {
                            fontSize: '14px'
                        }
                    },
                    lineWidth: 0,
                    plotBands: [{
                        from: 0,
                        to: (maxValueHelper / 3),
                        color: '#55BF3B', // green
                        thickness: 30,
                        //borderRadius: '50%'
                    }, {
                        from: maxValueHelper - (maxValueHelper / 3),
                        to: maxValueHelper,
                        color: '#DF5353', // red
                        thickness: 30,
                        //borderRadius: '50%'
                    }, {
                        from: (maxValueHelper / 3),
                        to: maxValueHelper - (maxValueHelper / 3),
                        color: '#DDDF0D', // yellow
                        thickness: 30
                    }]
              };

              options.series = [{
                    data: [0],
                    name: null,
                    dataLabels: {
                        y: -60,
                        borderWidth: 0,
                    },
                    dial: {
                        radius: '80%',
                        backgroundColor: 'gray',
                        baseWidth: 12,
                        baseLength: '0%',
                        rearLength: '0%'
                    },
                    pivot: {
                        backgroundColor: 'gray',
                        radius: 6
                    }
            
                }];
          
              break;
  
          case "pie":
              options.chart = { type: "pie" };
              options.plotOptions = {
                                      pie: {
                                          borderWidth: 0,         
                                          innerSize: "0%",       
                                      }
                                    };
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
          "pie": "pie", 
          "solidgauge": "solidgauge",
          "standardgauge": "standardgauge" 
      };
  
      return chartTypeMap[chartType] || chartType;
  }
    
  _getGlobalChartOptions() {
      const chartOptions = this._config.chart?.chartOptions;
  
      // Se non esiste `chartOptions`, restituiamo un oggetto vuoto per evitare errori
      if (!chartOptions || typeof chartOptions !== "string") return {};
  
      try {
          // Creiamo una funzione che accetta Highcharts come argomento
          const func = new Function("Highcharts", "return " + chartOptions);
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

  
      if (!window.Highcharts) {
          //this._loadHighcharts().then(() => this._renderChart());
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
                  console.error(`Errore nelle opzioni della serie ${ent.entity}:`, e);
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
                      y: -50,
                      format: `
                          <div style="text-align:center">
                              <span>{y:.0f}</span>&nbsp;<small style="color: #888888; font-size: 16px;">${ent.uMeasure !== undefined ? ent.uMeasure : ""}</small>
                          </div>
                      `,
                      useHTML: true
                  }
              }, extraOptions);
          }
          
          // 🔥 Se il grafico è standardgauge, impostiamo una serie specifica          
          if (this._config.chart?.type === "standardgauge") {
              
              return Highcharts.merge({
                    data: [0],
                    name: ent.name || ent.entity,
                    dataLabels: {
                      format: `
                          <div style="text-align:center">
                              <span>{y:.0f}</span>&nbsp;<small style="color: #888888; font-size: 16px;">${ent.uMeasure !== undefined ? ent.uMeasure : ""}</small>
                          </div>
                      `,
                        useHTML: true,
                        borderWidth: 0,
                        color: ent.color || undefined,
                        style: {
                            fontSize: '16px'
                        }
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
      const finalOptions = Highcharts.merge({}, baseOptions, typeSpecificOptions || {}, globalChartOptions || {});
  
      // Creiamo il grafico
      this._chart = Highcharts.chart(container, finalOptions);
      console.log("FINAL", finalOptions);

  }


  render() {

      if (!this._config) return html``;
  
      return html`
        <ha-card .header=${this._config.title || ""}>
          ${this._queryError ? html`
            <div style="color: red; padding: 10px; border: 1px solid red; background: #ffe6e6; margin-bottom: 10px;">
                <strong>⚠️ Errore:</strong> ${this._queryError}
            </div>
          ` : ""}
  
          <div id="chartContainer" style="width: 100%; height: ${this._config.chart.card_height || "100%"}; border-radius:12px;">
          </div>
        </ha-card>
      `;
  }
  
  static get styles() {

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
      // Normalizziamo la struttura delle entità per evitare problemi di compatibilità
      const normalizedEntities = Array.isArray(config.entity) ? config.entity : [config.entity];
  
      this._config = { 
          ...config, 
          entity: normalizedEntities, 
          chart: { 
              ...config.chart, 
              card_height: config.chart?.card_height || "300px", 
              max_value: config.chart?.max_value ?? null, 
              chartOptions: config.chart?.chartOptions !== undefined ? config.chart.chartOptions : "{}" // 🔥 Aggiunto controllo esplicito
          } 
      };
      
      if (!this.comboBoxEntities || this.comboBoxEntities.length === 0) {
          if (this.hass && this.hass.states) {
              this.comboBoxEntities = Object.keys(this.hass.states).filter(e => e.startsWith("sensor."));

          }
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
      } else if (field === "card_height") {
          newConfig.chart = { ...newConfig.chart, card_height: newValue || "100%" };
      } else if (field === "legend") {
          newConfig.chart = { ...newConfig.chart, legend: e.target.checked };    
      } else if (field === "max_value") {
          const parsedValue = parseFloat(newValue);
          newConfig.chart = { 
              ...newConfig.chart, 
              max_value: isNaN(parsedValue) ? null : parsedValue 
          };
      } else if (field === "chartOptions") {  
          newConfig.chart = { 
              ...newConfig.chart, 
              chartOptions: newValue // Mantiene la stringa senza convertirla in JSON
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
        uMeasure: "",
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

                    <ha-textfield
                        label="U Measure"
                        .value=${ent.uMeasure || ""}
                        data-field="uMeasure"
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
            <mwc-list-item value="multiplegauge">Multiple Gauge</mwc-list-item>
            <mwc-list-item value="standardgauge">Standard Gauge</mwc-list-item>
            <mwc-list-item value="pie">Pie</mwc-list-item>
          </ha-select>
          
          <ha-textfield
            label="Card Height"
            data-field="card_height"
            .value=${this._config.chart?.card_height ?? "300px"}
            @input=${this._valueChanged}
          ></ha-textfield>
          
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
          
          <ha-formfield label="Show legend">
            <ha-switch
              data-field="legend"
              .checked=${this._config.chart.legend === true}
              @change=${this._valueChanged}
            ></ha-switch>
          </ha-formfield>
          
      </div>    
      
      <!-- ADVANCED TAB -->
      <div class="section"  style="display:${this.activeTab === "advanced" ? "block" : "none"};">
          <h4>Advanced Highcharts Config</h4>
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
                      aria-label="chartOptions"
                      data-field="chartOptions"
                      @input=${this._valueChanged}
                  >${this._config.chart?.chartOptions || "{}"}</textarea>
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
