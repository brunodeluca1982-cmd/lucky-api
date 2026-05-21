/**
 * RioMapView — platform-aware interactive map.
 *
 * Web:    Leaflet.js in an <iframe> (Esri satellite tiles)
 * Native: WebView with Leaflet (Expo Go compatible)
 *
 * Props:
 *   bairros               — array of bairros with lat/lng from Supabase
 *   selectedBairroId      — id of currently selected bairro (or null)
 *   onBairroPress         — called with bairro when a marker is tapped
 *   loading               — shows loading state on map
 *   style                 — optional additional style for the container
 */

import React, { useEffect, useRef } from "react";
import {
  Platform,
  StyleSheet,
  View,
  ActivityIndicator,
  Text,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import type { Bairro } from "@/hooks/useBairros";

// ── Leaflet HTML generator ────────────────────────────────────────────────────

function buildLeafletHTML(
  bairros: Bairro[],
  selectedId: string | null,
): string {
  const bairrosJSON = JSON.stringify(
    bairros.map((b) => ({
      id: b.id,
      name: b.nome,
      lat: b.lat,
      lng: b.lng,
    })),
  );

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    html, body { width: 100%; height: 100%; background: #F8F8F8; }
    #map { width: 100%; height: 100%; }

    .neigh-marker {
      cursor: pointer;
      transition: transform 0.2s ease-out;
    }

    .neigh-pill {
      display: inline-block;
      font-family: -apple-system, 'Inter', sans-serif;
      font-size: 12px;
      font-weight: 500;
      color: #FFFFFF;
      white-space: nowrap;
      background: rgba(27, 79, 114, 0.85);
      border: 1px solid rgba(255,255,255,0.3);
      border-radius: 100px;
      padding: 6px 12px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.3);
      transition: all 0.2s ease-out;
    }
    .neigh-pill.selected {
      background: #F5F0E8;
      color: #1B4F72;
      border: 2px solid #1B4F72;
      font-weight: 600;
      box-shadow: 0 4px 12px rgba(0,0,0,0.4);
    }

    .leaflet-control-attribution {
      font-size: 8px;
      opacity: 0.5;
      background: rgba(255,255,255,0.8) !important;
    }
    .leaflet-control-zoom {
      border: none !important;
      box-shadow: 0 2px 6px rgba(0,0,0,0.15) !important;
    }
    .leaflet-bar a {
      background: #FFFFFF !important;
      color: #1B4F72 !important;
      border-color: rgba(0,0,0,0.1) !important;
    }
    .leaflet-bar a:hover {
      background: #F5F0E8 !important;
    }
  </style>
</head>
<body>
  <div id="map"></div>
  <script>
    var BAIRROS = ${bairrosJSON};
    var SELECTED_ID = ${JSON.stringify(selectedId)};

    // Fixed center for Rio de Janeiro
    var centerLat = -22.975;
    var centerLng = -43.21;

    var map = L.map('map', {
      center: [centerLat, centerLng],
      zoom: 11,
      zoomControl: true,
      attributionControl: true,
    });

    // Esri World Imagery — satellite style
    L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
      attribution: '&copy; Esri',
      maxZoom: 19,
    }).addTo(map);

    var markers = {};

    // Add bairro markers
    BAIRROS.forEach(function(b) {
      var isSelected = b.id === SELECTED_ID;
      var pillClass = 'neigh-pill' + (isSelected ? ' selected' : '');

      var icon = L.divIcon({
        className: 'neigh-marker',
        html: '<div class="' + pillClass + '">' + b.name + '</div>',
        iconAnchor: [40, 12],
        iconSize: null,
      });

      var marker = L.marker([b.lat, b.lng], { icon: icon });
      markers[b.id] = marker;

      marker.on('click', function(e) {
        L.DomEvent.stopPropagation(e);
        var msg = { type: 'bairroClick', bairro: b };
        if (typeof window.ReactNativeWebView !== 'undefined') {
          window.ReactNativeWebView.postMessage(JSON.stringify(msg));
        } else {
          window.parent.postMessage(msg, '*');
        }
      });

      marker.addTo(map);
    });

    // If a bairro is selected, fly to it
    if (SELECTED_ID) {
      var sel = BAIRROS.find(function(b) { return b.id === SELECTED_ID; });
      if (sel) {
        map.flyTo([sel.lat, sel.lng], 13, { duration: 0.5 });
      }
    }

    // Tap on map background — do nothing (don't deselect)
  </script>
