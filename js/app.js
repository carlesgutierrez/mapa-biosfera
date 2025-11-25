/**
 * Lógica principal de la aplicación
 */

// --- Variables Globales ---
let map;
let group; // FeatureGroup para ajustar el zoom
let sharedClusterGroup; // Grupo de clusters compartido
let layerGroups = {}; // Almacén de capas para filtrado
let capasCargadas = 0;
const totalCapas = CONFIG.layers.length;

// --- Inicialización ---
document.addEventListener('DOMContentLoaded', () => {
    initMap();
    initUI();
    initLegend();
    loadLayers();
});

// --- Inicialización del Mapa ---
function initMap() {
    map = L.map('map').setView(CONFIG.map.center, CONFIG.map.zoom);

    // Configurar capas base dinámicamente desde CONFIG
    const baseLayers = {};
    
    Object.entries(CONFIG.map.tileLayers).forEach(([key, layerConfig]) => {
        // Crear nombre legible (ej: 'standard' -> 'Standard')
        const layerName = key.charAt(0).toUpperCase() + key.slice(1);
        
        const tileLayer = L.tileLayer(layerConfig.url, {
            attribution: layerConfig.attribution
        });
        
        baseLayers[layerName] = tileLayer;

        // Añadir capa por defecto
        if (key === CONFIG.map.defaultLayer) {
            tileLayer.addTo(map);
        }
    });

    // Control de capas
    L.control.layers(baseLayers).addTo(map);

    // Grupo para ajustar límites
    group = new L.FeatureGroup();

    // Inicializar grupo de clusters compartido
    sharedClusterGroup = L.markerClusterGroup();
    map.addLayer(sharedClusterGroup);
}

// --- Inicialización de UI ---
function initUI() {
    // Panel Lateral
    const closePanelBtn = document.getElementById('close-panel-btn');
    const mapOverlay = document.getElementById('map-overlay');
    
    if (closePanelBtn) closePanelBtn.addEventListener('click', closeInfoPanel);
    if (mapOverlay) mapOverlay.addEventListener('click', closeInfoPanel);

    // Botón de Contraste
    const contrastBtn = document.getElementById('contrast-btn');
    if (contrastBtn) {
        contrastBtn.addEventListener('click', toggleContrastMode);
    }
}

function toggleContrastMode() {
    document.body.classList.toggle('high-contrast');
    const btn = document.getElementById('contrast-btn');
    if (btn) btn.classList.toggle('active');
}

function closeInfoPanel() {
    const infoPanel = document.getElementById('info-panel');
    const mapOverlay = document.getElementById('map-overlay');
    infoPanel.classList.remove('visible');
    mapOverlay.classList.remove('visible');
}

// --- Lógica de Leyenda y Filtrado ---
function initLegend() {
    const legendItems = {
        'actividades': document.getElementById('legend-actividades'),
        'productores': document.getElementById('legend-productores')
    };

    Object.entries(legendItems).forEach(([key, element]) => {
        if (element) {
            // Estado inicial activo
            element.classList.add('active');
            
            element.addEventListener('click', () => {
                toggleLayer(key, element);
            });
        }
    });
}

function toggleLayer(type, element) {
    const layer = layerGroups[type];
    if (!layer) return;

    const isActive = element.classList.contains('active');

    if (isActive) {
        // Desactivar
        element.classList.remove('active');
        element.classList.add('inactive');
        sharedClusterGroup.removeLayer(layer);
    } else {
        // Activar
        element.classList.remove('inactive');
        element.classList.add('active');
        sharedClusterGroup.addLayer(layer);
    }
}

// --- Carga de Capas ---
function loadLayers() {
    CONFIG.layers.forEach(layerConfig => {
        if (layerConfig.type === 'municipios') {
            loadMunicipios(layerConfig);
        } else if (layerConfig.type === 'puntos') {
            loadPuntos(layerConfig);
        }
    });
}

function verificarCargaCompleta() {
    capasCargadas++;
    if (capasCargadas === totalCapas) {
        if (group.getLayers().length > 0) {
            map.fitBounds(group.getBounds(), { padding: [50, 50] });
        }
    }
}

// --- Lógica de Municipios ---
function loadMunicipios(layerConfig) {
    omnivore.kml(layerConfig.url)
        .on('ready', function() {
            this.eachLayer(function(layer) {
                layer.setStyle(CONFIG.styles.municipios);
                if (layer.feature.properties.name) {
                    // Tooltip original (hover)
                    layer.bindTooltip(layer.feature.properties.name, {
                        permanent: false,
                        direction: 'center',
                        className: 'municipio-tooltip'
                    });
                    
                    // Popup al hacer click (si está habilitado en config)
                    if (CONFIG.enableMunicipalityPopups) {
                        layer.on('click', function(e) {
                            L.popup()
                                .setLatLng(e.latlng)
                                .setContent(`<b>${layer.feature.properties.name}</b>`)
                                .openOn(map);
                        });
                    }
                }
                group.addLayer(layer);
            });
            verificarCargaCompleta();
        })
        .on('error', function(error) {
            console.error(`Error al cargar ${layerConfig.url}:`, error);
            verificarCargaCompleta();
        })
        .addTo(map);
}

