import { ChangeEvent, DragEvent, FormEvent, useMemo, useState } from 'react';

type UploadRecord = {
  id: string;
  fileName: string;
  uploadedAtUtc: string;
};

type Locale = 'en' | 'de';

type TranslationKey =
  | 'title'
  | 'subtitle'
  | 'maxFileSize'
  | 'dropzoneText'
  | 'fileInputAriaLabel'
  | 'uploadButton'
  | 'historyButton'
  | 'defaultMessage'
  | 'readyMessage'
  | 'historyLoadError'
  | 'uploadFailedPrefix'
  | 'uploadSuccess'
  | 'invalidExtension'
  | 'invalidSize'
  | 'languageLabel'
  | 'languageEnglish'
  | 'languageGerman';

const apiBaseUrl = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080').trim();
const maxFileSizeInBytes = 20 * 1024 * 1024;

const translations: Record<Locale, Record<TranslationKey, string>> = {
  en: {
    title: 'Football Metrics – TCX Upload',
    subtitle: 'Manual upload for amateur football metrics.',
    maxFileSize: 'Maximum file size: 20 MB.',
    dropzoneText: 'Drag & drop a TCX file here or choose one.',
    fileInputAriaLabel: 'Select TCX file',
    uploadButton: 'Upload',
    historyButton: 'Load upload history',
    defaultMessage: 'No file uploaded yet.',
    readyMessage: 'Ready to upload: {fileName}.',
    historyLoadError: 'Upload history could not be loaded.',
    uploadFailedPrefix: 'Upload failed:',
    uploadSuccess: 'Upload successful: {fileName} at {uploadTime}.',
    invalidExtension: 'Only .tcx files are allowed.',
    invalidSize: 'File is too large (max 20 MB).',
    languageLabel: 'Language',
    languageEnglish: 'English',
    languageGerman: 'German'
  },
  de: {
    title: 'Football Metrics – TCX Upload',
    subtitle: 'Manueller Upload für Amateur-Fußballmetriken.',
    maxFileSize: 'Maximale Dateigröße: 20 MB.',
    dropzoneText: 'Ziehe eine TCX-Datei hierher oder wähle eine aus.',
    fileInputAriaLabel: 'TCX-Datei auswählen',
    uploadButton: 'Hochladen',
    historyButton: 'Upload-Historie laden',
    defaultMessage: 'Noch keine Datei hochgeladen.',
    readyMessage: 'Bereit zum Hochladen: {fileName}.',
    historyLoadError: 'Upload-Historie konnte nicht geladen werden.',
    uploadFailedPrefix: 'Upload fehlgeschlagen:',
    uploadSuccess: 'Upload erfolgreich: {fileName} um {uploadTime}.',
    invalidExtension: 'Nur .tcx-Dateien sind erlaubt.',
    invalidSize: 'Datei ist zu groß (max. 20 MB).',
    languageLabel: 'Sprache',
    languageEnglish: 'Englisch',
    languageGerman: 'Deutsch'
  }
};

function resolveInitialLocale(): Locale {
  if (typeof navigator === 'undefined') {
    return 'en';
  }

  return navigator.language.toLowerCase().startsWith('de') ? 'de' : 'en';
}

function formatLocalDateTime(dateText: string): string {
  return new Date(dateText).toLocaleString();
}

function interpolate(template: string, values: Record<string, string>): string {
  return Object.entries(values).reduce(
    (result, [key, value]) => result.replaceAll(`{${key}}`, value),
    template
  );
}

function getFileValidationMessage(file: File | null, locale: Locale): string | null {
  if (!file) {
    return null;
  }

  if (!file.name.toLowerCase().endsWith('.tcx')) {
    return translations[locale].invalidExtension;
  }

  if (file.size > maxFileSizeInBytes) {
    return translations[locale].invalidSize;
  }

  return null;
}

