// app/friend/all.tsx — Redirect para nova rota /amigo/all
import { useEffect } from "react";
import { router } from "expo-router";

export default function FriendAllRedirect() {
  useEffect(() => {
    router.replace("/amigo/all");
  }, []);

  return null;
}
