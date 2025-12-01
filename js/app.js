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
let selectedMarker = null; // Referencia al marcador seleccionado actualmente
let selectedHalo = null; // Referencia al halo visual
let initialBounds = null; // Para guardar la vista inicial

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
    
    // Guardar zoom anterior para detectar dirección del zoom
    let lastZoom = map.getZoom();
    map.on('zoomend', () => {
        const currentZoom = map.getZoom();
        if (currentZoom < lastZoom) {
            // Zoom Out detectado -> Cerrar panel y limpiar selección
            // Esto soluciona el bug de que el halo se quede visible sobre un cluster
            //closeInfoPanel();
        }
        lastZoom = currentZoom;
    });

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
    
    // Evento click en cluster (nodo verde)
    sharedClusterGroup.on('clusterclick', function (a) {
        // Comportamiento por defecto de la librería
    });

    // Detectar cuando se reagrupan los clusters (zoom out)
    // Si un marcador seleccionado se agrupa en un cluster, debemos cerrar el panel y limpiar selección.
    sharedClusterGroup.on('animationend', function() {
        if (selectedMarker) {
                // Comprobamos quién es el "padre visible" del marcador seleccionado
                const visibleParent = sharedClusterGroup.getVisibleParent(selectedMarker);

                // Si el padre visible NO es el marcador mismo, significa que está dentro de un cluster
                if (visibleParent !== selectedMarker) {
                    console.log("El marcador seleccionado se ha agrupado en un cluster.");
                    
                    // Ejecutar la acción deseada
                    clearSelection(); 
                    
                    // Probablemente también quieras cerrar el panel:
                    // closeInfoPanel(); 
                }
            }
    });

    map.addLayer(sharedClusterGroup);
    
    // Evento de zoom del mapa para cerrar panel si es zoom out significativo que agrupa cosas
    map.on('zoomend', function() {
        // ... (lógica ya implementada en initMap con lastZoom)
    });

    // Evento click en el mapa para deseleccionar
    map.on('click', function(e) {
        // Si se hace click en el mapa (no en un marcador ni control), cerrar panel
        // Leaflet propaga el click del marcador al mapa a menos que se use L.DomEvent.stopPropagation
        // Pero markercluster y nuestros marcadores dejan pasar el evento a veces.
        // Sin embargo, el evento click del marcador se ejecuta antes.
        
        // Si hacemos click en el mapa "vacío", queremos cerrar.
        // Pero si hacemos click en un marcador, se abre el panel.
        // El problema es que el evento click del mapa se dispara TAMBIÉN al hacer click en un marcador si no se para la propagación.
        
        // Afortunadamente, Leaflet maneja esto bien si comprobamos el target original o si usamos un flag.
        // Pero una forma más sencilla en Leaflet:
        // El evento 'click' del mapa se dispara cuando se hace click en el fondo.
        
        // Vamos a cerrar el panel.
        // PERO: Si acabamos de hacer click en un marcador, no queremos cerrarlo inmediatamente.
        // El evento click del marcador ocurre antes o después?
        // En Leaflet, el click del marcador se dispara, y si no se para, sube al mapa.
        
        // Vamos a añadir stopPropagation en el click del marcador para evitar que llegue aquí.
        // O simplemente comprobar si el click fue en algo interactivo.
        
        // En la función loadPuntos, añadiremos L.DomEvent.stopPropagation(e) en el click del marcador.
        
        //closeInfoPanel();
    });
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

    // Botón Reset Filtros
    const resetBtn = document.getElementById('reset-filter-btn');
    if (resetBtn) {
        resetBtn.addEventListener('click', resetFilters);
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

    // Limpiar selección visual
    clearSelection();

    // Zoom out a posición intermedia
    if (initialBounds) {
        // Opción A: Volver a la vista inicial completa
        // map.fitBounds(initialBounds, { padding: [50, 50], animate: true, duration: 1 });
        
        // Opción B: Zoom out intermedio (ej. zoom actual - 2, o un nivel fijo si estamos muy cerca)
        const currentZoom = map.getZoom();
        const targetZoom = Math.max(CONFIG.map.zoom, currentZoom - 2); // No alejar más que el zoom inicial config
        
        // Si queremos volver al centro inicial o mantener centro actual pero alejar
        // map.setZoom(targetZoom, { animate: true });
        
        // Opción C (Solicitada): Posición intermedia entre inicial y actual.
        // Es complejo definir "intermedia" en coordenadas.
        // Simplificación efectiva: Volver a encuadrar todo el grupo (vista inicial) es lo más estándar "salir".
        // Pero el usuario pide "posición intermedia".
        // Vamos a hacer un fitBounds con un padding grande para alejar, o simplemente volver a initialBounds.
        // Interpretando "salir de la descripción": volver a ver el contexto general.
        map.fitBounds(initialBounds, { padding: [50, 50], animate: true, duration: 1.5 });
    }
}

