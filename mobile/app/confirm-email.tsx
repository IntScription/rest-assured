import { useEffect } from "react";
import { useRouter } from "expo-router";

export default function ConfirmEmailEntry() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/(auth)/callback");
  }, [router]);

  return null;
}
