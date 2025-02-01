# TIMESERIES CARD: visualize long term data with highcharts, influxdb and CUSTOM CARD integration within HOME ASSISTANT

Welcome to **[HAHIGH](https://github.com/mauromorello/HAHIGH)**! This project integrates the powerful [Highcharts](https://www.highcharts.com/) library into [Home Assistant](https://www.home-assistant.io/), enabling you to display beautiful timeseries charts sourced from your [InfluxDB](https://www.influxdata.com/) database.


<img src="https://github.com/user-attachments/assets/f27dad22-5ef5-4e24-8be6-5fd5fe578315" style="width:100%;">
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

### Performance improvements
While HAHIGH can be installed as a lovelace resource, some functionality will benefit greatly from it being installed as a frontend module instead.

To do that, add the following to your configuration.yaml file and restart Home Assistant:

```
frontend:
  extra_module_url:
    - /local/timeseries-highinflux-card.js
```
    
You'll need to adjust that path according to where you have installed timeseries-highinflux-card.js. 


## Configurable Properties

### Global Configuration
- **title**: The title displayed in the card header.
- **influx_url**: The URL of the InfluxDB server.
- **influx_db**: The name of the InfluxDB database.
- **influx_user**: The username for accessing InfluxDB.
- **influx_password**: The password for InfluxDB.
- **update_interval**: The automatic update interval in seconds.

### Global Chart Options
- **chart_height**: The height of the chart (e.g., "300px").
- **chart_type**: The type of chart. Valid options include **line**, **spline**, **area**, **areaspline**, **areastacked**, **areastackedpercent**, **bar**, and **column**.
- **selector**: A boolean flag; when enabled, it activates Highcharts' selector (using stockChart).
- **legend**: A boolean flag to show or hide the chart legend.
- **max_y**: The maximum value for the Y-axis.
- **chart_options**: Additional global options for Highcharts, provided as JSON or JavaScript code.

### Per-Entity Configuration (Multiple Entities Mode)
Each entity in the **entities** array can have its own settings:
- **sensor**: The sensor identifier (e.g., "sensor.temperature").
- **query**: The InfluxDB query to retrieve data for the entity.
- **unita_misura**: The unit of measurement for the sensor (used in tooltips).
- **name**: The display name for the series.
- **color**: The color assigned to the series in the chart.
- **options**: Specific Highcharts options for the series, provided as JSON or JavaScript code.

## Card Capabilities

- **Data Visualization**:  
  The card queries InfluxDB and displays time-series data using Highcharts, offering dynamic and interactive charts.

- **Automatic Updates**:  
  The chart data refreshes automatically based on the configured update interval, ensuring that the information is always current.

- **Multi-Entity Support**:  
  Users can configure multiple entities, each with individual queries and options, or use a single-query configuration.

- **Advanced Editor Interface**:  
  The card’s configuration editor is organized into multiple tabs (e.g., **Database**, **Chart**, **Series/Config**) to simplify the setup of both global and per-entity settings.

- **Snippet Helpers**:  
  The editor includes a snippet helper feature.  
  - **How It Works**: Clicking the copy icon on a snippet copies the code into the clipboard and automatically inserts it at the current cursor position in the active textarea.
  - **Benefits**: This makes it easy to import small configuration snippets—such as chart themes, gradient settings, shadow options, and other advanced Highcharts configurations—directly into the card’s configuration.

## Summary
The **Timeseries High Influx Card** is designed for Home Assistant dashboards to display InfluxDB data with high flexibility and customization. It leverages Highcharts for robust charting capabilities and offers a wide range of configurable properties for both global settings and per-entity customization. The built-in snippet helper enhances the user experience by allowing quick insertion of pre-defined configuration snippets into textareas.


## Example Configuration

Minimal configuration:
In these configurations are shown minimal parameters to show a timeline-based line graph, with standard color.

```
type: custom:timeseries-highinflux-card
influx_url: "http://your_influxdb_host:8086"
influx_db: example_db
influx_user: example_user
influx_password: example_pass
entities:
  - query: |+
      SELECT mean("value") FROM "W" 
      WHERE ("entity_id" = 'example_sensor') AND time > now() - 90d 
      GROUP BY time(1d) fill(null)
```

Less Minimal configuration:

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

## ⚙️ Advanced Charts Options
[Higcharts API](https://api.highcharts.com/highcharts)

All chart configuration can be overwritten by these options. Please reter to highcharts "chart" options to understand the power of this config option.


## ⚙️ Advanced Series Options (options)
[Higcharts series API](https://api.highcharts.com/highcharts/series)

Each series in the chart supports an optional field called options, allowing customization of various aspects such as color, tooltip visibility, line type, and more.


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







