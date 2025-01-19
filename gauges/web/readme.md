# HAHIGH Web Card - Highcharts Gauge for Home Assistant

## Overview
The **HAHIGH Web Card** is a web-based page designed to be embedded within a **Web Card** in Home Assistant. It uses **Highcharts** to display real-time data from Home Assistant sensor in the form of a highly customizable **solid gauge**.

## Features
- **Real-time updates**: Automatically fetches data from a Home Assistant sensor.
- **Customizable parameters**: Allows configuration of title, max value, update interval, and unit of measurement.
- **Responsive design**: Adapts to different screen sizes.
- **Dynamic query parameters**: Modify chart behavior via URL parameters.
- **Easy integration**: Can be used inside a Web Card in Home Assistant.

## Configuration
This page supports multiple **URL parameters** to customize its behavior:

| Parameter  | Description                                      | Default               |
|------------|--------------------------------------------------|-----------------------|
| `sensor`   | The Home Assistant sensor entity ID             | `sensor.default_sensor` |
| `max`      | Maximum value for the gauge                     | `1000`                |
| `title`    | Chart title                                      | `Default Title`       |
| `umisura`  | Unit of measurement (e.g., W, °C)               | `w`                   |
| `update`   | Update interval in seconds                      | `2`                   |
| `size`     | Size percentage of the gauge                    | `150`                 |

### Example Usage in Home Assistant Web Card

To integrate the gauge into Home Assistant, follow these steps:

Copy the file to a folder accessible from the web, such as:
```
/config/www/
```
Add a new card in Home Assistant and choose "Web Card" from the available options.

Set the URL, including all required parameters, in the card settings:
```
/local/hahigh_gauge.html?sensor=sensor.power_usage&max=5000&title=Power%20Consumption&umisura=W&update=5&size=120
```
💡 Tip: It is easier to configure the card using YAML mode instead of the visual editor.


### Example Home Assistant Configuration
```
cards:
  - type: iframe
    url: "/local/hahigh_gauge.html?sensor=sensor.power_usage&max=5000&title=Power%20Consumption&umisura=W&update=5&size=120"
    aspect_ratio: 16:9
```

### Dependencies

This page requires:

- Highcharts 14.1 (loaded from CDN)
- Home Assistant API Access (requires an API token)
- Licensing Considerations
- Highcharts is a commercial charting library. Users must comply with its licensing terms.
- Home Assistant follows the Apache 2.0 License.
  
### Disclaimer

This web page is provided as-is. Future versions of Home Assistant, Highcharts, or InfluxDB may impact its functionality. Users should test thoroughly before deploying in a production environment.
