import { useCallback, useEffect, useState } from "react";
import * as Haptics from "expo-haptics";

/**
 * Owns the rest-timer countdown: duration setting, seconds remaining, and
 * the interval that ticks it down. Extracted out of the exercise screen so
 * this piece of state/effect logic can be reasoned about (and tested) on
 * its own — the exercise screen still renders the countdown, this just
 * owns the ticking.
 */
export function useRestTimer(defaultDuration = 120) {
  const [restDuration, setRestDuration] = useState(defaultDuration);
  const [restSecondsLeft, setRestSecondsLeft] = useState(0);

  useEffect(() => {
    if (restSecondsLeft <= 0) return;

    const timer = setInterval(() => {
      setRestSecondsLeft((prev) => {
        if (prev <= 1) {
          void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [restSecondsLeft]);

  const startRest = useCallback(() => {
    setRestSecondsLeft(restDuration);
  }, [restDuration]);

  return { restDuration, setRestDuration, restSecondsLeft, startRest };
}
