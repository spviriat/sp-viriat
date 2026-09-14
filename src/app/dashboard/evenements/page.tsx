"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import {
  CalendarDays,
  Clock3,
  Edit3,
  Loader2,
  MapPin,
  Plus,
  Trash2,
  X,
} from "lucide-react";

import { supabase } from "@/lib/supabase";

type EventCategory =
  | "sapeurs_pompiers"
  | "amicale"
  | "les_deux";

type EventItem = {
  id: string;
  title: string;
  event_date: string;
  end_date: string | null;
  event_time: string | null;
  location: string | null;
  description: string | null;
  category: EventCategory;
  created_by: string;
  created_at: string;
  updated_at: string;
};

type EventForm = {
  title: string;
  event_date: string;
  end_date: string;
  event_time: string;
  location: string;
  description: string;
  category: EventCategory;
};

const EMPTY_FORM: EventForm = {
  title: "",
  event_date: "",
  end_date: "",
  event_time: "",
  location: "",
  description: "",
  category: "sapeurs_pompiers",
};

function formatDate(value: string) {
  return new Intl.DateTimeFormat("fr-FR", {
    weekday: "long",
    day: "2-digit",
    month: "long",
    year: "numeric",
  }).format(new Date(`${value}T12:00:00`));
}

function formatTime(value: string | null) {
  if (!value) return null;
  return value.slice(0, 5);
}

function categoryLabel(category: EventCategory) {
  switch (category) {
    case "sapeurs_pompiers":
      return "Sapeurs-pompiers";
    case "amicale":
      return "Amicale";
    case "les_deux":
      return "Sapeurs-pompiers + Amicale";
  }
}

function EventCard({
  event,
  canManage,
  onEdit,
  onDelete,
}: {
  event: EventItem;
  canManage: boolean;
  onEdit: (event: EventItem) => void;
  onDelete: (event: EventItem) => void;
}) {
  const time = formatTime(event.event_time);

  return (
    <article className="rounded-3xl border border-border bg-card p-5 shadow-sm sm:p-6">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <span className="inline-flex rounded-full bg-red-500/10 px-3 py-1 text-[11px] font-black uppercase tracking-wide text-red-500">
            {categoryLabel(event.category)}
          </span>

          <h2 className="mt-3 text-xl font-black">
            {event.title}
          </h2>
        </div>

        {canManage && (
          <div className="flex shrink-0 gap-2">
            <button
              type="button"
              onClick={() => onEdit(event)}
              className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-border text-muted-foreground transition hover:bg-muted hover:text-foreground"
              title="Modifier"
            >
              <Edit3 size={17} />
            </button>

            <button
              type="button"
              onClick={() => onDelete(event)}
              className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-red-500/20 text-red-500 transition hover:bg-red-500/10"
              title="Supprimer"
            >
              <Trash2 size={17} />
            </button>
          </div>
        )}
      </div>

      <div className="mt-5 flex flex-wrap gap-x-5 gap-y-3 text-sm font-semibold text-muted-foreground">
        <div className="flex items-center gap-2">
          <CalendarDays size={16} />
          <span className="capitalize">
            {event.end_date && event.end_date !== event.event_date
              ? `Du ${formatDate(event.event_date)} au ${formatDate(event.end_date)}`
              : formatDate(event.event_date)}
          </span>
        </div>

        {time && (
          <div className="flex items-center gap-2">
            <Clock3 size={16} />
            <span>{time}</span>
          </div>
        )}

        {event.location && (
          <div className="flex items-center gap-2">
            <MapPin size={16} />
            <span>{event.location}</span>
          </div>
        )}
      </div>

      {event.description && (
        <p className="mt-5 whitespace-pre-wrap text-sm leading-6 text-muted-foreground">
          {event.description}
        </p>
      )}
    </article>
  );
}

