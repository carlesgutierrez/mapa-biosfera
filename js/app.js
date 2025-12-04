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
    initMobileGestures();
});

// --- Inicialización del Mapa ---
function initMap() {
    map = L.map('map', {
        zoomControl: false // Desactivamos el control de zoom por defecto
    }).setView(CONFIG.map.center, CONFIG.map.zoom);

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
    // L.control.layers(baseLayers).addTo(map);

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
        console.log('♻️ Clusters reagrupados (animationend)');
        checkSelectionVisibility();
    });

    // Asegurar comprobación al terminar zoom (por si animationend no salta o es insuficiente)
    map.on('zoomend', function() {
        checkSelectionVisibility();
    });

    // También cuando se cierra un spiderfy
    sharedClusterGroup.on('unspiderfied', function(e) {
        console.log('🕸️ Spiderfy cerrado (agrupado de nuevo)');
        // e.markers contiene los marcadores que se acaban de reagrupar (ocultar)
        if (selectedMarker && e.markers.includes(selectedMarker)) {
            clearSelection();
        }
    });

    function checkSelectionVisibility() {
        if (selectedMarker && sharedClusterGroup.hasLayer(selectedMarker)) {
            // Comprobamos quién es el "padre visible" del marcador seleccionado
            const visibleParent = sharedClusterGroup.getVisibleParent(selectedMarker);

            // Si visibleParent existe y NO es el marcador mismo, significa que está dentro de un cluster
            // Si visibleParent es null, puede estar fuera de pantalla (no limpiamos) o no añadido
            if (visibleParent && visibleParent !== selectedMarker) {
                // El marcador ha sido agrupado y ocultado
                console.log('🔒 Marcador seleccionado ha sido agrupado en un cluster - Limpiando selección');
                clearSelection();
            }
        }
    }

    map.addLayer(sharedClusterGroup);
    
    // Evento de zoom del mapa para cerrar panel si es zoom out significativo que agrupa cosas
    map.on('zoomend', function() {
        // ... (lógica ya implementada en initMap con lastZoom)
    });

    // Evento click en el mapa para deseleccionar
    map.on('click', onMapClick);
}

