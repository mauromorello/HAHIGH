HAHIGH: Highcharts for Home Assistant with InfluxDB
Welcome to HAHIGH! This project integrates the powerful Highcharts library into Home Assistant, enabling you to display beautiful timeseries charts sourced from your InfluxDB database.

License Notice for Highcharts
Highcharts is a product of Highsoft AS.
Before using Highcharts, you must comply with the Highcharts License.
For non-commercial or personal usage, consult their free license usage guidelines.
Card Overview
The custom card in this repository is called timeseries-highinflux-card, and it was created by combining:

ChatGPT as a code generator; and
The barebones custom card gist from @thomasloven:
https://gist.github.com/thomasloven/1de8c62d691e754f95b023105fe4b74b.
Important Note: Highcharts supports hundreds of configuration parameters. This card only exposes a core subset of them. If you need more advanced customizations, you may need to modify the source or incorporate additional Highcharts options manually.

Supported Chart Types
By default, timeseries-highinflux-card supports the following Highcharts chart types:

line
spline
area
areaspline
bar
column
You can select one of these through the card’s chart_type parameter.

How to Install
Download or copy the timeseries-highinflux-card.js file from this repository.
Place it in the www/ folder of your Home Assistant configuration (e.g., /config/www/).
In Lovelace Resources (either YAML or UI), add:
yaml
Copy
resources:
  - url: /local/timeseries-highinflux-card.js
    type: module
Reload or refresh Home Assistant.
Then, in the Lovelace UI, go to Overview → Edit Dashboard → Add Card → search or scroll for “Timeseries High Influx Card”. Select it and configure as desired in the UI or via YAML.

Example Configuration
Below is a sample YAML configuration. Paste it into your Lovelace dashboard, either in the Manual Card or in the Raw Configuration Editor:

yaml
Copy
type: custom:timeseries-highinflux-card
title: "InfluxDB Chart Example"
influx_url: "http://your_influxdb_host:8086"
influx_db: "example_db"
influx_user: "example_user"
influx_password: "example_pass"
chart_type: "line"
chart_height: "300px"
max_y: 100
update_interval: 60000
legend: true
influx_query: >
  SELECT mean("value")
  FROM "°C"
  WHERE ("entity_id" = 'my_temperature_entity_id')
  AND time > now() - 120d
  GROUP BY time(1d) fill(null)
If you need multiple series, you can define entities instead:

yaml
Copy
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
    query: >
      SELECT mean("value")
      FROM "°C"
      WHERE ("entity_id" = 'temp_sensor')
      AND time > now() - 90d
      GROUP BY time(1d) fill(null)
    unita_misura: "°C"
  - name: Humidity
    query: >
      SELECT mean("value")
      FROM "%"
      WHERE ("entity_id" = 'humi_sensor')
      AND time > now() - 90d
      GROUP BY time(1d) fill(null)
    unita_misura: "%"
Disclaimer
No warranty is provided for functionality, reliability, or security. Use it at your own risk.
The authors and contributors assume no liability for any damages or losses resulting from use of this project.
Be sure to respect all relevant licenses, including those for Highcharts, Home Assistant, and InfluxDB.
