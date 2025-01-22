
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
      title: "InfluxDB Chart",
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
    this.updateInterval = config.update_interval || 60000;

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
  }

  /**
   * Called by Lovelace on each update cycle.
   * Typically used to store the hass object if needed.
   */
  set hass(hass) {
    this._hass = hass;
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
    // If not already set up, start loading Highcharts
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
    this._timeoutId = setInterval(() => this._fetchData(), this.updateInterval);
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
    
        // Se lo script non è caricato e non è in fase di caricamento, lo carichiamo
        window._highchartsLoading = new Promise((scriptResolve, scriptReject) => {
          const script = document.createElement("script");
          script.src = "https://code.highcharts.com/highcharts.js";
          script.async = true;
          script.onload = () => {
            console.log("Highcharts successfully loaded");
            scriptResolve();
            resolve();
          };
          script.onerror = () => {
            console.error("Error loading Highcharts");
            scriptReject();
            reject();
          };
          document.head.appendChild(script);
        });
    
        // Assicuriamoci che altre chiamate aspettino questo caricamento
        window._highchartsLoading.then(resolve).catch(reject);
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
            // new Function('return ...') trasforma una stringa in oggetto/funzione JS
            // Esempio di testo in textarea: 
            // {
            //   color: "green",
            //   lineWidth: 5,
            //   marker: { enabled: false },
            //   tooltip: {
            //     formatter: function() { return "Value: " + this.y; }
            //   }
            // }
            //extraOptions = new Function("return " + config.entities[i].options)();
            const code = config.entities[i].options;
            try {
              // Passa l'oggetto Highcharts alla funzione 
              const func = new Function("Highcharts", "return " + code);
              extraOptions = func(window.Highcharts);
            } catch (e) {
              console.error("Impossibile interpretare options:", e);
              extraOptions = {};
            }
 
          } catch (e) {
            console.error(`Literal JS non valido in config.entities[${i}].options:`, e);
            extraOptions = {};
          }
        }

        // Facciamo il deep merge tra la serie base e le opzioni extra
       // return this.deepMerge(baseSeries, extraOptions);
        return Highcharts.merge(baseSeries, extraOptions);
      });

      // Se i dati sono cambiati, rilanciamo il rendering
      if (JSON.stringify(chartSeries) !== JSON.stringify(this._lastData)) {
        this._lastData = chartSeries;
        this._renderChart(chartSeries);
      }
    } catch (error) {
      console.error("Error fetching data per una o più entities:", error);
    }
  } else {
    // Single-query mode
    console.error("EX single query");
  }
}

  /**
   * Utility function to fetch data for a single entity
   * (used in multiple-entities mode)
   */
  async _fetchEntityData(entity) {
    const config = this._config;
    if (!entity.query) {
      throw new Error("Each entity must define a 'query' parameter.");
    }

    const url =
      `${config.influx_url}/query?u=${encodeURIComponent(config.influx_user)}` +
      `&p=${encodeURIComponent(config.influx_password)}` +
      `&db=${encodeURIComponent(config.influx_db)}` +
      `&q=${encodeURIComponent(entity.query)}`;

    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`HTTP error! Status: ${response.status}`);
    }
    const data = await response.json();

    // In case of query with no results, avoid errors
    if (!data.results[0] || !data.results[0].series) {
      return { parsedData: [] };
    }

    const seriesValues = data.results[0].series[0].values;
    const parsedData = seriesValues.map((point) => [
      new Date(point[0]).getTime(),
      point[1]
    ]);

    return { parsedData };
  }

  /**
   * Builds the Highcharts chart in the #chartContainer div
   */
    _renderChart(seriesData) {
      if (!window.Highcharts) {
        console.error("Highcharts not available, reloading the library...");
        this._loadHighcharts().then(() => this._renderChart(seriesData));
        return;
      }
    
      const container = this.shadowRoot.getElementById("chartContainer");
      if (!container) return;
    
      // Opzioni base
      const baseOptions = {
        chart: {
          type: this._config.chart_type || "line",
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
          console.error("Impossibile interpretare chart_options:", e);
          globalChartOptions = {};
        }
      }
    
      // Unisco le due parti prima di creare il grafico
      const finalOptions = Highcharts.merge(baseOptions, globalChartOptions);
    
      // Creo il grafico con le opzioni finali
      Highcharts.chart(container, finalOptions);
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
      _config: {}
    };
  }

  setConfig(config) {
    // Copy to avoid mutating the original
    this._config = { ...config };
    // If no entities array, initialize it
    if (!this._config.entities) {
      this._config.entities = [];
    }
  }

  // Handle changes to generic (top-level) parameters
  _valueChanged(ev) {
    if (!this._config) return;
    const target = ev.target;
    const newConfig = { ...this._config };

    // We use data-field="..." to decide which property to update
    const field = target.getAttribute("data-field");
    if (!field) return;

    // For the boolean (legend) we look at target.checked
    // For numeric (max_y, update_interval) we parse them
    // For strings (url, user, password, etc.) we take target.value
    if (field === "legend") {
      newConfig.legend = target.checked;
    } else if (field === "max_y") {
      newConfig.max_y = target.value.trim() === "" ? null : parseFloat(target.value);
    } else if (field === "update_interval") {
      newConfig.update_interval = parseInt(target.value, 10) || 60000;
    } else if (field === "chart_type") {
      // Validate chart type
      const validTypes = ["line", "spline", "area", "areaspline", "bar", "column"];
      newConfig.chart_type = validTypes.includes(target.value)
        ? target.value
        : "line";
    } else {
      // fallback: string fields
      newConfig[field] = target.value;
    }

    this._config = newConfig;
    this._fireConfigChanged(newConfig);
  }

  // Handle changes to per-entity parameters
  _entityValueChanged(ev) {
    if (!this._config) return;
    const target = ev.target;
    const index = parseInt(target.getAttribute("data-index"), 10);
    const field = target.getAttribute("data-field");
    if (isNaN(index) || !field) return;

    // Copy the entities array
    const newEntities = [...this._config.entities];
    // Copy the specific entity
    const updatedEntity = { ...newEntities[index] };

    // Update the relevant property (name, query, unita_misura, etc.)
    updatedEntity[field] = target.value;
    newEntities[index] = updatedEntity;

    // Update config
    const newConfig = { ...this._config, entities: newEntities };
    this._config = newConfig;
    this._fireConfigChanged(newConfig);
  }

  // Add a new blank entity
  _addEntity() {
    if (!this._config) return;
    const newEntities = [...(this._config.entities || [])];
    // Example of a "blank" entity
    newEntities.push({ name: "", color: "", query: "", unita_misura: "" });

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

  render() {
    if (!this._config) return html``;

    return html`
      <div class="card-config">
        <div class="section">
          <ha-textfield
            label="Title"
            data-field="title"
            .value=${this._config.title || ""}
            @input=${this._valueChanged}
          ></ha-textfield>
        </div>

        <div class="section">
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
        <div class="section">
          <ha-select
            label="Chart Type"
            data-field="chart_type"
            .value=${this._config.chart_type || "line"}
            @selected=${this._valueChanged}
            @closed=${(e) => e.stopPropagation()}
          >
            <mwc-list-item value="line">Line</mwc-list-item>
            <mwc-list-item value="spline">Spline</mwc-list-item>
            <mwc-list-item value="area">Area</mwc-list-item>
            <mwc-list-item value="areaspline">Area Spline</mwc-list-item>
            <mwc-list-item value="bar">Bar</mwc-list-item>
            <mwc-list-item value="column">Column</mwc-list-item>
          </ha-select>
        </div>


        <div class="section">
          <ha-textfield
            label="Chart Height (e.g. 300px)"
            data-field="chart_height"
            .value=${this._config.chart_height || ""}
            @input=${this._valueChanged}
          ></ha-textfield>

          <ha-textfield
            label="Max Y"
            data-field="max_y"
            .value=${this._config.max_y || ""}
            @input=${this._valueChanged}
          ></ha-textfield>

          <ha-textfield
            label="Update Interval (ms)"
            data-field="update_interval"
            .value=${this._config.update_interval || ""}
            @input=${this._valueChanged}
          ></ha-textfield>

          <ha-formfield label="Show legend">
            <ha-switch
              data-field="legend"
              .checked=${this._config.legend === true}
              @change=${this._valueChanged}
            ></ha-switch>
          </ha-formfield>
          
            <label class="mdc-text-field mdc-text-field--outlined mdc-text-field--textarea" >
              <span class="mdc-notched-outline">
                <span class="mdc-notched-outline__leading"></span>
                <span class="mdc-floating-label">Highcharts series options <small><a href="https://api.highcharts.com/highcharts/series" TARGET="BLANK">API here</a></small></span>
                <span class="mdc-notched-outline__trailing"></span>
              </span>
              <span class="mdc-text-field__resizer">
                <textarea
                  class="mdc-text-field__input"
                  rows="8"
                  cols="40"
                  style="width:100% !important;"
                  aria-label="Root Chart Options"
                  data-field="chart_options"
                  @input=${this._valueChanged}
                >${this._config.chart_options || "Put here your root chart options"}</textarea>
              </span>
            </label>
        </div>

        <!-- Multiple entities configuration -->
        
        <div class="entities section">
          <h4>Entities (multiple series on the chart)</h4>
          ${this._config.entities.map((ent, index) => html`
            <div class="entity">
              
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
                      rows="8"
                      cols="40"
                      style="width:100% !important;"
                      aria-label="Influx Query"
                      data-field="query"
                      data-index=${index}
                      @input=${this._entityValueChanged}
                    >${ent.query || "Put here your query"}</textarea>
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
                      rows="8"
                      cols="40"
                      style="width:100% !important;"
                      aria-label="Options"
                      data-field="options"
                      data-index=${index}
                      @input=${this._entityValueChanged}
                    >${ent.options || "Put here your highchart serie options"}</textarea>
                  </span>
                </label>

              <ha-textfield
                label="Unit of measure"
                .value=${ent.unita_misura || ""}
                data-field="unita_misura"
                data-index=${index}
                @input=${this._entityValueChanged}
              ></ha-textfield>

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
    `;
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
