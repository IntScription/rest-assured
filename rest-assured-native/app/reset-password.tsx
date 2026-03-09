import { useEffect } from "react";
import { useRouter } from "expo-router";

export default function ResetPasswordEntry() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/(auth)/reset-password");
  }, [router]);

  return null;
}
