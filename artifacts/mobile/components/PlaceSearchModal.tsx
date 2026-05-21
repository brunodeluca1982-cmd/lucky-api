/**
 * PlaceSearchModal — Google Places autocomplete sheet for adding
 * external places to the itinerary via "Busca manual".
 */

import React, { useRef } from "react";
import {
  ActivityIndicator,
  Alert,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { usePlaceSearch, type PlaceDetails, type PlacePrediction } from "@/hooks/usePlaceSearch";

const GOLD = "#1B4F72";
const CREAM = "#F5EDD6";

export interface SelectedPlace {
  place_id:          string;
  titulo:            string;
  localizacao:       string;
  lat:               number;
  lng:               number;
  google_maps_url:   string;
  isExternal:        true;
}

interface Props {
  visible:         boolean;
  onClose:         () => void;
  onSelectPlace:   (place: SelectedPlace) => void;
}

export function PlaceSearchModal({ visible, onClose, onSelectPlace }: Props) {
  const insets  = useSafeAreaInsets();
  const inputRef = useRef<TextInput>(null);
  const { query, setQuery, results, loading, error, fetchDetails, reset } = usePlaceSearch();

  function handleClose() {
    reset();
    Keyboard.dismiss();
    onClose();
  }

  async function handleSelect(prediction: PlacePrediction) {
    Keyboard.dismiss();
    const details: PlaceDetails | null = await fetchDetails(prediction.place_id);
    if (!details) {
      Alert.alert("Erro", "Não foi possível carregar os detalhes desse lugar. Tente novamente.");
      return;
    }
    const place: SelectedPlace = {
      place_id:        details.place_id,
      titulo:          details.name,
      localizacao:     details.formatted_address,
      lat:             details.lat,
      lng:             details.lng,
      google_maps_url: details.google_maps_url,
      isExternal:      true,
    };
    reset();
    onSelectPlace(place);
  }

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={handleClose}
      onShow={() => setTimeout(() => inputRef.current?.focus(), 120)}
    >
      <Pressable style={s.backdrop} onPress={handleClose} />

      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={s.sheetWrap}
      >
        <View style={[s.sheet, { paddingBottom: insets.bottom + 16 }]}>

          {/* ── Header ── */}
          <View style={s.header}>
            <View style={s.handle} />
            <View style={s.titleRow}>
              <Feather name="search" size={16} color={GOLD} />
              <Text style={s.title}>Buscar lugar</Text>
              <Pressable onPress={handleClose} hitSlop={12} style={s.closeBtn}>
                <Feather name="x" size={18} color="rgba(255,255,255,0.55)" />
              </Pressable>
            </View>
          </View>

          {/* ── Search input ── */}
          <View style={s.inputWrap}>
            <Feather name="map-pin" size={15} color="rgba(255,255,255,0.40)" style={s.inputIcon} />
            <TextInput
              ref={inputRef}
              style={s.input}
              value={query}
              onChangeText={setQuery}
              placeholder="Ex: Bar do Mineiro, Praia de Ipanema..."
              placeholderTextColor="rgba(255,255,255,0.30)"
              autoCorrect={false}
              returnKeyType="search"
              clearButtonMode="while-editing"
            />
            {loading && (
              <ActivityIndicator size="small" color={GOLD} style={s.inputSpinner} />
            )}
          </View>

          {/* ── Error ── */}
          {error ? (
            <View style={s.errorRow}>
              <Feather name="alert-circle" size={13} color="#E74C3C" />
              <Text style={s.errorText}>{error}</Text>
            </View>
          ) : null}

          {/* ── Results ── */}
          <ScrollView
            keyboardShouldPersistTaps="handled"
            style={s.results}
            contentContainerStyle={{ gap: 2 }}
          >
            {results.length === 0 && !loading && query.length > 1 ? (
              <View style={s.emptyState}>
                <Feather name="search" size={28} color="rgba(255,255,255,0.18)" />
                <Text style={s.emptyText}>Nenhum resultado encontrado.</Text>
                <Text style={s.emptyHint}>Tente um nome diferente ou mais específico.</Text>
              </View>
            ) : null}

            {results.length === 0 && !loading && query.length <= 1 ? (
              <View style={s.emptyState}>
                <Feather name="map" size={28} color="rgba(255,255,255,0.18)" />
                <Text style={s.emptyText}>Digite o nome de um lugar</Text>
                <Text style={s.emptyHint}>Restaurante, praia, museu, bar, hotel...</Text>
              </View>
            ) : null}

            {results.map((pred) => (
              <PredictionRow
                key={pred.place_id}
                prediction={pred}
                onPress={() => handleSelect(pred)}
              />
            ))}
          </ScrollView>

        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ── Prediction row ────────────────────────────────────────────────────────────

function PredictionRow({
  prediction,
  onPress,
}: {
  prediction: PlacePrediction;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [p.row, pressed && { backgroundColor: "rgba(27,79,114,0.10)" }]}
    >
      <View style={p.iconWrap}>
        <Feather name="map-pin" size={14} color={GOLD} />
      </View>
      <View style={p.texts}>
        <Text style={p.main} numberOfLines={1}>{prediction.main_text}</Text>
        {prediction.secondary_text ? (
          <Text style={p.secondary} numberOfLines={1}>{prediction.secondary_text}</Text>
        ) : null}
      </View>
      <Feather name="plus-circle" size={16} color="rgba(27,79,114,0.55)" />
    </Pressable>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.55)",
  },
  sheetWrap: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
  },
  sheet: {
    backgroundColor: "#1A1208",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderTopWidth: 1,
    borderColor: "rgba(27,79,114,0.18)",
    maxHeight: "85%",
  },
  header: {
    alignItems: "center",
    paddingTop: 12,
    paddingBottom: 4,
    paddingHorizontal: 20,
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: "rgba(255,255,255,0.20)",
    marginBottom: 16,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    width: "100%",
    marginBottom: 16,
  },
  title: {
    flex: 1,
    fontFamily: "Inter_600SemiBold",
    fontSize: 16,
    color: CREAM,
    letterSpacing: 0.2,
  },
  closeBtn: {
    padding: 4,
  },
  inputWrap: {
    flexDirection: "row",
    alignItems: "center",
    marginHorizontal: 20,
    marginBottom: 12,
    backgroundColor: "rgba(255,255,255,0.07)",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.14)",
    paddingHorizontal: 12,
    height: 48,
  },
  inputIcon: {
    marginRight: 8,
  },
  input: {
    flex: 1,
    fontFamily: "Inter_400Regular",
    fontSize: 15,
    color: CREAM,
    height: "100%",
  },
  inputSpinner: {
    marginLeft: 8,
  },
  errorRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginHorizontal: 20,
    marginBottom: 8,
  },
  errorText: {
    fontFamily: "Inter_400Regular",
    fontSize: 12,
    color: "#E74C3C",
  },
  results: {
    maxHeight: 360,
    paddingHorizontal: 12,
  },
  emptyState: {
    alignItems: "center",
    paddingVertical: 36,
    gap: 8,
  },
  emptyText: {
    fontFamily: "Inter_500Medium",
    fontSize: 14,
    color: "rgba(255,255,255,0.38)",
  },
  emptyHint: {
    fontFamily: "Inter_400Regular",
    fontSize: 12,
    color: "rgba(255,255,255,0.22)",
  },
});

const p = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 8,
    paddingVertical: 13,
    borderRadius: 12,
  },
  iconWrap: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: `${GOLD}18`,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  texts: {
    flex: 1,
    gap: 2,
  },
  main: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 14,
    color: CREAM,
  },
  secondary: {
    fontFamily: "Inter_400Regular",
    fontSize: 12,
    color: "rgba(255,255,255,0.45)",
  },
});
