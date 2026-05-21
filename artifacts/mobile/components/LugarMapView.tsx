/**
 * LugarMapView — Simple map showing a single location pin
 *
 * Uses CartoDB Light tiles (same style as Onde Ficar map)
 * Shows a single marker for the lugar's location
 */

import React from "react";
import {
  Platform,
  StyleSheet,
  View,
  ActivityIndicator,
  Text,
  Pressable,
  Linking,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { Feather } from "@expo/vector-icons";

const PETROL = "#1B4F72";
const TEAL = "#4ECDC4";

type LugarMapProps = {
  lat: number;
  lng: number;
  nome: string;
  bairro?: string;
  googleMapsUrl?: string;
  style?: StyleProp<ViewStyle>;
  onClose?: () => void;
};

function buildLeafletHTML(lat: number, lng: number, nome: string): string {
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

    .lugar-marker {
      display: flex;
      flex-direction: column;
      align-items: center;
    }

    .lugar-pin {
      width: 36px;
      height: 36px;
      background: #1B4F72;
      border: 3px solid #FFFFFF;
      border-radius: 50% 50% 50% 0;
      transform: rotate(-45deg);
      box-shadow: 0 3px 10px rgba(0,0,0,0.3);
    }

    .lugar-pin-inner {
      width: 100%;
      height: 100%;
      display: flex;
      align-items: center;
      justify-content: center;
      transform: rotate(45deg);
      color: #FFFFFF;
      font-size: 16px;
    }

    .lugar-label {
      margin-top: 8px;
      font-family: -apple-system, 'Inter', sans-serif;
      font-size: 12px;
      font-weight: 600;
      color: #1B4F72;
      background: rgba(255,255,255,0.95);
      padding: 4px 10px;
      border-radius: 12px;
      white-space: nowrap;
      box-shadow: 0 2px 6px rgba(0,0,0,0.15);
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
  </style>
</head>
<body>
  <div id="map"></div>
  <script>
    var lat = ${lat};
    var lng = ${lng};
    var nome = ${JSON.stringify(nome)};

    var map = L.map('map', {
      center: [lat, lng],
      zoom: 15,
      zoomControl: true,
      attributionControl: true,
    });

    // CartoDB Light tiles (same as Onde Ficar)
    L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
      attribution: '&copy; CartoDB',
      maxZoom: 19,
    }).addTo(map);

    // Custom marker
    var icon = L.divIcon({
      className: 'lugar-marker',
      html: '<div class="lugar-pin"><div class="lugar-pin-inner">★</div></div><div class="lugar-label">' + nome + '</div>',
      iconAnchor: [18, 50],
      iconSize: null,
    });

    L.marker([lat, lng], { icon: icon }).addTo(map);
  </script>
</body>
</html>`;
}

// Web component
function LugarMapViewWeb({ lat, lng, nome, bairro, googleMapsUrl, style, onClose }: LugarMapProps) {
  const html = buildLeafletHTML(lat, lng, nome);

  return (
    <View style={[styles.container, style]}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>Localizacao</Text>
          {bairro && <Text style={styles.headerSubtitle}>{bairro}</Text>}
        </View>
        {onClose && (
          <Pressable style={styles.closeBtn} onPress={onClose}>
            <Feather name="x" size={20} color="#FFF" />
          </Pressable>
        )}
      </View>

      {/* Map */}
      <View style={styles.mapWrap}>
        {/* @ts-ignore */}
        <iframe
          srcDoc={html}
          style={{ width: "100%", height: "100%", border: "none", borderRadius: 12 }}
          title="Mapa do lugar"
        />
      </View>

      {/* Google Maps button */}
      {googleMapsUrl && (
        <Pressable style={styles.mapsBtn} onPress={() => Linking.openURL(googleMapsUrl)}>
          <Feather name="navigation" size={16} color="#FFF" />
          <Text style={styles.mapsBtnText}>Abrir no Google Maps</Text>
        </Pressable>
      )}
    </View>
  );
}

// Native component
function LugarMapViewNative({ lat, lng, nome, bairro, googleMapsUrl, style, onClose }: LugarMapProps) {
  const WebViewModule = require("react-native-webview");
  const WebView = WebViewModule.WebView;

  const html = buildLeafletHTML(lat, lng, nome);

  return (
    <View style={[styles.container, style]}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>Localizacao</Text>
          {bairro && <Text style={styles.headerSubtitle}>{bairro}</Text>}
        </View>
        {onClose && (
          <Pressable style={styles.closeBtn} onPress={onClose}>
            <Feather name="x" size={20} color="#FFF" />
          </Pressable>
        )}
      </View>

      {/* Map */}
      <View style={styles.mapWrap}>
        <WebView
          source={{ html }}
          style={styles.webview}
          scrollEnabled={false}
          originWhitelist={["*"]}
          javaScriptEnabled
        />
      </View>

      {/* Google Maps button */}
      {googleMapsUrl && (
        <Pressable style={styles.mapsBtn} onPress={() => Linking.openURL(googleMapsUrl)}>
          <Feather name="navigation" size={16} color="#FFF" />
          <Text style={styles.mapsBtnText}>Abrir no Google Maps</Text>
        </Pressable>
      )}
    </View>
  );
}

export default function LugarMapView(props: LugarMapProps) {
  if (Platform.OS === "web") {
    return <LugarMapViewWeb {...props} />;
  }
  return <LugarMapViewNative {...props} />;
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: "rgba(255,255,255,0.06)",
    borderRadius: 16,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.08)",
  },
  headerTitle: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 15,
    color: "#FFF",
  },
  headerSubtitle: {
    fontFamily: "Inter_400Regular",
    fontSize: 12,
    color: "rgba(255,255,255,0.6)",
    marginTop: 2,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "rgba(255,255,255,0.1)",
    alignItems: "center",
    justifyContent: "center",
  },
  mapWrap: {
    height: 200,
    backgroundColor: "#F8F8F8",
  },
  webview: {
    flex: 1,
    backgroundColor: "transparent",
  },
  mapsBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: PETROL,
    margin: 16,
    marginTop: 0,
    borderRadius: 12,
    paddingVertical: 14,
    gap: 8,
  },
  mapsBtnText: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 14,
    color: "#FFF",
  },
});