export function App() {
  const [locale, setLocale] = useState<Locale>(resolveInitialLocale);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [message, setMessage] = useState<string>(translations[resolveInitialLocale()].defaultMessage);
  const [uploads, setUploads] = useState<UploadRecord[]>([]);
  const [isDragOver, setIsDragOver] = useState(false);

  const t = translations[locale];
  const validationMessage = useMemo(() => getFileValidationMessage(selectedFile, locale), [selectedFile, locale]);
  const canSubmit = useMemo(() => !!selectedFile && !validationMessage, [selectedFile, validationMessage]);

  async function refreshUploads() {
    const response = await fetch(`${apiBaseUrl}/api/tcx`);
    if (!response.ok) {
      throw new Error(t.historyLoadError);
    }

    const payload = (await response.json()) as UploadRecord[];
    setUploads(payload);
  }

  function onLocaleChange(event: ChangeEvent<HTMLSelectElement>) {
    const nextLocale = event.target.value as Locale;
    setLocale(nextLocale);
    setMessage(translations[nextLocale].defaultMessage);
  }

  function handleFileSelection(file: File | null) {
    setSelectedFile(file);

    const fileError = getFileValidationMessage(file, locale);
    if (fileError) {
      setMessage(fileError);
      return;
    }

    if (file) {
      setMessage(interpolate(t.readyMessage, { fileName: file.name }));
    }
  }

  function onFileInputChange(event: ChangeEvent<HTMLInputElement>) {
    handleFileSelection(event.target.files?.[0] ?? null);
  }

  function onDrop(event: DragEvent<HTMLLabelElement>) {
    event.preventDefault();
    setIsDragOver(false);

    const droppedFile = event.dataTransfer.files?.[0] ?? null;
    handleFileSelection(droppedFile);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!selectedFile || validationMessage) {
      return;
    }

    const formData = new FormData();
    formData.append('file', selectedFile);

    const response = await fetch(`${apiBaseUrl}/api/tcx/upload`, {
      method: 'POST',
      body: formData
    });

    if (!response.ok) {
      const errorText = await response.text();
      setMessage(`${t.uploadFailedPrefix} ${errorText}`);
      return;
    }

    const payload = (await response.json()) as UploadRecord;
    const uploadTime = formatLocalDateTime(payload.uploadedAtUtc);
    setMessage(interpolate(t.uploadSuccess, { fileName: payload.fileName, uploadTime }));
    setSelectedFile(null);
    await refreshUploads();
  }

  return (
    <main className="container">
      <div className="language-switcher">
        <label htmlFor="language-selector">{t.languageLabel}</label>
        <select id="language-selector" value={locale} onChange={onLocaleChange}>
          <option value="en">{t.languageEnglish}</option>
          <option value="de">{t.languageGerman}</option>
        </select>
      </div>
      <h1>{t.title}</h1>
      <p className="subtitle">{t.subtitle}</p>
      <p className="subtitle">{t.maxFileSize}</p>
      <form onSubmit={handleSubmit}>
        <label
          className={`dropzone ${isDragOver ? 'dropzone--active' : ''}`}
          onDragOver={(event) => {
            event.preventDefault();
            setIsDragOver(true);
          }}
          onDragLeave={() => setIsDragOver(false)}
          onDrop={onDrop}
        >
          <span>{t.dropzoneText}</span>
          <input type="file" accept=".tcx" onChange={onFileInputChange} aria-label={t.fileInputAriaLabel} />
        </label>
        <button type="submit" disabled={!canSubmit}>
          {t.uploadButton}
        </button>
      </form>
      <button type="button" onClick={refreshUploads}>
        {t.historyButton}
      </button>
      <p>{validationMessage ?? message}</p>
      <ul>
        {uploads.map((upload) => (
          <li key={upload.id}>
            {upload.fileName} – {formatLocalDateTime(upload.uploadedAtUtc)}
          </li>
        ))}
      </ul>
    </main>
  );
}
