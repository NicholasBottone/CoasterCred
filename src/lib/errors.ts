export function getErrorMessage(error: unknown, fallback = "Something went wrong") {
  if (typeof error === "object" && error !== null) {
    const withData = error as { data?: unknown; message?: unknown };
    if (typeof withData.data === "string" && withData.data.trim()) {
      return withData.data;
    }
    if (
      typeof withData.data === "object" &&
      withData.data !== null &&
      "message" in withData.data &&
      typeof (withData.data as { message?: unknown }).message === "string"
    ) {
      return (withData.data as { message: string }).message;
    }
    if (typeof withData.message === "string" && withData.message.trim()) {
      return withData.message;
    }
  }

  return fallback;
}
