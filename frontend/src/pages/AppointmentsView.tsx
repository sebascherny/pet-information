import { useState, useEffect, FormEvent } from "react";
import { api, Pet, Appointment } from "../api";
import { Field, inputClass, Button, Card, Alert } from "../components/ui";

const emptyForm = {
  pet_id: "",
  title: "",
  appointment_at: "",
  veterinarian: "",
  location: "",
  notes: "",
};

function toDatetimeLocal(iso: string) {
  const d = new Date(iso);
  const offset = d.getTimezoneOffset();
  const local = new Date(d.getTime() - offset * 60000);
  return local.toISOString().slice(0, 16);
}

export default function AppointmentsView() {
  const [pets, setPets] = useState<Pet[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [form, setForm] = useState(emptyForm);

  const load = () => {
    api.getAppointments().then(({ appointments }) => setAppointments(appointments)).catch(console.error);
  };

  useEffect(() => {
    api.getPets().then(({ pets }) => {
      setPets(pets);
      if (pets.length > 0) setForm((f) => ({ ...f, pet_id: String(pets[0].id) }));
    });
    load();
  }, []);

  const resetForm = () => {
    setForm({
      ...emptyForm,
      pet_id: pets.length > 0 ? String(pets[0].id) : "",
    });
    setEditingId(null);
    setError("");
  };

  const openCreateForm = () => {
    if (showForm && !editingId) {
      setShowForm(false);
      resetForm();
    } else {
      resetForm();
      setShowForm(true);
    }
  };

  const startEdit = (appointment: Appointment) => {
    setEditingId(appointment.id);
    setShowForm(true);
    setError("");
    setForm({
      pet_id: String(appointment.pet_id),
      title: appointment.title,
      appointment_at: toDatetimeLocal(appointment.appointment_at),
      veterinarian: appointment.veterinarian || "",
      location: appointment.location || "",
      notes: appointment.notes || "",
    });
  };

  const cancelForm = () => {
    setShowForm(false);
    resetForm();
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    const payload = {
      pet_id: Number(form.pet_id),
      title: form.title,
      appointment_at: new Date(form.appointment_at).toISOString(),
      veterinarian: form.veterinarian || null,
      location: form.location || null,
      notes: form.notes || null,
    };

    try {
      if (editingId) {
        await api.updateAppointment(editingId, payload);
      } else {
        await api.createAppointment({
          ...payload,
          veterinarian: form.veterinarian || undefined,
          location: form.location || undefined,
          notes: form.notes || undefined,
        });
      }
      setShowForm(false);
      resetForm();
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save appointment");
    }
  };

  const remove = async (id: number) => {
    if (!confirm("Delete this appointment?")) return;
    try {
      await api.deleteAppointment(id);
      if (editingId === id) cancelForm();
      load();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Delete failed");
    }
  };

  const upcoming = appointments.filter((a) => new Date(a.appointment_at) >= new Date());
  const past = appointments.filter((a) => new Date(a.appointment_at) < new Date());

  return (
    <div className="space-y-6">
      <Card
        title="Appointments"
        action={
          pets.length > 0 ? (
            <Button variant="secondary" onClick={openCreateForm}>
              {showForm && !editingId ? "Cancel" : "+ New Appointment"}
            </Button>
          ) : undefined
        }
      >
        {pets.length === 0 ? (
          <p className="text-sm text-gray-500">Add a pet in Settings before creating appointments.</p>
        ) : showForm ? (
          <form onSubmit={submit} className="mb-6 space-y-4 rounded-lg border border-gray-100 bg-gray-50 p-4">
            <h3 className="text-sm font-semibold text-gray-900">
              {editingId ? "Edit Appointment" : "New Appointment"}
            </h3>
            {error && <Alert message={error} />}
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Pet *">
                <select className={inputClass} value={form.pet_id} onChange={(e) => setForm({ ...form, pet_id: e.target.value })} required>
                  {pets.map((p) => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              </Field>
              <Field label="Title *">
                <input className={inputClass} value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required placeholder="Annual checkup" />
              </Field>
              <Field label="Date & time *">
                <input type="datetime-local" className={inputClass} value={form.appointment_at} onChange={(e) => setForm({ ...form, appointment_at: e.target.value })} required />
              </Field>
              <Field label="Veterinarian">
                <input className={inputClass} value={form.veterinarian} onChange={(e) => setForm({ ...form, veterinarian: e.target.value })} />
              </Field>
              <Field label="Location" className="sm:col-span-2">
                <input className={inputClass} value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} />
              </Field>
            </div>
            <Field label="Notes">
              <textarea className={inputClass} rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
            </Field>
            {!editingId && (
              <p className="text-xs text-gray-500">You'll receive an email reminder 24 hours before the appointment.</p>
            )}
            <div className="flex gap-2">
              <Button type="submit">{editingId ? "Save Changes" : "Create Appointment"}</Button>
              <Button type="button" variant="secondary" onClick={cancelForm}>
                Cancel
              </Button>
            </div>
          </form>
        ) : null}

        <AppointmentList title="Upcoming" items={upcoming} onEdit={startEdit} onDelete={remove} empty="No upcoming appointments." />
        <AppointmentList title="Past" items={past} onEdit={startEdit} onDelete={remove} empty="No past appointments." className="mt-6" />
      </Card>
    </div>
  );
}

function AppointmentList({
  title,
  items,
  onEdit,
  onDelete,
  empty,
  className = "",
}: {
  title: string;
  items: Appointment[];
  onEdit: (appointment: Appointment) => void;
  onDelete: (id: number) => void;
  empty: string;
  className?: string;
}) {
  return (
    <div className={className}>
      <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-500">{title}</h3>
      {items.length === 0 ? (
        <p className="text-sm text-gray-500">{empty}</p>
      ) : (
        <div className="space-y-3">
          {items.map((a) => (
            <div key={a.id} className="flex items-start justify-between rounded-lg border border-gray-100 p-4">
              <div>
                <h4 className="font-medium text-gray-900">{a.title}</h4>
                <p className="text-sm text-gray-600">
                  {a.pet_name} · {new Date(a.appointment_at).toLocaleString()}
                </p>
                {a.veterinarian && <p className="text-sm text-gray-500">Dr. {a.veterinarian}</p>}
                {a.location && <p className="text-sm text-gray-500">{a.location}</p>}
                {a.notes && <p className="mt-1 text-sm text-gray-600">{a.notes}</p>}
                {a.reminder_sent && (
                  <span className="mt-1 inline-block rounded-full bg-green-100 px-2 py-0.5 text-xs text-green-700">
                    Reminder sent
                  </span>
                )}
              </div>
              <div className="flex shrink-0 gap-2">
                <Button variant="secondary" className="text-xs px-2 py-1" onClick={() => onEdit(a)}>
                  Edit
                </Button>
                <Button variant="danger" className="text-xs px-2 py-1" onClick={() => onDelete(a.id)}>
                  Delete
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
