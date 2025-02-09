import { LitElement, html, css } from "https://unpkg.com/lit-element@2.4.0/lit-element.js?module";
// Se disponibile, importa fireEvent da "custom-card-helpers" per gestire gli eventi di configurazione:
// import { fireEvent } from "custom-card-helpers";

// Funzione di utilità per gestire sia JSON string che oggetti
function parseObjectOrString(value, fallback = {}) {
  if (!value) return fallback;
  if (typeof value === "string") {
    try {
      return JSON.parse(value);
    } catch (e) {
      console.warn("Invalid JSON for config, ignoring parse error:", e);
      return fallback;
    }
  }
  return value;
}

// Evita caricamenti multipli di Highcharts
window._highchartsLoading = window._highchartsLoading || null;

class SolidGaugeHighHaCard extends LitElement {
  static get properties() {
    return {
      _config: { type: Object },
      _hass: { type: Object },
      chart: { type: Object }
    };
  }

  static getStubConfig() {
    return {
      title: "Gauge",
      entity: "sensor.example"
    };
  }

  static getConfigElement() {
    return document.createElement("solidgauge-highha-card-editor");
  }

  setConfig(config) {
    this._config = config;
    this.chart = null;
  }

  set hass(hass) {
    this._hass = hass;
    this._updateGauge();
  }

  render() {
    if (!this._config) return html``;
    return html`
      <ha-card .header=${this._config.title || "Gauge"}>
        <div id="chartContainer" style="width: 100%; height: 100px;"></div>
      </ha-card>
    `;
  }

  firstUpdated() {
    this._loadHighcharts().then(() => {
      this._initGauge();
    });
  }

  async _loadHighcharts() {
    return new Promise((resolve, reject) => {
      if (window.Highcharts) {
        resolve();
        return;
      }
      if (window._highchartsLoading) {
        window._highchartsLoading.then(resolve).catch(reject);
        return;
      }
      window._highchartsLoading = new Promise((scriptResolve, scriptReject) => {
        const scripts = [
          "https://code.highcharts.com/highcharts.js",
          "https://code.highcharts.com/highcharts-more.js",
          "https://code.highcharts.com/modules/solid-gauge.js"
        ];
        let loadedScripts = 0;
        scripts.forEach(src => {
          const script = document.createElement("script");
          script.src = src;
          script.async = true;
          script.onload = () => {
            loadedScripts++;
            if (loadedScripts === scripts.length) {
              scriptResolve();
              resolve();
            }
          };
          script.onerror = scriptReject;
          document.head.appendChild(script);
        });
      });
      window._highchartsLoading.then(resolve).catch(reject);
    });
  }

  _initGauge() {
    if (!window.Highcharts) {
      console.error("Highcharts not loaded");
      return;
    }
    const container = this.shadowRoot.getElementById("chartContainer");
    if (!container) return;

    const defaultStops = [
      [0.1, "#55BF3B"], // verde
      [0.5, "#DDDF0D"], // giallo
      [0.9, "#DF5353"]  // rosso
    ];
    const stops = parseObjectOrString(this._config.stops, defaultStops);

    const gaugeOptions = {
      chart: { type: "solidgauge" },
      title: {
        text: this._config.title || "Gauge",
        align: "center"
      },
      pane: this.deepMerge(
        {
          center: ["50%", "85%"],
          size: "100%",
          startAngle: -90,
          endAngle: 90
        },
        parseObjectOrString(this._config.pane)
      ),
      tooltip: { enabled: false },
      yAxis: {
        stops: stops,
        min: 0,
        max: this._config.max || 100
      },
      plotOptions: this.deepMerge(
        {
          solidgauge: {
            dataLabels: {
              format: `<div style="text-align:center"><span>{y}</span>&nbsp;<span>${this._config.unit || ""}</span></div>`
            }
          }
        },
        parseObjectOrString(this._config.plotOptions)
      ),
      series: [{ data: [0] }]
    };
    this.chart = Highcharts.chart(container, gaugeOptions);
    this._updateGauge();
  }

  _updateGauge() {
    if (!this._hass || !this.chart || !this._config.entity) return;
    const state = parseFloat(this._hass.states[this._config.entity]?.state);
    if (!isNaN(state)) {
      this.chart.series[0].points[0].update(state);
    }
  }

  deepMerge(target, source) {
    if (typeof source !== "object" || source === null) return target;
    const merged = { ...target };
    for (const [key, value] of Object.entries(source)) {
      if (typeof value === "object" && value !== null) {
        merged[key] = this.deepMerge(merged[key] || {}, value);
      } else {
        merged[key] = value;
      }
    }
    return merged;
  }

  static get styles() {
    return css`
      :host {
        display: block;
      }
    `;
  }
}

customElements.define("solidgauge-highha-card", SolidGaugeHighHaCard);

// -- Editor per la configurazione grafica --

class SolidGaugeHighHaCardEditor extends LitElement {
  static get properties() {
    return {
      _config: {}
    };
  }

  setConfig(config) {
    this._config = { ...config };
  }

  get _title() {
    return this._config.title || "";
  }
  get _entity() {
    return this._config.entity || "";
  }

  render() {
    if (!this._config) return html``;
    return html`
      <div class="card-config">
        <ha-textfield
          label="Titolo"
          .value=${this._title}
          .configValue=${"title"}
          @input=${this._valueChanged}
        ></ha-textfield>
        <ha-entity-picker
          label="Entità"
          .value=${this._entity}
          .configValue=${"entity"}
          @value-changed=${this._valueChanged}
          allow-custom-entity
        ></ha-entity-picker>
        <!-- Aggiungi qui eventuali altri campi (max, unit, stops, ecc.) -->
      </div>
    `;
  }

  _valueChanged(ev) {
    if (!this._config) return;
    const target = ev.target;
    const newConfig = { ...this._config };
    newConfig[target.configValue] = target.value;
    this._config = newConfig;
    // Se usi custom-card-helpers:
    // fireEvent(this, "config-changed", { config: this._config });
    // Altrimenti:
    this.dispatchEvent(new CustomEvent("config-changed", { detail: { config: this._config } }));
  }
}

customElements.define("solidgauge-highha-card-editor", SolidGaugeHighHaCardEditor);

// -- Registrazione per Home Assistant --

window.customCards = window.customCards || [];
window.customCards.push({
  type: "solidgauge-highha-card",
  name: "Solid Gauge Highcharts",
  description: "A Highcharts SolidGauge for Home Assistant"
});
