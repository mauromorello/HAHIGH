import logging
import os
import shutil

from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant

_LOGGER = logging.getLogger(__name__)

DOMAIN = "hahigh"


async def async_setup(hass: HomeAssistant, config: dict):
    """Set up the integration via YAML (not used)."""
    return True


async def async_setup_entry(hass: HomeAssistant, config_entry: ConfigEntry):
    """Set up the integration from a config entry."""

    # Ensure the integration's directories exist
    html_path = hass.config.path("www", "community", "hahigh")
    os.makedirs(html_path, exist_ok=True)

    # Copy the necessary files to the appropriate directories
    await hass.async_add_executor_job(copy_html_files, hass)
    await hass.async_add_executor_job(copy_all_card_files, hass)

    # Registra il percorso statico per la nuova card
    _LOGGER.debug("Inizio registrazione della card hahigh-gauge-card...")
    
    try:
        hass.http.register_static_path(
            "/local/community/hahigh/hahigh-gauge-card.js",  # Percorso pubblico
            hass.config.path("www/community/hahigh/hahigh-gauge-card/hahigh-gauge-card.js"),  # Percorso fisico
        )
        _LOGGER.info("Percorso statico registrato: /local/community/hahigh/hahigh-gauge-card.js")
    except Exception as e:
        _LOGGER.error("Errore nella registrazione del percorso statico della card: %s", e)
    
    
        
    _LOGGER.info("HaHigh integration set up successfully.")

    

    return True


def copy_html_files(hass: HomeAssistant):
    """Copy HTML files to the main hahigh directory."""
    src_dir = hass.config.path("custom_components", DOMAIN, "web", "html")
    dst_dir = hass.config.path("www", "community", DOMAIN)

    try:
        for filename in os.listdir(src_dir):
            src_file = os.path.join(src_dir, filename)
            dst_file = os.path.join(dst_dir, filename)
            if os.path.isfile(src_file):
                shutil.copyfile(src_file, dst_file)
                _LOGGER.info("Copied HTML file %s to %s", filename, dst_file)
    except Exception as e:
        _LOGGER.error("Error copying HTML files: %s", e)


def copy_all_card_files(hass: HomeAssistant):
    """Copy JavaScript card files to their respective directories."""
    src_dir = hass.config.path("custom_components", DOMAIN, "web", "cards")

    try:
        for filename in os.listdir(src_dir):
            src_file = os.path.join(src_dir, filename)
            if os.path.isfile(src_file):
                # Extract the card name (e.g., hahigh-gauge-card.js -> hahigh-gauge-card)
                card_name = os.path.splitext(filename)[0]
                dst_dir = hass.config.path("www", "community", DOMAIN, card_name)
                os.makedirs(dst_dir, exist_ok=True)

                dst_file = os.path.join(dst_dir, filename)
                shutil.copyfile(src_file, dst_file)
                _LOGGER.info("Copied card file %s to %s", filename, dst_file)
    except Exception as e:
        _LOGGER.error("Error copying card files: %s", e)


async def async_unload_entry(hass: HomeAssistant, entry: ConfigEntry):
    """Unload the integration."""
    return True

