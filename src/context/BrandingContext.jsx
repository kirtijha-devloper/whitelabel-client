import React, { createContext, useContext, useEffect, useState, useCallback, useMemo } from 'react';
import { useLocation } from 'react-router-dom';
import { fetchCurrentBranding } from '../api/brandingApi';
import defaultPlatformLogo from '../assets/FORMAT-PNG.png';

const BrandingContext = createContext(null);

export const DEFAULT_BRANDING = {
  companyName: 'ABHEEPAY',
  companyLogoUrl: defaultPlatformLogo,
  faviconUrl: defaultPlatformLogo,
  domain: '',
  isDefault: true,
  isLoading: true,
  error: null,
};

const getMimeType = (url) => {
  if (!url) return 'image/png';
  const cleanUrl = url.split('?')[0].toLowerCase();
  if (cleanUrl.endsWith('.jpg') || cleanUrl.endsWith('.jpeg')) return 'image/jpeg';
  if (cleanUrl.endsWith('.svg')) return 'image/svg+xml';
  if (cleanUrl.endsWith('.webp')) return 'image/webp';
  if (cleanUrl.endsWith('.ico')) return 'image/x-icon';
  if (cleanUrl.endsWith('.gif')) return 'image/gif';
  return 'image/png';
};

export const applyFavicon = (iconUrl) => {
  if (typeof document === 'undefined' || !iconUrl) return;

  try {
    const mimeType = getMimeType(iconUrl);
    const resolvedHref = iconUrl.startsWith('data:') || iconUrl.startsWith('blob:')
      ? iconUrl
      : `${iconUrl}?v=${Date.now()}`;

    const rels = ['icon', 'shortcut icon', 'apple-touch-icon'];
    rels.forEach((rel) => {
      let link = document.querySelector(`link[rel='${rel}']`);
      if (!link) {
        link = document.createElement('link');
        link.rel = rel;
        document.head.appendChild(link);
      }
      link.id = 'icon';
      link.type = mimeType;
      link.href = resolvedHref;
    });
  } catch (domErr) {
    console.warn('[Branding] Could not update favicon:', domErr);
  }
};

export const applyDocumentTitle = (companyName) => {
  if (typeof document === 'undefined') return;
  const targetTitle = (companyName && String(companyName).trim()) || 'ABHEEPAY';
  if (document.title !== targetTitle) {
    document.title = targetTitle;
  }
};

export const BrandingProvider = ({ children }) => {
  const [branding, setBranding] = useState(DEFAULT_BRANDING);

  const loadBranding = useCallback(async (isMountedRef) => {
    try {
      const data = await fetchCurrentBranding();
      if (!isMountedRef.current) return;

      if (data) {
        const resolvedName = (data.companyName && String(data.companyName).trim()) || 'ABHEEPAY';
        const resolvedLogo = data.companyLogoUrl || defaultPlatformLogo;
        const resolvedFavicon = data.faviconUrl || data.companyLogoUrl || defaultPlatformLogo;

        setBranding({
          companyName: resolvedName,
          companyLogoUrl: resolvedLogo,
          faviconUrl: resolvedFavicon,
          domain: data.domain || '',
          isDefault: Boolean(data.isDefault),
          isLoading: false,
          error: null,
        });
      } else {
        setBranding((prev) => ({
          ...prev,
          isLoading: false,
          error: null,
        }));
      }
    } catch (err) {
      if (!isMountedRef.current) return;
      console.warn('[Branding] Could not fetch tenant branding, using platform fallback:', err?.message || err);
      setBranding((prev) => ({
        ...prev,
        isLoading: false,
        error: err?.message || 'Failed to load branding',
      }));
    }
  }, []);

  useEffect(() => {
    const isMountedRef = { current: true };
    loadBranding(isMountedRef);

    return () => {
      isMountedRef.current = false;
    };
  }, [loadBranding]);

  // Synchronize document title and browser favicon with resolved tenant branding
  useEffect(() => {
    const targetTitle = (branding.companyName && String(branding.companyName).trim()) || 'ABHEEPAY';
    applyDocumentTitle(targetTitle);

    const iconUrl = branding.faviconUrl || branding.companyLogoUrl || defaultPlatformLogo;
    applyFavicon(iconUrl);

    // MutationObserver guard: ensures no component, route, or script ever overrides the tab title
    // with page names (like "Admin Dashboard | ...", "List | ...", etc.)
    const titleEl = document.querySelector('title') || document.createElement('title');
    if (!titleEl.parentNode && document.head) {
      document.head.appendChild(titleEl);
    }

    const observer = new MutationObserver(() => {
      if (document.title !== targetTitle) {
        document.title = targetTitle;
      }
    });

    observer.observe(titleEl, { subtree: true, characterData: true, childList: true });

    return () => {
      observer.disconnect();
    };
  }, [branding.companyName, branding.faviconUrl, branding.companyLogoUrl]);

  const refreshBranding = useCallback(() => {
    const isMountedRef = { current: true };
    return loadBranding(isMountedRef);
  }, [loadBranding]);

  const contextValue = useMemo(() => ({
    branding,
    refreshBranding,
  }), [branding, refreshBranding]);

  return (
    <BrandingContext.Provider value={contextValue}>
      {children}
    </BrandingContext.Provider>
  );
};

/**
 * Route-change sync component that runs inside <Router> to continuously enforce
 * that document.title is strictly the company name only on any route transition.
 */
export const BrandingTitleSync = () => {
  const { branding } = useBranding();
  const location = useLocation();

  useEffect(() => {
    const targetTitle = (branding.companyName && String(branding.companyName).trim()) || 'ABHEEPAY';
    applyDocumentTitle(targetTitle);
  }, [branding.companyName, location.pathname, location.search]);

  return null;
};

export const useBranding = () => {
  const context = useContext(BrandingContext);
  if (!context) {
    return {
      branding: DEFAULT_BRANDING,
      refreshBranding: () => Promise.resolve(),
    };
  }
  return context;
};

export default BrandingContext;
