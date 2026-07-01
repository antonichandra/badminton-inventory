const LOGO_PATH = "/images/courtly-mark.png";

let logoDataUrlPromise: Promise<string> | null = null;

export function loadCourtlyLogo(): Promise<string> {
  if (!logoDataUrlPromise) {
    logoDataUrlPromise = fetch(LOGO_PATH)
      .then((response) => {
        if (!response.ok) throw new Error("LOGO_LOAD_FAILED");
        return response.blob();
      })
      .then(
        (blob) =>
          new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result as string);
            reader.onerror = () => reject(new Error("LOGO_READ_FAILED"));
            reader.readAsDataURL(blob);
          }),
      );
  }
  return logoDataUrlPromise;
}
