const configuredApiUrl = process.env.REACT_APP_API_URL;
const API_URL = (configuredApiUrl || "http://localhost:8000").replace(/\/+$/, "");

export function apiUrl(path) {
    if (/^https?:\/\//i.test(path)) return path;
    return `${API_URL}${path.startsWith("/") ? "" : "/"}${path}`;
}

export function mediaUrl(path) {
    if (!path) return "";
    if (/^https?:\/\//i.test(path)) return path;
    return apiUrl(path.startsWith("/api/") ? path : `/api/files/${path}`);
}

export async function api(path, options = {}) {
    const headers = new Headers(options.headers || {});
    const isFormData = typeof FormData !== "undefined" && options.body instanceof FormData;
    if (options.body && !isFormData && !headers.has("Content-Type")) {
        headers.set("Content-Type", "application/json");
    }

    let response;
    try {
        response = await fetch(apiUrl(`/api${path.startsWith("/") ? path : `/${path}`}`), {
            ...options,
            credentials: "include",
            headers,
        });
    } catch (error) {
        throw new Error(
            `Could not reach the smolComp API at ${API_URL}. Check REACT_APP_API_URL and the backend status.`,
            { cause: error },
        );
    }

    const contentType = response.headers.get("content-type") || "";
    const payload = contentType.includes("application/json")
        ? await response.json()
        : await response.text();

    if (!response.ok) {
        const detail = payload && typeof payload === "object" ? payload.detail : "";
        throw new Error(detail || `Request failed (${response.status})`);
    }

    return payload;
}

export function formatPrice(value) {
    if (value == null || Number.isNaN(Number(value))) return "Not for sale";
    return new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: "USD",
        maximumFractionDigits: 2,
    }).format(Number(value));
}