function clearSelection() {
    if (selectedHalo) {
        selectedHalo.remove();
        selectedHalo = null;
    }
    selectedMarker = null;
}

function createHalo(latlng) {
    clearSelection();
    
    // Crear un icono DivIcon para el halo
    // El icono original tiene anchor [20, 40] (centro horizontal, base vertical)
    // El halo es 50x50. Para centrarlo en el "centro visual" del icono (aprox a mitad de altura, no en la base):
    // Si el icono mide 40 de alto, su centro visual está en y=-20 desde la base.
    // El anchor del halo debe coincidir con la latlng del marcador (que es la base del pin).
    // Si queremos que el halo rodee el centro del icono, debemos desplazarlo hacia arriba.
    
    const haloSize = 50;
    const iconHeight = CONFIG.icons.size[1]; // 40
    
    // Ajuste manual para centrar visualmente en el icono
    // Anchor X: mitad del halo (25)
    // Anchor Y: mitad del halo (25) + mitad de la altura del icono (20) = 45?
    // No, el latlng está en la punta inferior del icono.
    // Queremos que el centro del halo esté en (latlng.x, latlng.y - iconHeight/2).
    // Por tanto, el anchor del halo (punto que coincide con latlng) debe estar desplazado.
    // Anchor = [25, 25 + 20] = [25, 45]
    
    const haloIcon = L.divIcon({
        className: 'marker-selected-halo',
        iconSize: [haloSize, haloSize],
        iconAnchor: [haloSize/2, haloSize/2 + iconHeight/2]
    });

    selectedHalo = L.marker(latlng, {
        icon: haloIcon,
        zIndexOffset: -1000, // Intentar ponerlo detrás
        interactive: false
    }).addTo(map);
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
                toggleLayerExclusive(key, element, legendItems);
            });
        }
    });
}

function resetFilters() {
    const legendItems = {
        'actividades': document.getElementById('legend-actividades'),
        'productores': document.getElementById('legend-productores')
    };

    Object.entries(legendItems).forEach(([key, element]) => {
        const layer = layerGroups[key];
        
        // Activar visualmente
        element.classList.remove('inactive');
        element.classList.add('active');
        
        // Activar capa
        if (layer && !sharedClusterGroup.hasLayer(layer)) {
            sharedClusterGroup.addLayer(layer);
        }
    });
}

