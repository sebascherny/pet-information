import { useState, useEffect, FormEvent } from "react";
import { api, Pet } from "../api";
import { useAuth } from "../context/AuthContext";
import { Field, inputClass, Button, Card, Alert } from "../components/ui";

export default function SettingsView() {
  const { user, refreshUser } = useAuth();
  const [name, setName] = useState(user?.name || "");
  const [email, setEmail] = useState(user?.email || "");
  const [openaiKey, setOpenaiKey] = useState("");
  const [anthropicKey, setAnthropicKey] = useState("");
  const [settingsMsg, setSettingsMsg] = useState("");
  const [settingsError, setSettingsError] = useState("");
  const [saving, setSaving] = useState(false);

  const [pets, setPets] = useState<Pet[]>([]);
  const [showPetForm, setShowPetForm] = useState(false);
  const [petForm, setPetForm] = useState({
    name: "",
    species: "",
    breed: "",
    date_of_birth: "",
    sex: "",
    notes: "",
  });
  const [petError, setPetError] = useState("");

  useEffect(() => {
    if (user) {
      setName(user.name);
      setEmail(user.email);
    }
  }, [user]);

  useEffect(() => {
    api.getPets().then(({ pets }) => setPets(pets)).catch(console.error);
  }, []);

  const saveSettings = async (e: FormEvent) => {
    e.preventDefault();
    setSettingsMsg("");
    setSettingsError("");
    setSaving(true);
    try {
      await api.updateSettings({
        name,
        email,
        ...(openaiKey ? { openai_api_key: openaiKey } : {}),
        ...(anthropicKey ? { anthropic_api_key: anthropicKey } : {}),
      });
      await refreshUser();
      setOpenaiKey("");
      setAnthropicKey("");
      setSettingsMsg("Settings saved successfully");
    } catch (err) {
      setSettingsError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  const createPet = async (e: FormEvent) => {
    e.preventDefault();
    setPetError("");
    try {
      const { pet } = await api.createPet({
        name: petForm.name,
        species: petForm.species || undefined,
        breed: petForm.breed || undefined,
        date_of_birth: petForm.date_of_birth || undefined,
        sex: petForm.sex || undefined,
        notes: petForm.notes || undefined,
      });
      setPets((p) => [...p, pet].sort((a, b) => a.name.localeCompare(b.name)));
      setPetForm({ name: "", species: "", breed: "", date_of_birth: "", sex: "", notes: "" });
      setShowPetForm(false);
    } catch (err) {
      setPetError(err instanceof Error ? err.message : "Failed to create pet");
    }
  };

  const deletePet = async (id: number) => {
    if (!confirm("Delete this pet and all associated records?")) return;
    try {
      await api.deletePet(id);
      setPets((p) => p.filter((pet) => pet.id !== id));
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to delete");
    }
  };

  return (
    <div className="space-y-6">
      <Card title="User Settings">
        <form onSubmit={saveSettings} className="space-y-4">
          {settingsMsg && <Alert message={settingsMsg} type="success" />}
          {settingsError && <Alert message={settingsError} />}

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Full name">
              <input className={inputClass} value={name} onChange={(e) => setName(e.target.value)} />
            </Field>
            <Field label="Email">
              <input type="email" className={inputClass} value={email} onChange={(e) => setEmail(e.target.value)} />
            </Field>
          </div>

          <Field label="Anthropic API Key">
            <input
              type="password"
              className={inputClass}
              value={anthropicKey}
              onChange={(e) => setAnthropicKey(e.target.value)}
              placeholder={user?.has_anthropic_key ? "•••••••• (saved — enter new key to replace)" : "sk-ant-..."}
            />
            <p className="mt-1 text-xs text-gray-500">
              Preferred for auto-summarizing uploaded clinical files. Stored securely in your account.
            </p>
          </Field>

          <Field label="OpenAI API Key">
            <input
              type="password"
              className={inputClass}
              value={openaiKey}
              onChange={(e) => setOpenaiKey(e.target.value)}
              placeholder={user?.has_openai_key ? "•••••••• (saved — enter new key to replace)" : "sk-..."}
            />
            <p className="mt-1 text-xs text-gray-500">
              Used for summarization if no Anthropic key is set. Stored securely in your account.
            </p>
          </Field>

          <Button type="submit" disabled={saving}>
            {saving ? "Saving..." : "Save Settings"}
          </Button>
        </form>
      </Card>

      <Card
        title="My Pets"
        action={
          <Button variant="secondary" onClick={() => setShowPetForm(!showPetForm)}>
            {showPetForm ? "Cancel" : "+ Add Pet"}
          </Button>
        }
      >
        {showPetForm && (
          <form onSubmit={createPet} className="mb-6 space-y-4 rounded-lg border border-gray-100 bg-gray-50 p-4">
            {petError && <Alert message={petError} />}
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Name *">
                <input className={inputClass} value={petForm.name} onChange={(e) => setPetForm({ ...petForm, name: e.target.value })} required />
              </Field>
              <Field label="Species">
                <input className={inputClass} value={petForm.species} onChange={(e) => setPetForm({ ...petForm, species: e.target.value })} placeholder="Dog, Cat..." />
              </Field>
              <Field label="Breed">
                <input className={inputClass} value={petForm.breed} onChange={(e) => setPetForm({ ...petForm, breed: e.target.value })} />
              </Field>
              <Field label="Date of birth">
                <input type="date" className={inputClass} value={petForm.date_of_birth} onChange={(e) => setPetForm({ ...petForm, date_of_birth: e.target.value })} />
              </Field>
              <Field label="Sex">
                <select className={inputClass} value={petForm.sex} onChange={(e) => setPetForm({ ...petForm, sex: e.target.value })}>
                  <option value="">—</option>
                  <option value="Male">Male</option>
                  <option value="Female">Female</option>
                </select>
              </Field>
            </div>
            <Field label="Notes">
              <textarea className={inputClass} rows={2} value={petForm.notes} onChange={(e) => setPetForm({ ...petForm, notes: e.target.value })} />
            </Field>
            <Button type="submit">Create Pet</Button>
          </form>
        )}

        {pets.length === 0 ? (
          <p className="text-sm text-gray-500">No pets registered yet. Add your first pet above.</p>
        ) : (
          <div className="divide-y divide-gray-100">
            {pets.map((pet) => (
              <div key={pet.id} className="flex items-start justify-between py-4 first:pt-0 last:pb-0">
                <div>
                  <h3 className="font-medium text-gray-900">{pet.name}</h3>
                  <p className="text-sm text-gray-500">
                    {[pet.species, pet.breed, pet.sex].filter(Boolean).join(" · ") || "No details"}
                  </p>
                  {pet.notes && <p className="mt-1 text-sm text-gray-600">{pet.notes}</p>}
                </div>
                <Button variant="danger" className="text-xs px-2 py-1" onClick={() => deletePet(pet.id)}>
                  Delete
                </Button>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
