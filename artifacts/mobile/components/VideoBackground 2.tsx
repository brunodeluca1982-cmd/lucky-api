/**
 * VideoBackground.tsx — Atmospheric fullscreen video background.
 *
 * Plays a single video (muted, looped, cover) behind all content.
 * If the video fails to load, falls back to the provided image pool
 * via the existing RotatingBackground component.
 *
 * Rules respected:
 * - muted, loop, cover always
 * - dark overlay rgba(0,0,0,0.45) on top
 * - no native controls
 * - graceful fallback to local images on error
 */

import React, { useState } from "react";
import { ImageSourcePropType, StyleSheet, View } from "react-native";
import { useVideoPlayer, VideoView } from "expo-video";
import { RotatingBackground } from "@/components/RotatingBackground";

interface Props {
  videoUrl: string;
  fallbackPool: ImageSourcePropType[];
}

export function VideoBackground({ videoUrl, fallbackPool }: Props) {
  const [hasError, setHasError] = useState(false);

  const player = useVideoPlayer(videoUrl, (p) => {
    p.loop   = true;
    p.muted  = true;
    p.play();
  });

  if (hasError) {
    return <RotatingBackground pool={fallbackPool} />;
  }

  return (
    <>
      <VideoView
        player={player}
        style={styles.fill}
        contentFit="cover"
        nativeControls={false}
        onError={() => setHasError(true)}
        pointerEvents="none"
      />
      <View style={styles.overlay} pointerEvents="none" />
    </>
  );
}

const styles = StyleSheet.create({
  fill: {
    ...StyleSheet.absoluteFillObject,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.45)",
  },
});
