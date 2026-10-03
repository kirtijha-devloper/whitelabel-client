import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Loader2, X } from "lucide-react";
import { fetchUserLoginPopups } from "../api/loginPopupApi";
import {
  clearPendingLoginPopups,
  hasPendingLoginPopups,
} from "../utils/loginPopups";

const LoginPopupOverlay = ({ currentUser }) => {
  const [shouldShow, setShouldShow] = useState(() => hasPendingLoginPopups());
  const [activeIndex, setActiveIndex] = useState(0);

  const {
    data: loginPopups = [],
    isLoading,
    isError,
  } = useQuery({
    queryKey: ["active-login-popups"],
    queryFn: fetchUserLoginPopups,
    enabled: Boolean(currentUser?.id) && shouldShow,
    staleTime: 0,
    gcTime: 0,
    retry: 1,
  });

  useEffect(() => {
    if (!shouldShow) return;
    if (!currentUser?.id) return;
    if (isLoading) return;

    if (isError || loginPopups.length === 0) {
      clearPendingLoginPopups();
      setShouldShow(false);
      setActiveIndex(0);
    }
  }, [currentUser?.id, isError, isLoading, loginPopups.length, shouldShow]);

  useEffect(() => {
    if (!shouldShow) return;
    if (activeIndex < loginPopups.length) return;
    setActiveIndex(0);
  }, [activeIndex, loginPopups.length, shouldShow]);

  const activePopup = useMemo(() => loginPopups[activeIndex] || null, [activeIndex, loginPopups]);

  const closeSequence = () => {
    clearPendingLoginPopups();
    setShouldShow(false);
    setActiveIndex(0);
  };

  const handleCloseCurrent = () => {
    if (activeIndex < loginPopups.length - 1) {
      setActiveIndex((index) => index + 1);
      return;
    }

    closeSequence();
  };

  if (!shouldShow || !currentUser?.id) {
    return null;
  }

  if (isLoading) {
    return (
      <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/60 p-4">
        <div className="flex items-center gap-3 rounded-2xl bg-white px-5 py-4 text-gray-700 shadow-xl">
          <Loader2 className="h-5 w-5 animate-spin" />
          <span>Loading popup...</span>
        </div>
      </div>
    );
  }

  if (!activePopup) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/70 p-4">
      <div className="relative w-full max-w-3xl overflow-hidden rounded-3xl bg-white shadow-2xl">
        <button
          type="button"
          onClick={handleCloseCurrent}
          className="absolute right-4 top-4 z-10 inline-flex h-10 w-10 items-center justify-center rounded-full bg-white/95 text-gray-600 shadow-md transition hover:bg-white hover:text-gray-900"
          aria-label="Close popup"
        >
          <X className="h-5 w-5" />
        </button>

        <div className="flex items-center justify-center bg-slate-50 p-4 sm:p-6">
          <img
            src={activePopup.image_url}
            alt={activePopup.title || `Login popup ${activeIndex + 1}`}
            className="max-h-[75vh] w-full rounded-2xl object-contain"
          />
        </div>
      </div>
    </div>
  );
};

export default LoginPopupOverlay;
