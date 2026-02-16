import { FormEvent, useMemo, useState } from 'react';

type UploadRecord = {
  id: string;
  fileName: string;
  uploadedAtUtc: string;
};

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8080';

export function App() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [message, setMessage] = useState<string>('Noch keine Datei hochgeladen.');
  const [uploads, setUploads] = useState<UploadRecord[]>([]);

  const canSubmit = useMemo(() => !!selectedFile, [selectedFile]);

  async function refreshUploads() {
    const response = await fetch(`${apiBaseUrl}/api/tcx`);
    if (!response.ok) {
      throw new Error('Liste konnte nicht geladen werden.');
    }

    const payload = (await response.json()) as UploadRecord[];
    setUploads(payload);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!selectedFile) {
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
      setMessage(`Upload fehlgeschlagen: ${errorText}`);
      return;
    }

    setMessage(`Upload erfolgreich: ${selectedFile.name}`);
    setSelectedFile(null);
    await refreshUploads();
  }

  return (
    <main className="container">
      <h1>Football Metrics – TCX Upload</h1>
      <p className="subtitle">Initiales Setup für Amateur-Fußballmetriken.</p>
      <form onSubmit={handleSubmit}>
        <input
          type="file"
          accept=".tcx"
          onChange={(event) => setSelectedFile(event.target.files?.[0] ?? null)}
          aria-label="TCX-Datei auswählen"
        />
        <button type="submit" disabled={!canSubmit}>
          Hochladen
        </button>
      </form>
      <button type="button" onClick={refreshUploads}>
        Upload-Historie laden
      </button>
      <p>{message}</p>
      <ul>
        {uploads.map((upload) => (
          <li key={upload.id}>
            {upload.fileName} – {new Date(upload.uploadedAtUtc).toLocaleString()}
          </li>
        ))}
      </ul>
    </main>
  );
}
