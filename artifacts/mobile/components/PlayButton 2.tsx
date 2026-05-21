/**
 * PlayButton.tsx — Circular play button that opens fullscreen photo gallery modal.
 *
 * Positioned in top-right corner.
 * On tap: opens modal with horizontal FlatList of photos.
 * Manual swipe navigation + close button.
 */

import React, { useRef, useState } from "react";
import {
  Dimensions,
  FlatList,
  Image,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
  ViewToken,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");

type Props = {
  /** Array of photo URLs to display in gallery */
  photos: string[];
  /** Current photo index (to scroll to on open) */
  currentIndex?: number;
  /** Style overrides for the button container */
  style?: object;
};

export function PlayButton({ photos, currentIndex = 0, style }: Props) {
  const [visible, setVisible] = useState(false);
  const [activeIndex, setActiveIndex] = useState(currentIndex);
  const flatListRef = useRef<FlatList>(null);
  const insets = useSafeAreaInsets();

  function handleOpen() {
    setActiveIndex(currentIndex);
    setVisible(true);
    // Scroll to current index after modal opens
    setTimeout(() => {
      flatListRef.current?.scrollToIndex({
        index: currentIndex,
        animated: false,
      });
    }, 100);
  }

  function handleClose() {
    setVisible(false);
  }

  const onViewableItemsChanged = useRef(
    ({ viewableItems }: { viewableItems: ViewToken[] }) => {
      if (viewableItems.length > 0 && viewableItems[0].index != null) {
        setActiveIndex(viewableItems[0].index);
      }
    }
  ).current;

  const viewabilityConfig = useRef({
    itemVisiblePercentThreshold: 50,
  }).current;

  // Don't render if no photos
  if (!photos || photos.length === 0) return null;

  return (
    <>
      {/* Play Button */}
      <Pressable
        style={[styles.playButton, style]}
        onPress={handleOpen}
        hitSlop={8}
      >
        <View style={styles.playIconWrap}>
          <Feather name="play" size={14} color="rgba(255,255,255,0.9)" />
        </View>
      </Pressable>

      {/* Fullscreen Gallery Modal */}
      <Modal
        visible={visible}
        animationType="fade"
        transparent={false}
        statusBarTranslucent
        onRequestClose={handleClose}
      >
        <View style={styles.modalContainer}>
          {/* Photo Gallery */}
          <FlatList
            ref={flatListRef}
            data={photos}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            keyExtractor={(url, idx) => `${url}-${idx}`}
            onViewableItemsChanged={onViewableItemsChanged}
            viewabilityConfig={viewabilityConfig}
            getItemLayout={(_, index) => ({
              length: SCREEN_WIDTH,
              offset: SCREEN_WIDTH * index,
              index,
            })}
            initialScrollIndex={currentIndex}
            renderItem={({ item }) => (
              <View style={styles.photoContainer}>
                <Image
                  source={{ uri: item }}
                  style={styles.photo}
                  resizeMode="cover"
                />
              </View>
            )}
          />

          {/* Close Button */}
          <Pressable
            style={[styles.closeButton, { top: insets.top + 16 }]}
            onPress={handleClose}
            hitSlop={12}
          >
            <Feather name="x" size={22} color="rgba(255,255,255,0.9)" />
          </Pressable>

          {/* Photo Counter */}
          <View style={[styles.counter, { bottom: insets.bottom + 32 }]}>
            <Text style={styles.counterText}>
              {activeIndex + 1} / {photos.length}
            </Text>
          </View>

          {/* Pagination Dots */}
          <View style={[styles.pagination, { bottom: insets.bottom + 60 }]}>
            {photos.map((_, idx) => (
              <View
                key={idx}
                style={[
                  styles.dot,
                  idx === activeIndex && styles.dotActive,
                ]}
              />
            ))}
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  playButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(0,0,0,0.35)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.18)",
    alignItems: "center",
    justifyContent: "center",
  },
  playIconWrap: {
    marginLeft: 2, // Visual centering for play icon
  },

  modalContainer: {
    flex: 1,
    backgroundColor: "#000",
  },
  photoContainer: {
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT,
    justifyContent: "center",
    alignItems: "center",
  },
  photo: {
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT,
  },

  closeButton: {
    position: "absolute",
    left: 20,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "rgba(0,0,0,0.45)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.15)",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 10,
  },

  counter: {
    position: "absolute",
    alignSelf: "center",
    backgroundColor: "rgba(0,0,0,0.5)",
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 6,
  },
  counterText: {
    fontFamily: "Inter_500Medium",
    fontSize: 13,
    color: "rgba(255,255,255,0.8)",
    letterSpacing: 0.5,
  },

  pagination: {
    position: "absolute",
    alignSelf: "center",
    flexDirection: "row",
    gap: 6,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "rgba(255,255,255,0.3)",
  },
  dotActive: {
    backgroundColor: "rgba(255,255,255,0.9)",
    width: 18,
  },
});

export default PlayButton;
