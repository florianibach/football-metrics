import { ChangeEvent, DragEvent, FormEvent, useMemo, useState } from 'react';

type UploadRecord = {
  id: string;
  fileName: string;
  uploadedAtUtc: string;
};

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8080';
const maxFileSizeInBytes = 20 * 1024 * 1024;

function formatLocalDateTime(dateText: string): string {
  return new Date(dateText).toLocaleString();
}

function getFileValidationMessage(file: File | null): string | null {
  if (!file) {
    return null;
  }

  if (!file.name.toLowerCase().endsWith('.tcx')) {
    return 'Only .tcx files are allowed. / Nur .tcx-Dateien sind erlaubt.';
  }

  if (file.size > maxFileSizeInBytes) {
    return 'File is too large (max 20 MB). / Datei ist zu groß (max. 20 MB).';
  }

  return null;
}

export function App() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [message, setMessage] = useState<string>('No file uploaded yet. / Noch keine Datei hochgeladen.');
  const [uploads, setUploads] = useState<UploadRecord[]>([]);
  const [isDragOver, setIsDragOver] = useState(false);

  const validationMessage = useMemo(() => getFileValidationMessage(selectedFile), [selectedFile]);
  const canSubmit = useMemo(() => !!selectedFile && !validationMessage, [selectedFile, validationMessage]);

  async function refreshUploads() {
    const response = await fetch(`${apiBaseUrl}/api/tcx`);
    if (!response.ok) {
      throw new Error('Upload history could not be loaded. / Upload-Historie konnte nicht geladen werden.');
    }

    const payload = (await response.json()) as UploadRecord[];
    setUploads(payload);
  }

  function handleFileSelection(file: File | null) {
    setSelectedFile(file);

    const fileError = getFileValidationMessage(file);
    if (fileError) {
      setMessage(fileError);
      return;
    }

    if (file) {
      setMessage(`Ready to upload: ${file.name}. / Bereit zum Hochladen: ${file.name}.`);
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
      setMessage(`Upload failed: ${errorText} / Upload fehlgeschlagen: ${errorText}`);
      return;
    }

    const payload = (await response.json()) as UploadRecord;
    const uploadTime = formatLocalDateTime(payload.uploadedAtUtc);
    setMessage(`Upload successful: ${payload.fileName} at ${uploadTime}. / Upload erfolgreich: ${payload.fileName} um ${uploadTime}.`);
    setSelectedFile(null);
    await refreshUploads();
  }

  return (
    <main className="container">
      <h1>Football Metrics – TCX Upload</h1>
      <p className="subtitle">Manual upload for amateur football metrics. / Manueller Upload für Amateur-Fußballmetriken.</p>
      <p className="subtitle">Maximum file size: 20 MB. / Maximale Dateigröße: 20 MB.</p>
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
          <span>Drag & drop a TCX file here or choose one. / Ziehe eine TCX-Datei hierher oder wähle eine aus.</span>
          <input type="file" accept=".tcx" onChange={onFileInputChange} aria-label="Select TCX file / TCX-Datei auswählen" />
        </label>
        <button type="submit" disabled={!canSubmit}>
          Upload / Hochladen
        </button>
      </form>
      <button type="button" onClick={refreshUploads}>
        Load upload history / Upload-Historie laden
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
