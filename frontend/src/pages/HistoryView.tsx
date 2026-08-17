import { useState, useEffect, FormEvent, useRef } from "react";
import { api, Pet, ClinicalFile } from "../api";
import { Field, inputClass, Button, Card, Alert } from "../components/ui";

export default function HistoryView() {
  const [pets, setPets] = useState<Pet[]>([]);
  const [files, setFiles] = useState<ClinicalFile[]>([]);
  const [filterPet, setFilterPet] = useState("");
  const [filterFrom, setFilterFrom] = useState("");
  const [filterTo, setFilterTo] = useState("");
  const [uploadPetId, setUploadPetId] = useState("");
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadFiles = () => {
    api
      .getFiles({
        pet_id: filterPet ? Number(filterPet) : undefined,
        from: filterFrom || undefined,
        to: filterTo ? `${filterTo}T23:59:59` : undefined,
      })
      .then(({ files }) => setFiles(files))
      .catch(console.error);
  };

  useEffect(() => {
    api.getPets().then(({ pets }) => {
      setPets(pets);
      if (pets.length > 0 && !uploadPetId) setUploadPetId(String(pets[0].id));
    });
  }, []);

  useEffect(() => {
    loadFiles();
  }, [filterPet, filterFrom, filterTo]);

  const handleUpload = async (e: FormEvent) => {
    e.preventDefault();
    const file = fileInputRef.current?.files?.[0];
    if (!file || !uploadPetId) return;

    setError("");
    setSuccess("");
    setUploading(true);
    try {
      await api.uploadFile(Number(uploadPetId), file);
      setSuccess("File uploaded successfully");
      if (fileInputRef.current) fileInputRef.current.value = "";
      loadFiles();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  const deleteFile = async (id: number) => {
    if (!confirm("Delete this file?")) return;
    try {
      await api.deleteFile(id);
      loadFiles();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Delete failed");
    }
  };

  return (
    <div className="space-y-6">
      <Card title="Upload Clinical File">
        {pets.length === 0 ? (
          <p className="text-sm text-gray-500">Add a pet in Settings before uploading files.</p>
        ) : (
          <form onSubmit={handleUpload} className="space-y-4">
            {error && <Alert message={error} />}
            {success && <Alert message={success} type="success" />}

            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Pet">
                <select className={inputClass} value={uploadPetId} onChange={(e) => setUploadPetId(e.target.value)} required>
                  {pets.map((p) => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              </Field>
              <Field label="File (PDF or image)">
                <input ref={fileInputRef} type="file" accept=".pdf,image/*" className={inputClass} required />
              </Field>
            </div>
            <Button type="submit" disabled={uploading}>
              {uploading ? "Uploading & summarizing..." : "Upload"}
            </Button>
          </form>
        )}
      </Card>

      <Card title="Clinical History">
        <div className="mb-4 grid gap-4 sm:grid-cols-3">
          <Field label="Filter by pet">
            <select className={inputClass} value={filterPet} onChange={(e) => setFilterPet(e.target.value)}>
              <option value="">All pets</option>
              {pets.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </Field>
          <Field label="From date">
            <input type="date" className={inputClass} value={filterFrom} onChange={(e) => setFilterFrom(e.target.value)} />
          </Field>
          <Field label="To date">
            <input type="date" className={inputClass} value={filterTo} onChange={(e) => setFilterTo(e.target.value)} />
          </Field>
        </div>

        {files.length === 0 ? (
          <p className="text-sm text-gray-500">No files found.</p>
        ) : (
          <div className="space-y-4">
            {files.map((file) => (
              <div key={file.id} className="rounded-lg border border-gray-100 p-4">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h3 className="font-medium text-gray-900">{file.original_name}</h3>
                    <p className="text-sm text-gray-500">
                      {file.pet_name} · {new Date(file.uploaded_at).toLocaleDateString()} · {file.mime_type}
                    </p>
                  </div>
                  <div className="flex shrink-0 gap-2">
                    <Button variant="secondary" className="text-xs px-2 py-1" onClick={() => api.downloadFile(file.id).catch((e) => alert(e.message))}>
                      Download
                    </Button>
                    <Button variant="danger" className="text-xs px-2 py-1" onClick={() => deleteFile(file.id)}>
                      Delete
                    </Button>
                  </div>
                </div>
                {file.summary && (
                  <div className="mt-3 rounded-md bg-brand-50 p-3 text-sm text-gray-700">
                    <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-brand-700">AI Summary</p>
                    <p className="whitespace-pre-wrap">{file.summary}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
