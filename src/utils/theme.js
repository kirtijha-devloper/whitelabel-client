import themeConfig from "../config/themes.json";

// 1. Yeh function decide karega ki kaunse 3 colors lagane hain
export const resolveThemeBundle = ({ apiTheme, currentUser, hostname } = {}) => {
    const bundles = themeConfig.bundles || {};

    // Agar future me API direct 3 colors ka object bhej de: { primary, dark, light }
    let parsedApiTheme = apiTheme;
    if (typeof apiTheme === "string" && apiTheme.trim().startsWith("{")) {
        try {
            parsedApiTheme = JSON.parse(apiTheme);
        } catch {
            parsedApiTheme = apiTheme;
        }
    }
    const defaultTheme = bundles[themeConfig.defaultBundle] || {
        primary: "#00D3CD",
        dark: "#111827",
        light: "#FFFFFF",
    };

    if (
        parsedApiTheme &&
        typeof parsedApiTheme === "object" &&
        (parsedApiTheme.primary || parsedApiTheme.dark || parsedApiTheme.light)
    ) {
        return {
            primary: parsedApiTheme.primary || defaultTheme.primary,
            dark: parsedApiTheme.dark || defaultTheme.dark,
            light: parsedApiTheme.light || defaultTheme.light,
        };
    }

    // Agar future me API sirf bundle ka naam bheje: "royal_blue"
    if (typeof apiTheme === "string" && bundles[apiTheme]) {
        return bundles[apiTheme];
    }

    // Abhi Dummy JSON me: Pehle currentUser ki company_id ya abheepay_id check karo
    // (Admin aur uske saare children me company_id same aata hai!)
    const companyId = currentUser?.company?.company_id ?? currentUser?.company_id;
    const userId = currentUser?.abheepay_id;

    const assignedKey =
        (companyId != null && themeConfig.companyThemes?.[String(companyId)]) ||
        (userId && themeConfig.companyThemes?.[String(userId)]) ||
        (hostname && themeConfig.domainThemes?.[hostname]) ||
        themeConfig.defaultBundle;

    return bundles[assignedKey] || bundles[themeConfig.defaultBundle];
};

// 2. Yeh function sirf un 3 colors ko browser ke CSS variables me daal deta hai
export const applyThemeBundle = (bundle) => {
    if (!bundle) return;
    const root = document.documentElement;
    if (bundle.primary) root.style.setProperty("--brand-primary", bundle.primary);
    if (bundle.dark) root.style.setProperty("--brand-dark", bundle.dark);
    if (bundle.light) root.style.setProperty("--brand-light", bundle.light);
};