</body>
</html>`;
}

// ── Props ─────────────────────────────────────────────────────────────────────

type MapProps = {
  bairros: Bairro[];
  selectedBairroId: string | null;
  onBairroPress: (bairro: Bairro | null) => void;
  loading?: boolean;
  style?: StyleProp<ViewStyle>;
};

// ── Web component ─────────────────────────────────────────────────────────────

function RioMapViewWeb({ bairros, selectedBairroId, onBairroPress, loading, style }: MapProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);

  const html = buildLeafletHTML(bairros, selectedBairroId);

  useEffect(() => {
    if (typeof window === "undefined") return;

    function handler(e: MessageEvent) {
      if (e.data && e.data.type === "bairroClick") {
        onBairroPress(e.data.bairro ?? null);
      }
    }
    window.addEventListener("message", handler);
    return () => window.removeEventListener("message", handler);
  }, [onBairroPress]);

  if (loading) {
    return (
      <View style={[s.container, s.loadingContainer, style]}>
        <ActivityIndicator size="small" color="#C4704A" />
        <Text style={s.loadingText}>Carregando mapa...</Text>
      </View>
    );
  }

  // @ts-ignore — <iframe> and srcDoc are web-only
  return (
    <View style={[s.container, style]}>
      <iframe
        key={selectedBairroId}
        ref={iframeRef as any}
        srcDoc={html}
        style={{ width: "100%", height: "100%", border: "none", background: "#12100E" } as any}
        title="Mapa de Bairros"
      />
    </View>
  );
}

// ── Native component ──────────────────────────────────────────────────────────

function RioMapViewNative({ bairros, selectedBairroId, onBairroPress, loading, style }: MapProps) {
  // Lazy load to avoid bundling WebView on web
  const WebViewModule = require("react-native-webview");
  const WebView = WebViewModule.WebView;

  const html = buildLeafletHTML(bairros, selectedBairroId);

  const handleMessage = (event: { nativeEvent: { data: string } }) => {
    try {
      const msg = JSON.parse(event.nativeEvent.data);
      if (msg.type === "bairroClick") {
        onBairroPress(msg.bairro ?? null);
      }
    } catch {}
  };

  if (loading) {
    return (
      <View style={[s.container, s.loadingContainer, style]}>
        <ActivityIndicator size="small" color="#C4704A" />
        <Text style={s.loadingText}>Carregando mapa...</Text>
      </View>
    );
  }

  return (
    <View style={[s.container, style]}>
      <WebView
        key={selectedBairroId}
        source={{ html }}
        style={s.webview}
        scrollEnabled={false}
        onMessage={handleMessage}
        originWhitelist={["*"]}
        javaScriptEnabled
      />
    </View>
  );
}

// ── Exported component ────────────────────────────────────────────────────────

export default function RioMapView(props: MapProps) {
  if (Platform.OS === "web") {
    return <RioMapViewWeb {...props} />;
  }
  return <RioMapViewNative {...props} />;
}

const s = StyleSheet.create({
  container: {
    flex: 1,
    overflow: "hidden",
    backgroundColor: "#12100E",
  },
  loadingContainer: {
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: {
    marginTop: 8,
    fontSize: 12,
    color: "rgba(255,255,255,0.5)",
  },
  webview: {
    flex: 1,
    backgroundColor: "transparent",
  },
});
