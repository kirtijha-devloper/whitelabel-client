import { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";

export const useServiceSettingsPolling = (enabled = true, intervalMs = 5000, onHashChange) => {
  const queryClient = useQueryClient();
  const lastHashRef = useRef(null);

  useEffect(() => {
    if (!enabled) return;

    let isMounted = true;

    const checkHash = async () => {
      try {
        if (!isMounted) return;

        if (lastHashRef.current && hash && hash !== lastHashRef.current) {
          queryClient.invalidateQueries({ queryKey: ["admin-service-settings"] });
          queryClient.invalidateQueries({ queryKey: ["masterServiceSettings"] });
          queryClient.invalidateQueries({ queryKey: ["posSettings"] });
          queryClient.invalidateQueries({ queryKey: ["currentUser"] });
          queryClient.invalidateQueries({ queryKey: ["allUsers"] });
          queryClient.invalidateQueries({ queryKey: ["allUsersListForPosSetting"] });
          if (typeof onHashChange === "function") {
            onHashChange(hash, lastHashRef.current);
          }
        }
      } catch (err) {
        // Silent catch for hash check failures
      }
    };

    checkHash();
    const intervalId = setInterval(checkHash, intervalMs);

    return () => {
      isMounted = false;
      clearInterval(intervalId);
    };
  }, [enabled, intervalMs, queryClient, onHashChange]);
};
