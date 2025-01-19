# HAHIGH - Highcharts for Home Assistant

## Overview
HAHIGH is a resource package designed to visualize data stored in an **InfluxDB** database using the **Highcharts** library. The goal is to provide **highly configurable** visualization options within **Home Assistant**.

These tools are intended to be **barebones**, allowing users to customize them freely. **Basic JavaScript knowledge is required** for modifications and extensions.

## Compatibility
The library has been tested and is compatible with:
- **InfluxDB**: Version **1.8**
- **Home Assistant**: Version **2025.1**
- **Highcharts**: Version **14.1**

Future versions of these dependencies may impact functionality.

## Avaiable tools:

**TIMESERIES CARD**: a card easy to integrate connecting to influxdb, multiple series, basic configuration
<img src="https://github.com/user-attachments/assets/d9015be3-e147-487c-9f5e-a49e09bf1420" style="width:200px;">

**SOLIDGAUGE WEB**: a html page that can be putted inside HA iframe (web card) with some configuration passed by parameter. Realtime data from your sensors.
<img src="https://github.com/user-attachments/assets/a2c05116-df11-4fc5-80ed-a0ae0dbb260b" style="width:200px;">


## License Considerations
Each component of this package is subject to its respective license agreements. Users should be aware of the licensing terms before integrating these tools.

### Highcharts License
Highcharts is a **commercial** charting library. Users must comply with Highcharts' licensing terms if using it beyond personal, non-commercial applications.

- **Highcharts Licensing Information**: [https://www.highcharts.com/license](https://www.highcharts.com/license)
- **Highcharts API Reference**: [https://api.highcharts.com/highcharts/](https://api.highcharts.com/highcharts/)

### InfluxDB License
InfluxDB follows the **MIT License** for version 1.8, but later versions may introduce changes.
- **InfluxDB Licensing**: [https://www.influxdata.com/legal/licenses/](https://www.influxdata.com/legal/licenses/)

### Home Assistant License
Home Assistant is released under an **Apache 2.0 License**.
- **Home Assistant Licensing**: [https://www.home-assistant.io/license/](https://www.home-assistant.io/license/)

## Installation & Usage
This package does not include a ready-to-use interface but provides a foundation for users to integrate Highcharts with InfluxDB data within Home Assistant.

For setup instructions and customization examples, refer to the documentation provided within this repository.

## Disclaimer
This package is provided **as-is**, with no guarantees regarding future compatibility with Home Assistant, InfluxDB, or Highcharts updates. Users are encouraged to test thoroughly before deploying in production environments.
