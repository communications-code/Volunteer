interface NativeSharePayload {
  title: string;
  text?: string;
  url: string;
}

export async function tryNativeShare({ title, text, url }: NativeSharePayload): Promise<boolean> {
  if (typeof navigator === "undefined" || typeof navigator.share !== "function") {
    return false;
  }

  try {
    await navigator.share({ title, text, url });
    return true;
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      return true;
    }
    return false;
  }
}