export default function EvenementsPage() {
  const [events, setEvents] = useState<EventItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [canManage, setCanManage] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const [formOpen, setFormOpen] = useState(false);
  const [editingEvent, setEditingEvent] =
    useState<EventItem | null>(null);
  const [form, setForm] =
    useState<EventForm>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  const [deleteTarget, setDeleteTarget] =
    useState<EventItem | null>(null);
  const [deleting, setDeleting] = useState(false);

  const loadEvents = useCallback(async () => {
    setLoading(true);
    setErrorMessage("");

    try {
      /*
       * Les RLS Supabase déterminent directement
       * quels événements l'utilisateur peut consulter.
       */
      const { data, error } = await supabase
        .from("events")
        .select(`
          id,
          title,
          event_date,
          end_date,
          event_time,
          location,
          description,
          category,
          created_by,
          created_at,
          updated_at
        `)
        .order("event_date", { ascending: true })
        .order("event_time", { ascending: true });

      if (error) {
        throw error;
      }

      setEvents((data ?? []) as EventItem[]);

      /*
       * Vérification du droit de gestion via la fonction
       * sécurisée créée dans Supabase.
       */
      const {
        data: manageResult,
        error: manageError,
      } = await supabase.rpc("can_manage_events");

      if (manageError) {
        throw manageError;
      }

      setCanManage(manageResult === true);
    } catch (error) {
      console.error(
        "Erreur chargement événements :",
        error
      );

      setErrorMessage(
        "Impossible de charger les événements."
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadEvents();
  }, [loadEvents]);

  /*
   * On ne supprime rien automatiquement.
   * Cette séparation sert uniquement à l'affichage.
   */
  const { upcomingEvents, pastEvents } = useMemo(() => {
    const today = new Date();
    const todayString = [
      today.getFullYear(),
      String(today.getMonth() + 1).padStart(2, "0"),
      String(today.getDate()).padStart(2, "0"),
    ].join("-");

    return {
      upcomingEvents: events.filter(
        (event) =>
          (event.end_date ?? event.event_date) >= todayString
      ),
      pastEvents: events
        .filter(
          (event) =>
            (event.end_date ?? event.event_date) < todayString
        )
        .reverse(),
    };
  }, [events]);

  function openCreateForm() {
    setEditingEvent(null);
    setForm(EMPTY_FORM);
    setFormOpen(true);
  }

  function openEditForm(event: EventItem) {
    setEditingEvent(event);

    setForm({
      title: event.title,
      event_date: event.event_date,
      end_date: event.end_date ?? "",
      event_time: event.event_time
        ? event.event_time.slice(0, 5)
        : "",
      location: event.location ?? "",
      description: event.description ?? "",
      category: event.category,
    });

    setFormOpen(true);
  }

  function closeForm() {
    if (saving) return;

    setFormOpen(false);
    setEditingEvent(null);
    setForm(EMPTY_FORM);
  }

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    if (!canManage || saving) return;

    const title = form.title.trim();

    if (!title || !form.event_date) {
      setErrorMessage(
        "Le titre et la date sont obligatoires."
      );
      return;
    }

    if (
      form.end_date &&
      form.end_date < form.event_date
    ) {
      setErrorMessage(
        "La date de fin ne peut pas être antérieure à la date de début."
      );
      return;
    }

    setSaving(true);
    setErrorMessage("");

    try {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        throw new Error(
          "Session utilisateur introuvable."
        );
      }

      const payload = {
        title,
        event_date: form.event_date,
        end_date: form.end_date || null,
        event_time: form.event_time || null,
        location: form.location.trim() || null,
        description:
          form.description.trim() || null,
        category: form.category,
      };

      if (editingEvent) {
        const { error } = await supabase
          .from("events")
          .update(payload)
          .eq("id", editingEvent.id);

        if (error) {
          throw error;
        }
      } else {
        const { error } = await supabase
          .from("events")
          .insert({
            ...payload,
            created_by: user.id,
          });

        if (error) {
          throw error;
        }
      }

      closeForm();
      await loadEvents();
    } catch (error) {
      console.error(
        "Erreur enregistrement événement :",
        error
      );

      setErrorMessage(
        "Impossible d'enregistrer l'événement."
      );
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (
      !deleteTarget ||
      !canManage ||
      deleting
    ) {
      return;
    }

    setDeleting(true);
    setErrorMessage("");

    try {
      const { error } = await supabase
        .from("events")
        .delete()
        .eq("id", deleteTarget.id);

      if (error) {
        throw error;
      }

      setDeleteTarget(null);
      await loadEvents();
    } catch (error) {
      console.error(
        "Erreur suppression événement :",
        error
      );

      setErrorMessage(
        "Impossible de supprimer l'événement."
      );
    } finally {
      setDeleting(false);
    }
  }

  return (
    <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
      {/* En-tête */}

      <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-black uppercase tracking-[0.18em] text-red-500">
            Vie de la caserne
          </p>

          <h1 className="mt-2 text-3xl font-black tracking-tight sm:text-4xl">
            Événements
          </h1>

          <p className="mt-2 text-muted-foreground">
            Retrouvez les événements qui vous
            concernent.
          </p>
        </div>

        {canManage && (
          <button
            type="button"
            onClick={openCreateForm}
            className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-red-600 px-5 text-sm font-black text-white transition hover:bg-red-700"
          >
            <Plus size={18} />
            Créer un événement
          </button>
        )}
      </div>

      {errorMessage && (
        <div className="mt-6 rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-sm font-bold text-red-500">
          {errorMessage}
        </div>
      )}

      {loading ? (
        <div className="mt-10 flex min-h-52 items-center justify-center rounded-3xl border border-border bg-card">
          <div className="text-center">
            <Loader2
              className="mx-auto animate-spin text-red-500"
              size={30}
            />

            <p className="mt-3 text-sm font-bold text-muted-foreground">
              Chargement des événements...
            </p>
          </div>
        </div>
      ) : (
        <>
          {/* À venir */}

          <section className="mt-10">
            <div className="flex items-center gap-3">
              <CalendarDays
                size={22}
                className="text-red-500"
              />

              <h2 className="text-xl font-black">
                Événements à venir
              </h2>
            </div>

            {upcomingEvents.length === 0 ? (
              <div className="mt-5 rounded-3xl border border-dashed border-border bg-card/50 p-8 text-center">
                <CalendarDays
                  className="mx-auto text-muted-foreground"
                  size={32}
                />

                <p className="mt-4 font-black">
                  Aucun événement à venir
                </p>

                <p className="mt-1 text-sm text-muted-foreground">
                  Aucun événement n&apos;a été
                  renseigné pour le moment.
                </p>
              </div>
            ) : (
              <div className="mt-5 grid gap-4 lg:grid-cols-2">
                {upcomingEvents.map((event) => (
                  <EventCard
                    key={event.id}
                    event={event}
                    canManage={canManage}
                    onEdit={openEditForm}
                    onDelete={setDeleteTarget}
                  />
                ))}
              </div>
            )}
          </section>

          {/* Historique */}

          <section className="mt-12">
            <h2 className="text-xl font-black">
              Événements passés
            </h2>

            {pastEvents.length === 0 ? (
              <p className="mt-4 text-sm font-semibold text-muted-foreground">
                Aucun événement passé.
              </p>
            ) : (
              <div className="mt-5 grid gap-4 lg:grid-cols-2">
                {pastEvents.map((event) => (
                  <EventCard
                    key={event.id}
                    event={event}
                    canManage={canManage}
                    onEdit={openEditForm}
                    onDelete={setDeleteTarget}
                  />
                ))}
              </div>
            )}
          </section>
        </>
      )}

      {/* Création / modification */}

      {formOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <section className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-3xl border border-border bg-card p-6 shadow-2xl sm:p-7">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.18em] text-red-500">
                  Événement
                </p>

                <h2 className="mt-2 text-2xl font-black">
                  {editingEvent
                    ? "Modifier l'événement"
                    : "Créer un événement"}
                </h2>
              </div>

              <button
                type="button"
                onClick={closeForm}
                disabled={saving}
                className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-border text-muted-foreground transition hover:bg-muted"
              >
                <X size={18} />
              </button>
            </div>

            <form
              onSubmit={handleSubmit}
              className="mt-7 space-y-5"
            >
              <div>
                <label className="text-sm font-black">
                  Titre *
                </label>

                <input
                  type="text"
                  required
                  value={form.title}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      title: event.target.value,
                    }))
                  }
                  className="mt-2 min-h-12 w-full rounded-xl border border-border bg-background px-4 outline-none focus:border-red-500"
                  placeholder="Ex. Manœuvre départementale"
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-3">
                <div>
                  <label className="text-sm font-black">
                    Date de début *
                  </label>

                  <input
                    type="date"
                    required
                    value={form.event_date}
                    onChange={(event) => {
                      const nextStartDate = event.target.value;

                      setForm((current) => ({
                        ...current,
                        event_date: nextStartDate,
                        end_date:
                          current.end_date &&
                          current.end_date < nextStartDate
                            ? ""
                            : current.end_date,
                      }));
                    }}
                    className="mt-2 min-h-12 w-full rounded-xl border border-border bg-background px-4 outline-none focus:border-red-500"
                  />
                </div>

                <div>
                  <label className="text-sm font-black">
                    Date de fin
                    <span className="ml-2 text-xs font-normal text-muted-foreground">
                      Facultatif
                    </span>
                  </label>

                  <input
                    type="date"
                    min={form.event_date || undefined}
                    value={form.end_date}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        end_date: event.target.value,
                      }))
                    }
                    className="mt-2 min-h-12 w-full rounded-xl border border-border bg-background px-4 outline-none focus:border-red-500"
                  />
                </div>

                <div>
                  <label className="text-sm font-black">
                    Heure
                  </label>

                  <input
                    type="time"
                    value={form.event_time}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        event_time: event.target.value,
                      }))
                    }
                    className="mt-2 min-h-12 w-full rounded-xl border border-border bg-background px-4 outline-none focus:border-red-500"
                  />
                </div>
              </div>

              <div>
                <label className="text-sm font-black">
                  Lieu
                </label>

                <input
                  type="text"
                  value={form.location}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      location: event.target.value,
                    }))
                  }
                  className="mt-2 min-h-12 w-full rounded-xl border border-border bg-background px-4 outline-none focus:border-red-500"
                  placeholder="Ex. Caserne de Viriat"
                />
              </div>

              <div>
  <label className="text-sm font-black">
    Catégorie *
  </label>

  <div className="mt-3 grid gap-3 sm:grid-cols-3">
    <button
      type="button"
      onClick={() =>
        setForm((current) => ({
          ...current,
          category: "sapeurs_pompiers",
        }))
      }
      className={`rounded-2xl border p-4 text-left transition ${
        form.category === "sapeurs_pompiers"
          ? "border-red-500 bg-red-500/10"
          : "border-border bg-background hover:border-red-500/50"
      }`}
    >
      <div className="text-2xl">🚒</div>

      <div className="mt-2 font-black">
        Sapeurs-pompiers
      </div>

      <div className="mt-1 text-xs text-muted-foreground">
        Caserne et activité SP
      </div>

      <div className="mt-3">
        <span
          className={`inline-flex h-5 w-5 items-center justify-center rounded-md border ${
            form.category === "sapeurs_pompiers"
              ? "border-red-500 bg-red-600 text-white"
              : "border-border"
          }`}
        >
          {form.category === "sapeurs_pompiers"
            ? "✓"
            : ""}
        </span>
      </div>
    </button>

    <button
      type="button"
      onClick={() =>
        setForm((current) => ({
          ...current,
          category: "amicale",
        }))
      }
      className={`rounded-2xl border p-4 text-left transition ${
        form.category === "amicale"
          ? "border-red-500 bg-red-500/10"
          : "border-border bg-background hover:border-red-500/50"
      }`}
    >
      <div className="text-2xl">🤝</div>

      <div className="mt-2 font-black">
        Amicale
      </div>

      <div className="mt-1 text-xs text-muted-foreground">
        Événement de l&apos;Amicale
      </div>

      <div className="mt-3">
        <span
          className={`inline-flex h-5 w-5 items-center justify-center rounded-md border ${
            form.category === "amicale"
              ? "border-red-500 bg-red-600 text-white"
              : "border-border"
          }`}
        >
          {form.category === "amicale" ? "✓" : ""}
        </span>
      </div>
    </button>

    <button
      type="button"
      onClick={() =>
        setForm((current) => ({
          ...current,
          category: "les_deux",
        }))
      }
      className={`rounded-2xl border p-4 text-left transition ${
        form.category === "les_deux"
          ? "border-red-500 bg-red-500/10"
          : "border-border bg-background hover:border-red-500/50"
      }`}
    >
      <div className="text-2xl">🚒🤝</div>

      <div className="mt-2 font-black">
        Les deux
      </div>

      <div className="mt-1 text-xs text-muted-foreground">
        SP et Amicale
      </div>

      <div className="mt-3">
        <span
          className={`inline-flex h-5 w-5 items-center justify-center rounded-md border ${
            form.category === "les_deux"
              ? "border-red-500 bg-red-600 text-white"
              : "border-border"
          }`}
        >
          {form.category === "les_deux" ? "✓" : ""}
        </span>
      </div>
    </button>
  </div>
