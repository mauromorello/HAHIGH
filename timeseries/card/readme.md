# TIMESERIES CARD: visualize long term data with highcharts, influxdb and CUSTOM CARD integration within HOME ASSISTANT

Welcome to **[HAHIGH](https://github.com/mauromorello/HAHIGH)**! This project integrates the powerful [Highcharts](https://www.highcharts.com/) library into [Home Assistant](https://www.home-assistant.io/), enabling you to display beautiful timeseries charts sourced from your [InfluxDB](https://www.influxdata.com/) database.

<img src="https://github.com/user-attachments/assets/7c474926-b53f-4116-8d6d-7d637bd28d05" style="width:200px;">
<img src="https://github.com/user-attachments/assets/611f29bf-e261-47f5-a7e2-59f4a119d924" style="width:200px;">
<img src="https://github.com/user-attachments/assets/1c6d9ff2-d86b-4f79-92cb-843e11388f74" style="width:200px;">
<img src="https://github.com/user-attachments/assets/861fc8b5-001b-47c1-a5d9-525fde1efe48" style="width:200px;">


---

## License Notice for Highcharts

- **Highcharts** is a product of **Highsoft AS**.  
- Before using Highcharts, you must comply with the [Highcharts License](https://www.highcharts.com/license).  
- For non-commercial or personal usage, consult their [free license usage guidelines](https://shop.highsoft.com/non-commercial).

---

## Card Overview

The custom card in this repository is named **`timeseries-highinflux-card`**, and it was created by combining:

1. **ChatGPT** as a code generator  
2. The **barebones custom card gist** from [@thomasloven](https://github.com/thomasloven):  
   [https://gist.github.com/thomasloven/1de8c62d691e754f95b023105fe4b74b](https://gist.github.com/thomasloven/1de8c62d691e754f95b023105fe4b74b)

> **Important Note:**
>
> - Highcharts supports hundreds of configuration parameters. This card only exposes a core subset of them. If you need more advanced customizations, you may need to modify the source or incorporate additional Highcharts options manually.
> - This is a private attempt to porting highcharts in HA. If future version of both HA, Influx or Highcharts will have disrupting update, this may not work anymore.
> - This repository is not intendet to be maintained, just a placeholder. Feel free to copy or use as toilet paper.

---

## Supported Chart Types

By default, `timeseries-highinflux-card` supports the following Highcharts [chart types](https://www.highcharts.com/docs/chart-and-series-types/):

- **line**  
- **spline**  
- **area**  
- **areaspline**  
- **bar**  
- **column**

You can select one of these through the card’s `chart_type` parameter.

---

## How to Install

1. **Download** or **copy** the `timeseries-highinflux-card.js` file from this repository.
2. Place it in the `www/` folder of your Home Assistant configuration (e.g., `/config/www/`).
3. check your **configuration.yaml** if your folder is whitelisted as above:

```
homeassistant:
  allowlist_external_dirs:
    - /config/www
```

4. Go to Settings -> Dashboards, click on the three-dot menu in the top-right corner, and >select Resources. Then, add a new resource, set the type to Module, and enter the correct path to your file, replacing **www** with **local** (e.g., **/www/timeseries-highinflux-card.js** should become **/local/timeseries-highinflux-card.js**)


After adding it as a resource, open the **Lovelace UI** → **Overview** → **Edit Dashboard** → **Add Card** → find **“Timeseries High Influx Card”**. Configure it via the UI editor or through YAML.

## Example Configuration


```
   type: custom:timeseries-highinflux-card
   title: "Multiple Series Chart"
   influx_url: "http://your_influxdb_host:8086"
   influx_db: "example_db"
   influx_user: "example_user"
   influx_password: "example_pass"
   chart_type: "areaspline"
   chart_height: "300px"
   legend: true
   update_interval: 120000
   entities:
     - name: Temperature
       color: #F44
       query: >
         SELECT mean("value")
         FROM "°C"
         WHERE ("entity_id" = 'temp_sensor')
         AND time > now() - 90d
         GROUP BY time(1d) fill(null)
       unita_misura: "°C"
     - name: Humidity
       color: #FF4
       query: >
         SELECT mean("value")
         FROM "%" WHERE ("entity_id" = 'humi_sensor')
         AND time > now() - 90d
         GROUP BY time(1d) fill(null)
       options: >
         {
           "lineWidth": 5
         }
       unita_misura: "%"
```

In these configurations:

- `title`: The card title displayed at the top.  
- `chart_type`: Highcharts series type (`line`, `spline`, `area`, `areaspline`, `bar`, `column`).  
- `chart_height`: The CSS height for the chart container (e.g., `300px`).  
- `update_interval`: How often (in milliseconds) the card refreshes data from InfluxDB.  
- `legend`: Set to `true` to display the series legend.  
- `entities`: An array of objects, each containing a
   - `query`, INFLUX query fetching your data
   - a `name`, Name of the series
   - a optional `color`, see below.
   - a optional `options`, see below.
   - and an optional `unita_misura` for the y-axis tooltip suffix.
 
#### Series Color Configuration

Each series in the chart can have a custom color defined using the `color` property. If the `color` field is left empty, Highcharts will use its default color palette.

You can specify the color in one of the following formats:

- **3-digit hexadecimal color**: `#FFF` (each digit ranges from 0 to F)
- **6-digit hexadecimal color**: `#FFFFFF` (each pair of digits ranges from 00 to FF)
- **RGB format**: `rgb(255,255,255)` (values range from 0 to 255)
- **RGBA format**: `rgba(255,255,255,1)` (values range from 0 to 255, with an alpha channel from 0 to 1)

If the `color` property is left empty, Highcharts will automatically assign a default color palette to the charts.

## ⚙️ Advanced Series Options (options)
[Higcharts series API](https://api.highcharts.com/highcharts/series)

Each series in the chart supports an optional field called options, allowing customization of various aspects such as color, tooltip visibility, line type, and more.

🔴 **Warning**: This feature is experimental. If you provide an incorrect JSON format or invalid options, the chart may fail to render.

### 📌 Configuration Example
If you want to set the witdth to 5 pixels for the first series, use the following configuration in your YAML or UI editor:

```
entities:
  - name: "Temperature"
    query: "SELECT mean(value) FROM temperature WHERE time > now() - 1d GROUP BY time(5m)"
    unita_misura: "°C"
    options: >
      {
        "lineWidth": 5
      }
```

### 📖 More options Examples
Here are some advanced configurations you can apply:

```
{
  "color": "blue",
  "dashStyle": "dot",
  "lineWidth": 2,
  "tooltip": { "enabled": false }
}
```
👀 What does this do?

The series will be blue
The line style will be dotted (dot)
The line width will be 2px
The tooltip will be disabled for this series


## 🚨 Common Mistakes

- ❌ Invalid JSON format (missing commas, incorrect brackets, etc.)
- ❌ Unsupported keys (e.g., "background": "red" → not a valid series property)
- ❌ Incorrect values (e.g., "color": 1234 → must be a string)

If the chart does not appear, check the browser console (F12 → Console) for error messages.







