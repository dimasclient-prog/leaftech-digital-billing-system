// Loads agency.logo_url and returns a copy with logo_url converted to a data URL,
// since jsPDF.addImage requires base64/data URLs (not arbitrary remote URLs).
export async function withLogoDataUrl<T extends Record<string, any>>(agency: T): Promise<T> {
  if (!agency?.logo_url) return agency;
  if (agency.logo_url.startsWith("data:")) return agency;
  try {
    const res = await fetch(agency.logo_url, { cache: "no-cache" });
    if (!res.ok) return { ...agency, logo_url: null };
    const blob = await res.blob();
    const dataUrl: string = await new Promise((resolve, reject) => {
      const r = new FileReader();
      r.onloadend = () => resolve(r.result as string);
      r.onerror = reject;
      r.readAsDataURL(blob);
    });
    return { ...agency, logo_url: dataUrl };
  } catch {
    return { ...agency, logo_url: null };
  }
}