</div>

              <div>
                <label className="text-sm font-black">
                  Description
                </label>

                <textarea
                  rows={5}
                  value={form.description}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      description:
                        event.target.value,
                    }))
                  }
                  className="mt-2 w-full resize-none rounded-xl border border-border bg-background p-4 outline-none focus:border-red-500"
                  placeholder="Informations complémentaires..."
                />
              </div>

              <div className="flex flex-col-reverse gap-3 pt-2 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={closeForm}
                  disabled={saving}
                  className="min-h-12 rounded-xl border border-border px-5 text-sm font-black"
                >
                  Annuler
                </button>

                <button
                  type="submit"
                  disabled={saving}
                  className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-red-600 px-6 text-sm font-black text-white transition hover:bg-red-700 disabled:opacity-60"
                >
                  {saving && (
                    <Loader2
                      size={17}
                      className="animate-spin"
                    />
                  )}

                  {editingEvent
                    ? "Enregistrer"
                    : "Créer l'événement"}
                </button>
              </div>
            </form>
          </section>
        </div>
      )}

      {/* Confirmation suppression */}

      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <section className="w-full max-w-lg rounded-3xl border border-red-500/30 bg-card p-6 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-red-500/10 text-red-500">
                <Trash2 size={22} />
              </div>

              <button
                type="button"
                disabled={deleting}
                onClick={() =>
                  setDeleteTarget(null)
                }
                className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-border"
              >
                <X size={18} />
              </button>
            </div>

            <p className="mt-5 text-xs font-black uppercase tracking-[0.18em] text-red-500">
              Suppression
            </p>

            <h2 className="mt-2 text-2xl font-black">
              Supprimer cet événement ?
            </h2>

            <p className="mt-3 text-sm text-muted-foreground">
              « {deleteTarget.title} » sera
              définitivement supprimé.
            </p>

            <div className="mt-7 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <button
                type="button"
                disabled={deleting}
                onClick={() =>
                  setDeleteTarget(null)
                }
                className="min-h-12 rounded-xl border border-border px-5 text-sm font-black"
              >
                Annuler
              </button>

              <button
                type="button"
                disabled={deleting}
                onClick={() => void handleDelete()}
                className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-red-600 px-6 text-sm font-black text-white disabled:opacity-60"
              >
                {deleting ? (
                  <Loader2
                    size={17}
                    className="animate-spin"
                  />
                ) : (
                  <Trash2 size={17} />
                )}

                Supprimer
              </button>
            </div>
          </section>
        </div>
      )}
    </main>
  );
}