// --- Lógica de Puntos (Productores y Actividades) ---
async function loadPuntos(layerConfig) {
    const { styles, styleMaps } = await parseKmlStyles(layerConfig.url);
    // Usamos el grupo compartido en lugar de crear uno nuevo
    // const clusterGroup = L.markerClusterGroup();

    const customLayer = L.geoJson(null, {
        onEachFeature: (feature, layer) => {
            // Resolver icono
            let styleUrl = feature.properties.styleUrl;
            if (styleMaps.has(styleUrl)) {
                styleUrl = styleMaps.get(styleUrl);
            }
            const iconPath = styles.get(styleUrl);
            if (iconPath) {
                feature.properties.iconUrl = iconPath;
            }
            
            // Evento Click
            layer.on('click', () => displayFeatureInfo(feature, layerConfig.folder));
        },
        pointToLayer: (feature, latlng) => {
            let styleUrl = feature.properties.styleUrl;
            if (styleMaps.has(styleUrl)) {
                styleUrl = styleMaps.get(styleUrl);
            }
            const iconPath = styles.get(styleUrl);
            
            let finalIconUrl = `${layerConfig.folder}/iconoDoc.png`; // Fallback
            if (iconPath) {
                finalIconUrl = `${layerConfig.folder}/${iconPath}`;
            }

            return L.marker(latlng, {
                icon: L.icon({
                    iconUrl: finalIconUrl,
                    iconSize: CONFIG.icons.size,
                    iconAnchor: CONFIG.icons.anchor,
                    popupAnchor: CONFIG.icons.popupAnchor
                })
            });
        }
    });

    omnivore.kml(layerConfig.url, null, customLayer)
        .on('ready', function() {
            // Guardar referencia para filtrado
            // Asumimos que layerConfig.folder coincide con las claves 'actividades' o 'productores'
            // O usamos layerConfig.name normalizado
            const key = layerConfig.folder; // 'actividades' o 'productores'
            layerGroups[key] = this;

            sharedClusterGroup.addLayer(this); // Añadir al grupo compartido
            
            this.eachLayer(layer => group.addLayer(layer));
            verificarCargaCompleta();
        })
        .on('error', function(error) {
            console.error(`Error al cargar ${layerConfig.url}:`, error);
            verificarCargaCompleta();
        });
}

// --- Parsing de Estilos KML ---
async function parseKmlStyles(url) {
    try {
        const response = await fetch(url);
        const kmlText = await response.text();
        const parser = new DOMParser();
        const kmlDoc = parser.parseFromString(kmlText, 'application/xml');
        
        const styles = new Map();
        const styleMaps = new Map();

        // Parsear StyleMap
        kmlDoc.querySelectorAll('StyleMap').forEach(styleMap => {
            const id = styleMap.getAttribute('id');
            let normalStyleUrl = null;
            styleMap.querySelectorAll('Pair').forEach(pair => {
                const key = pair.querySelector('key');
                if (key && key.textContent.trim() === 'normal') {
                    normalStyleUrl = pair.querySelector('styleUrl');
                }
            });
            if (id && normalStyleUrl) {
                styleMaps.set(`#${id}`, normalStyleUrl.textContent.trim());
            }
        });

        // Parsear Style
        kmlDoc.querySelectorAll('Style').forEach(style => {
            const id = style.getAttribute('id');
            const iconHref = style.querySelector('Icon > href');
            if (id && iconHref) {
                styles.set(`#${id}`, iconHref.textContent.trim());
            }
        });

        return { styles, styleMaps };
    } catch (e) {
        console.error("Error parsing KML styles:", e);
        return { styles: new Map(), styleMaps: new Map() };
    }
}

// --- Mostrar Información en Panel ---
function displayFeatureInfo(feature, carpetaBase) {
    const properties = feature.properties;
    const name = properties.name || 'Sin título';
    const infoPanel = document.getElementById('info-panel');
    const panelTitle = document.getElementById('panel-title');
    const panelContent = document.getElementById('panel-content');
    const mapOverlay = document.getElementById('map-overlay');

    // Icono
    let iconHtml = '';
    if (properties.iconUrl) {
        const iconPath = `${carpetaBase}/${properties.iconUrl}`;
        iconHtml = `<img src="${iconPath}" class="popup-icon" onerror="this.style.display='none'">`;
    }

    // Detalles
    let detailsHtml = '';
    const details = Object.entries(properties)
        .filter(([key, value]) => value && !CONFIG.excludedDataFields.includes(key.toLowerCase()))
        .map(([key, value]) => {
            let displayValue = value;
            if (typeof value === 'string' && (value.startsWith('http://') || value.startsWith('https://'))) {
                displayValue = `<a href="${value}" target="_blank" rel="noopener noreferrer">${value}</a>`;
            }
            return `<tr><td>${key}</td><td>${displayValue}</td></tr>`;
        })
        .join('');
    
    if (details) {
        detailsHtml = `<table class="popup-details-table">${details}</table>`;
    }

    // Navegación
    let navLinkHtml = '';
    if (properties.gx_media_links) {
        navLinkHtml = `<a href="${properties.gx_media_links}" class="popup-nav-link" target="_blank" rel="noopener noreferrer">📍 Cómo llegar</a>`;
    }

    // Render
    const panelBody = `
        ${detailsHtml}
        ${navLinkHtml}`;
    
    panelTitle.textContent = name;
    panelContent.innerHTML = panelBody;
    
    // Gestionar icono en título
    const oldIcon = panelTitle.parentElement.querySelector('.popup-icon');
    if (oldIcon) oldIcon.remove();
    if (iconHtml) panelTitle.insertAdjacentHTML('afterend', iconHtml);

    // Mostrar
    infoPanel.classList.add('visible');
    mapOverlay.classList.add('visible');
}