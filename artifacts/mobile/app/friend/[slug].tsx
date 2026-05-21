// app/friend/[slug].tsx — Redirect para nova rota /amigo/[slug]
import { useEffect } from "react";
import { router, useLocalSearchParams } from "expo-router";

export default function FriendRedirect() {
  const { slug } = useLocalSearchParams<{ slug: string }>();

  useEffect(() => {
    if (slug) {
      router.replace(`/amigo/${slug}`);
    }
  }, [slug]);

  return null;
}