function onMapClick(e) {
    console.log('🗺️ Click en mapa detectado - Limpiando selección');
    closeInfoPanel();
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

    // Botón Reset Vista (Centrar Mapa)
    const resetViewBtn = document.getElementById('reset-view-btn');
    if (resetViewBtn) {
        resetViewBtn.addEventListener('click', () => resetMapView(1)); // Zoom extra por defecto
    }

    // Botones de Zoom Personalizados
    const zoomInBtn = document.getElementById('zoom-in-btn');
    const zoomOutBtn = document.getElementById('zoom-out-btn');
    if (zoomInBtn) {
        zoomInBtn.addEventListener('click', () => map.zoomIn());
    }
    if (zoomOutBtn) {
        zoomOutBtn.addEventListener('click', () => map.zoomOut());
    }

    // Botón Fullscreen (Nueva Pestaña)
    const fullscreenBtn = document.getElementById('fullscreen-toggle');
    if (fullscreenBtn) {
        fullscreenBtn.addEventListener('click', () => {
            // Abrir la misma URL en una nueva pestaña
            window.open(window.location.href, '_blank');
        });
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
    /*
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
    */
}

let hoverHalo = null; // Halo temporal para hover

function clearSelection(onlyHover = false) {
    if (onlyHover) {
        if (hoverHalo) {
            hoverHalo.remove();
            hoverHalo = null;
        }
        return;
    }

    if (selectedHalo) {
        selectedHalo.remove();
        selectedHalo = null;
    }
    if (hoverHalo) {
        hoverHalo.remove();
        hoverHalo = null;
    }
    
    // Restaurar marcador al cluster si estaba seleccionado
    if (selectedMarker) {
        // Ya no extraemos del cluster, así que solo limpiamos la referencia
        selectedMarker = null;
    }
}

function createHalo(latlng, isHover = false) {
    if (!isHover) {
        clearSelection(); // Limpiar todo si es selección fija
    } else {
        if (hoverHalo) hoverHalo.remove(); // Limpiar anterior hover
    }
    
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

    const haloMarker = L.marker(latlng, {
        icon: haloIcon,
        zIndexOffset: -1000, // Intentar ponerlo detrás
        interactive: false
    }).addTo(map);

    if (isHover) {
        hoverHalo = haloMarker;
    } else {
        selectedHalo = haloMarker;
    }
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

function resetMapView(zoomOffset = 0) {
    if (initialBounds) {
        // Ajustar bounds con padding
        map.fitBounds(initialBounds, { padding: [50, 50] });
        
        // Si hay offset de zoom, aplicarlo después del fitBounds
        if (zoomOffset !== 0) {
            // Usamos un timeout pequeño o el evento moveend para asegurar que fitBounds terminó
            // Pero fitBounds es asíncrono en animación.
            // Una forma más directa es calcular el zoom resultante y sumarle el offset.
            
            // Opción simple: setZoom después de un breve retardo o usar setView con el centro de bounds
            // map.setZoom(map.getBoundsZoom(initialBounds) + zoomOffset);
            
            // Mejor: fitBounds y luego zoomIn
            // Pero fitBounds ya ajusta el zoom.
            
            // Vamos a usar setView con el centro de los bounds y un zoom calculado manualmente
            const targetZoom = map.getBoundsZoom(initialBounds) + zoomOffset;
            map.setView(initialBounds.getCenter(), targetZoom, { animate: true });
        }
    } else {
        // Fallback a config inicial
        map.setView(CONFIG.map.center, CONFIG.map.zoom + zoomOffset, { animate: true });
    }
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
        if (!sharedClusterGroup.hasLayer(layer)) {
            sharedClusterGroup.addLayer(layer);
        }
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
            initialBounds = group.getBounds();
            // Usar la nueva función de reset para aplicar el zoom inicial con offset
            resetMapView(1); // Zoom extra inicial
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

                // Si ya hay uno seleccionado, restaurarlo al cluster
                if (selectedMarker && selectedMarker !== layer) {
                    clearSelection();
                }

                // Comprobar si es parte de un spiderfy (varios nodos conectados)
                const isSpiderfied = !!layer._spiderLeg;

                selectedMarker = layer;
                
                // Efecto visual selección
                createHalo(e.latlng);

                if (isSpiderfied) {
                    // Excepción: Si está spiderfied, NO movemos la cámara
                    // para evitar vibraciones o cierres inesperados.
                    console.log("Marker spiderfied: Manteniendo posición.");
                } else {
                    // Comportamiento normal: Mover cámara si es necesario
                    // Ya NO sacamos del cluster (sharedClusterGroup.removeLayer) para permitir
                    // que se agrupe naturalmente al hacer zoom out, y entonces limpiar la selección.

                    // Calcular centro ajustado
                    let targetLatLng = e.latlng;
                    let shouldMove = true;
                    
                    // Comprobar si estamos en modo escritorio (ancho > 600px)
                    if (window.innerWidth > 600) {
                        const targetZoom = Math.max(map.getZoom(), 16);
                        const point = map.project(e.latlng, targetZoom);
                        const newPoint = point.add([200, 0]); // Desplazar 200px a la derecha
                        targetLatLng = map.unproject(newPoint, targetZoom);
                        
                        // Evitar vibración: Si la distancia es muy pequeña, no mover
                        if (map.getCenter().distanceTo(targetLatLng) < 50) { // 50 metros umbral
                            shouldMove = false;
                        }
                        
                        if (shouldMove) {
                            map.flyTo(targetLatLng, targetZoom, { duration: 1.5 });
                        }
                    } else {
                        const targetZoom = Math.max(map.getZoom(), 16);
                        
                        // Evitar vibración en móvil también
                        if (map.getCenter().distanceTo(targetLatLng) < 50) {
                            shouldMove = false;
                        }

                        if (shouldMove) {
                            map.flyTo(targetLatLng, targetZoom, { duration: 1.5 });
                        }
                    }
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
                // Mostrar halo en hover si no es el seleccionado
                if (selectedMarker !== layer) {
                    createHalo(e.latlng, true); // true = isHover
                }
                
                // Mostrar tooltip con nombre
                if (feature.properties.name) {
                    layer.bindTooltip(feature.properties.name, {
                        permanent: false,
                        direction: 'top',
                        className: 'marker-hover-tooltip',
                        offset: [0, -40] // Ajustar para que salga encima del icono
                    }).openTooltip();
                }
            });

            layer.on('mouseout', (e) => {
                // Quitar halo de hover
                if (selectedMarker !== layer) {
                    clearSelection(true); // true = onlyHover
                }
                layer.closeTooltip();
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

    // Mapeo de claves a iconos
    const keyIcons = {
        'telefono': '📞',
        'teléfono': '📞',
        'email': '✉️',
        'correo': '✉️',
        'web': '🌐',
        'Google Maps': '🗺️',
        'dirección': '📍',
        'direccion': '📍',
        'horario': '🕒',
        'estado': '⚪',                // estado genérico
        'descripcion': '📝',           // descripción / nota
        'detalle': '📝',                // alias
        'info': '📝',                   // alias
        'persona referencia': '👤',    // persona / contacto
        'referencia': '👤',             // alias más corto
        'pueblo': '🏘️',                // pueblo / localidad
        'localidad': '🏘️',             // alias
        'red social': '📡',             // enlace a redes sociales
        'social': '📡'                  // alias alternativo
    };

    // Detalles
    let detailsHtml = '';
    const details = Object.entries(properties)
        .filter(([key, value]) => value && !CONFIG.excludedDataFields.includes(key.toLowerCase()))
        .map(([key, value]) => {
            let displayValue = value;
            let displayKey = key;

            // Formatear Teléfono
            if (key.toLowerCase().includes('telefono') || key.toLowerCase().includes('teléfono')) {
                // Limpiar caracteres no numéricos excepto +
                const cleanPhone = value.toString().replace(/[^\d+]/g, '');
                // Formatear visualmente (opcional, aquí solo aseguramos entero limpio)
                displayValue = `<a href="tel:${cleanPhone}" class="phone-link">${value}</a>`;
            }

            // Formatear Email
            if (key.toLowerCase().includes('email') || key.toLowerCase().includes('correo')) {
                // En móvil clickable, en escritorio texto (según petición: "En escritorio prefiero que no se haga nada")
                // Detectamos móvil con L.Browser.mobile
                if (L.Browser.mobile) {
                    displayValue = `<a href="mailto:${value}">${value}</a>`;
                } else {
                    displayValue = value;
                }
            }

            // Formatear Web
            if (typeof value === 'string' && (value.startsWith('http://') || value.startsWith('https://'))) {
                displayValue = `<a href="${value}" target="_blank" rel="noopener noreferrer">${value}</a>`;
            }

            // Iconos para claves
            // Normalizar clave para búsqueda (quitar acentos y minúsculas)
            const normalizedKey = key.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
            
            let icon = '';
            for (const [k, i] of Object.entries(keyIcons)) {
                // Normalizar también la clave del mapa
                const normalizedMapKey = k.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
                
                if (normalizedKey.includes(normalizedMapKey)) {
                    icon = `<span class="popup-key-icon">${i}</span>`;
                    break;
                }
            }
            
            // Si hay icono, ocultamos el texto de la clave o lo ponemos al lado?
            // "cambiar los conceptos por iconos" -> Solo icono
            if (icon) {
                displayKey = icon;
            } else {
                // Capitalizar primera letra si es texto
                displayKey = key.charAt(0).toUpperCase() + key.slice(1);
            }

            return `<tr><td>${displayKey}</td><td>${displayValue}</td></tr>`;
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

// --- Gestión de Gestos Móviles (Google Maps style) ---
function initMobileGestures() {
    // Solo aplicar en dispositivos móviles
    if (!L.Browser.mobile) return;

    const mapContainer = map.getContainer();
    const gestureOverlay = document.getElementById('gesture-overlay');

    // Deshabilitar interacciones de movimiento por defecto en móvil
    // Mantenemos touchZoom habilitado para permitir pinch sin necesidad de lógica compleja,
    // ya que pinch requiere 2 dedos de forma nativa y no interfiere con el scroll de 1 dedo.
    map.dragging.disable();
    map.touchZoom.enable();
    
    // Usamos capture: true para interceptar el evento antes que Leaflet
    // y habilitar el dragging si es necesario.
    mapContainer.addEventListener('touchstart', (e) => {
        if (e.touches.length > 1) {
            // Dos o más dedos: Habilitar mapa
            if (!map.dragging.enabled()) {
                map.dragging.enable();
                map.touchZoom.enable();
            }
            if (gestureOverlay) gestureOverlay.style.display = 'none';
        } else {
            // Un dedo: Asegurar deshabilitado para permitir scroll de página
            // PERO: Si estamos en escritorio (L.Browser.mobile es false), esto no debería ejecutarse.
            // La función tiene un guard al principio: if (!L.Browser.mobile) return;
            // Así que esto solo afecta a móviles.
            
            if (map.dragging.enabled()) {
                map.dragging.disable();
                map.touchZoom.disable();
            }
        }
    }, { capture: true, passive: true });

    mapContainer.addEventListener('touchmove', (e) => {
        // Si estamos moviendo con un dedo y el mapa está deshabilitado, mostramos overlay
        if (e.touches.length === 1 && !map.dragging.enabled()) {
            if (gestureOverlay && gestureOverlay.style.display !== 'flex') {
                gestureOverlay.style.display = 'flex';
            }
        } else {
             if (gestureOverlay) gestureOverlay.style.display = 'none';
        }
    }, { passive: true });

    mapContainer.addEventListener('touchend', (e) => {
        // Si no quedan dedos, ocultar overlay y resetear
        if (e.touches.length === 0) {
            if (gestureOverlay) gestureOverlay.style.display = 'none';
            map.dragging.disable();
            // No deshabilitar touchZoom al terminar, para que esté listo para el próximo gesto
            // map.touchZoom.disable();
        }
    });
}