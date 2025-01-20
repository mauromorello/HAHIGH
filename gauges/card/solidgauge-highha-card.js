import { html, css, LitElement } from "https://unpkg.com/lit-element@2.4.0/lit-element.js?module";

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
      [0.1, "#55BF3B"], // green
      [0.5, "#DDDF0D"], // yellow
      [0.9, "#DF5353"] // red
    ];

    const stops = this._config.stops
      ? JSON.parse(this._config.stops)
      : defaultStops;

    const gaugeOptions = {
      chart: {
        type: "solidgauge"
      },
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
        this._config.pane ? JSON.parse(this._config.pane) : {}
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
              format:
                '<div style="text-align:center"><span>{y}</span>&nbsp;<span>' +
                (this._config.unit || "") +
                "</span></div>"
            }
          }
        },
        this._config.plotOptions ? JSON.parse(this._config.plotOptions) : {}
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
    if (typeof source !== "object" || source === null) {
      return target;
    }
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

window.customCards = window.customCards || [];
window.customCards.push({
  type: "solidgauge-highha-card",
  name: "Solid Gauge Highcharts",
  description: "A Highcharts SolidGauge for Home Assistant"
});

