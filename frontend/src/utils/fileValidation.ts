export function getFileValidationMessage(
  file: File | null,
  options: { invalidExtensionMessage: string; invalidSizeMessage: string; maxFileSizeInBytes: number }
): string | null {
  if (!file) {
    return null;
  }

  if (!file.name.toLowerCase().endsWith('.tcx')) {
    return options.invalidExtensionMessage;
  }

  if (file.size > options.maxFileSizeInBytes) {
    return options.invalidSizeMessage;
  }

  return null;
}