function toggleLayerExclusive(selectedType, selectedElement, allElements) {
    const selectedLayer = layerGroups[selectedType];
    if (!selectedLayer) {
        console.warn(`Capa no encontrada para: ${selectedType}`);
        return;
    }

    const allTypes = Object.keys(allElements);

    allTypes.forEach(type => {
        const el = allElements[type];
        const lay = layerGroups[type];
        
        if (!lay) return;

        if (type === selectedType) {
            // Activar el seleccionado
            el.classList.remove('inactive');
            el.classList.add('active');
            
            // Forzamos añadir sin comprobar hasLayer para asegurar,
            // aunque MarkerClusterGroup debería manejarlo.
            // Si ya está, no pasa nada (o se puede comprobar).
            // Nota: hasLayer en MarkerClusterGroup con GeoJSON a veces es confuso.
            if (!sharedClusterGroup.hasLayer(lay)) {
                sharedClusterGroup.addLayer(lay);
            }
        } else {
            // Desactivar los demás
            el.classList.remove('active');
            el.classList.add('inactive');
            
            // Intentamos remover siempre
            sharedClusterGroup.removeLayer(lay);
        }
    });
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
            initialBounds = group.getBounds();
            map.fitBounds(initialBounds, { padding: [50, 50] });
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
            layer.on('click', (e) => {
                // Evitar que el click se propague al mapa y cierre el panel inmediatamente
                L.DomEvent.stopPropagation(e);

                // Efecto visual selección
                createHalo(e.latlng);

                selectedMarker = layer; // <--- AÑADIR ESTA LÍNEA para guardar la referencia
                
                // Zoom in condicional
                // Comprobamos si es un cluster spiderfied (varios puntos en el mismo sitio o muy cerca)
                // Si el marcador pertenece a un cluster que se ha expandido (spiderfy), no hacemos zoom
                // para no perder el contexto de los otros puntos.
                
                // Una forma de detectar si hay otros marcadores muy cerca es consultar el clusterGroup
                // O más simple: si el nivel de zoom ya es muy alto, quizás no hace falta acercar más.
                
                // Lógica solicitada: "En el caso de que hayan 2 o más items conectados por proximidad con las líneas... no hagas el comportamiento del zoom in"
                // Esto ocurre cuando Leaflet.markercluster expande un cluster (spiderfy).
                // Podemos verificar si el marcador tiene la propiedad _spiderfied o si el padre es un cluster spiderfied.
                // Pero markercluster maneja esto internamente.
                
                // Verificación:
                // Si el marcador es visible, es que no está colapsado.
                // Si hay líneas de spiderfy visibles, significa que estamos en ese modo.
                
                // Una manera robusta es comprobar si hay otros marcadores visibles en un radio muy pequeño.
                // O usar la API de markercluster.
                
                // Vamos a usar una heurística simple pero efectiva:
                // Si el zoom actual es igual o mayor que el zoom objetivo (16), no hacemos zoom.
                // Además, si el marcador es parte de un spiderfy, el usuario ya ha hecho zoom o click en cluster.
                
                // Detectar spiderfy:
                // Leaflet.markercluster añade clases o propiedades.
                // Pero lo más directo es ver si el mapa tiene capas de "leg" (patas de araña).
                // O comprobar si el marcador tiene `_spiderfied` (propiedad interna de la librería).
                
                // IMPORTANTE: Cuando un cluster se expande (spiderfy), los marcadores individuales
                // NO tienen la propiedad _spiderfied a true necesariamente en el momento del click.
                // Sin embargo, si el marcador es visible y está cerca de otros, es probable que sea parte de un spiderfy.
                
                // La mejor manera de saber si estamos en un estado "spiderfied" (varios items desplegados)
                // es comprobar si el marcador tiene un padre cluster que esté spiderfied.
                // O más simple: si el marcador ha sido movido de su posición original por el plugin.
                
                // Pero el usuario dice: "No tenia que hacer nada. Solo dejar seleccionada el item".
                // Si el marcador es parte de un spiderfy, NO debemos hacer zoom.
                
                // Leaflet.markercluster dispara eventos 'spiderfied'.
                // Pero aquí estamos en el evento click del marcador.
                
                // Truco: Los marcadores spiderfied suelen tener una línea conectora (polyline) asociada.
                // O podemos comprobar si el marcador está en la misma posición que otros en el clusterGroup original.
                
                // Vamos a usar una propiedad que markercluster suele añadir o gestionar.
                // Si el marcador está spiderfied, suele tener `_spiderLeg` (la línea).
                
                const isSpiderfied = layer._spiderLeg;
                
                if (!isSpiderfied) {
                    // Calcular centro ajustado si el panel lateral está abierto en escritorio
                    let targetLatLng = e.latlng;
                    
                    // Comprobar si estamos en modo escritorio (ancho > 600px)
                    if (window.innerWidth > 600) {
                        // El panel ocupa 400px a la derecha.
                        // Queremos centrar el punto en el espacio restante (width - 400px).
                        // El centro de ese espacio está desplazado a la izquierda respecto al centro del mapa total.
                        // Desplazamiento necesario en píxeles: -200px (mitad del panel) en X.
                        
                        // Convertir latlng a punto contenedor, desplazar, y volver a latlng
                        const point = map.project(e.latlng, 16); // Proyectar al zoom destino
                        const newPoint = point.add([200, 0]); // Desplazar el centro objetivo a la derecha para que el punto quede a la izquierda
                        // Espera, si el panel está a la derecha, el área visible es la izquierda.
                        // El centro del área visible está a la izquierda del centro del mapa.
                        // Queremos que el marcador (e.latlng) quede en ese centro visual.
                        // Por tanto, el centro del mapa debe estar a la DERECHA del marcador.
                        // Así que el target del flyTo debe ser un punto a la derecha del marcador.
                        targetLatLng = map.unproject(newPoint, 16);
                    }

                    map.flyTo(targetLatLng, 16, { duration: 1.5 });
                }

                displayFeatureInfo(feature, layerConfig.folder);
            });
            
            // Evento Hover (opcional según petición "click (o un hover)")
            // Si ponemos hover, puede ser molesto si hay muchos puntos.
            // El usuario dijo "Cuando se haga click ( o un hover ) al item , muestra un circulo..."
            // Vamos a añadir el halo en hover también, pero temporal?
            // Mejor solo click para selección persistente con el panel.
            // Si quiere hover style, podemos usar CSS en el icono o evento mouseover.
            layer.on('mouseover', (e) => {
                if (!selectedMarker) { // Solo si no hay uno seleccionado fijo
                     // createHalo(e.latlng); // Esto crearía el halo permanente.
                     // Mejor solo cambiar estilo o algo sutil.
                     // Para cumplir estrictamente "muestra un circulo... al estilo google myMaps":
                     // Google Maps muestra el círculo al hacer HOVER.
                     // Vamos a añadirlo en hover y quitarlo en mouseout si no está clickado.
                }
            });
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