import { useEffect } from "react";
import { useRouter } from "expo-router";

export default function LoginCallbackEntry() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/(auth)/callback");
  }, [router]);

  return null;
}
