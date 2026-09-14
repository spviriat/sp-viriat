"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Archive,
  Backpack,
  BadgeCheck,
  Ban,
  CircleHelp,
  Clock3,
  Truck,
  Handshake,
  History,
  Inbox,
  LoaderCircle,
  MessageSquareText,
  Pencil,
  Recycle,
  RefreshCw,
  Ruler,
  Send,
  Shirt,
  TriangleAlert,
  X,
  type LucideIcon,
} from "lucide-react";

import { supabase } from "@/lib/supabase";

type ClothingCategory =
  | "sapeurs_pompiers"
  | "amicale"
  | "les_deux";

type RequestReason =
  | "taille"
  | "usure"
  | "deteriore"
  | "perdu"
  | "autre";

type RequestStatus =
  | "en_attente"
  | "prise_en_compte"
  | "en_cours_traitement"
  | "traitee"
  | "refusee";

type ClothingItem = {
  id: string;
  name: string;
  category: ClothingCategory;
  description: string | null;
  is_active: boolean;
};

type ClothingAssignment = {
  id: string;
  profile_id: string;
  clothing_item_id: string;
  size: string | null;
  quantity: number;
  notes: string | null;
  assigned_at: string;
  updated_at: string;
  clothing_items?: ClothingItem | ClothingItem[] | null;
};

type ClothingRequest = {
  id: string;
  profile_id: string;
  clothing_item_id: string;
  reason: RequestReason;
  current_size: string | null;
  requested_size: string | null;
  quantity: number;
  user_comment: string | null;
  status: RequestStatus;
  resolution_comment: string | null;
  handled_at: string | null;
  created_at: string;
  updated_at: string;
  clothing_items?: ClothingItem | ClothingItem[] | null;
};

const STATUS_LABELS: Record<RequestStatus, string> = {
  en_attente: "En attente",
  prise_en_compte: "Prise en compte",
  en_cours_traitement: "En cours de traitement",
  traitee: "Traitée",
  refusee: "Refusée",
};

const STATUS_ICONS: Record<RequestStatus, LucideIcon> = {
  en_attente: Clock3,
  prise_en_compte: BadgeCheck,
  en_cours_traitement: LoaderCircle,
  traitee: BadgeCheck,
  refusee: Ban,
};

const REASON_LABELS: Record<RequestReason, string> = {
  taille: "Changement de taille",
  usure: "Usure",
  deteriore: "Détérioré",
  perdu: "Perdu",
  autre: "Autre",
};

function relationOne<T>(
  value: T | T[] | null | undefined
): T | null {
  if (!value) return null;
  return Array.isArray(value)
    ? value[0] ?? null
    : value;
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("fr-FR", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

export default function MonSacPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);

  const [assignments, setAssignments] = useState<
    ClothingAssignment[]
  >([]);
  const [requests, setRequests] = useState<
    ClothingRequest[]
  >([]);

  const [errorMessage, setErrorMessage] =
    useState("");
  const [successMessage, setSuccessMessage] =
    useState("");

  const [
    selectedAssignment,
    setSelectedAssignment,
  ] = useState<ClothingAssignment | null>(
    null
  );

  const [reason, setReason] =
    useState<RequestReason>("taille");
  const [requestedSize, setRequestedSize] =
    useState("");
  const [quantity, setQuantity] = useState(1);
  const [comment, setComment] = useState("");
  const [requestView, setRequestView] = useState<"active" | "history">("active");

  useEffect(() => {
    void initialize();
  }, []);

  async function initialize() {
    setLoading(true);
    setErrorMessage("");

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.user) {
        router.replace("/");
        return;
      }

      setUserId(session.user.id);

      await Promise.all([
        loadAssignments(session.user.id),
        loadRequests(session.user.id),
      ]);
    } catch (error) {
      console.error(
        "Erreur chargement Mon sac :",
        error
      );

      setErrorMessage(
        "Impossible de charger votre dotation."
      );
    } finally {
      setLoading(false);
    }
  }

  async function loadAssignments(
    profileId: string
  ) {
    const { data, error } = await supabase
      .from("clothing_assignments")
      .select(`
        id,
        profile_id,
        clothing_item_id,
        size,
        quantity,
        notes,
        assigned_at,
        updated_at,
        clothing_items (
          id,
          name,
          category,
          description,
          is_active
        )
      `)
      .eq("profile_id", profileId)
      .order("assigned_at", {
        ascending: true,
      });

    if (error) {
      throw error;
    }

    setAssignments(
      (data ?? []) as ClothingAssignment[]
    );
  }

  async function loadRequests(
    profileId: string
  ) {
    const { data, error } = await supabase
      .from("clothing_requests")
      .select(`
        id,
        profile_id,
        clothing_item_id,
        reason,
        current_size,
        requested_size,
        quantity,
        user_comment,
        status,
        resolution_comment,
        handled_at,
        created_at,
        updated_at,
        clothing_items (
          id,
          name,
          category,
          description,
          is_active
        )
      `)
      .eq("profile_id", profileId)
      .order("created_at", {
        ascending: false,
      });

    if (error) {
      throw error;
    }

    setRequests(
      (data ?? []) as ClothingRequest[]
    );
  }

  function openRequest(
    assignment: ClothingAssignment
  ) {
    setSelectedAssignment(assignment);
    setReason("taille");
    setRequestedSize("");
    setQuantity(1);
    setComment("");
    setErrorMessage("");
    setSuccessMessage("");
  }

  function closeRequest() {
    if (submitting) return;

    setSelectedAssignment(null);
    setReason("taille");
    setRequestedSize("");
    setQuantity(1);
    setComment("");
  }

  async function submitRequest(
    event: FormEvent
  ) {
    event.preventDefault();

    if (
      !selectedAssignment ||
      !userId
    ) {
      return;
    }

    if (
      reason === "taille" &&
      !requestedSize.trim()
    ) {
      setErrorMessage(
        "Indiquez la taille souhaitée."
      );
      return;
    }

    if (quantity < 1) {
      setErrorMessage(
        "La quantité doit être au minimum de 1."
      );
      return;
    }

    setSubmitting(true);
    setErrorMessage("");
    setSuccessMessage("");

    try {
      const { error } = await supabase
        .from("clothing_requests")
        .insert({
          profile_id: userId,
          clothing_item_id:
            selectedAssignment.clothing_item_id,
          reason,
          current_size:
            selectedAssignment.size,
          requested_size:
            reason === "taille"
              ? requestedSize.trim()
              : null,
          quantity,
          user_comment:
            comment.trim() || null,
          status: "en_attente",
          resolution_comment: null,
          handled_by: null,
          handled_at: null,
        });

      if (error) {
        throw error;
      }

      await loadRequests(userId);

      setSelectedAssignment(null);

      setSuccessMessage(
        "Votre demande de changement a bien été envoyée au responsable habillement."
      );
    } catch (error) {
      console.error(
        "Erreur création demande :",
        error
      );

      setErrorMessage(
        "Impossible d'envoyer votre demande."
      );
    } finally {
      setSubmitting(false);
    }
  }

  const spAssignments = useMemo(
    () =>
      assignments.filter(
        (assignment) => {
          const item = relationOne(
            assignment.clothing_items
          );

          return (
            item?.category ===
              "sapeurs_pompiers" ||
            item?.category === "les_deux"
          );
        }
      ),
    [assignments]
  );

  const amicaleAssignments = useMemo(
    () =>
      assignments.filter(
        (assignment) => {
          const item = relationOne(
            assignment.clothing_items
          );

          return (
            item?.category === "amicale" ||
            item?.category === "les_deux"
          );
        }
      ),
    [assignments]
  );

  const activeRequests = useMemo(
    () =>
      requests.filter(
        (request) =>
          request.status !== "traitee" &&
          request.status !== "refusee"
      ),
    [requests]
  );

  const historicalRequests = useMemo(
    () =>
      requests.filter(
        (request) =>
          request.status === "traitee" ||
          request.status === "refusee"
      ),
    [requests]
  );

  const visibleRequests =
    requestView === "active"
      ? activeRequests
      : historicalRequests;

  if (loading) {
    return (
      <main className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
        <p className="text-sm text-muted-foreground">
          Chargement de votre sac...
        </p>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
      <div>
        <p className="text-sm font-black uppercase tracking-[0.2em] text-red-600">
          Habillement
        </p>

        <h1 className="mt-2 flex items-center gap-3 text-3xl font-black sm:text-4xl">
          <Backpack className="h-8 w-8 text-red-600 sm:h-9 sm:w-9" />
          Mon sac
        </h1>

        <p className="mt-2 max-w-2xl text-muted-foreground">
          Retrouvez votre dotation habillement et
          effectuez vos demandes de changement.
        </p>
      </div>

      {(errorMessage ||
        successMessage) && (
        <div className="mt-6 space-y-3">
          {errorMessage && (
            <div className="rounded-2xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm font-bold text-red-600">
              {errorMessage}
            </div>
          )}

          {successMessage && (
            <div className="rounded-2xl border border-emerald-500/40 bg-emerald-500/10 px-4 py-3 text-sm font-bold text-emerald-600">
              {successMessage}
            </div>
          )}
        </div>
      )}

      {assignments.length === 0 ? (
        <section className="mt-8 rounded-3xl border border-dashed border-border bg-card p-10 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-muted">
            <Backpack className="h-7 w-7 text-muted-foreground" />
          </div>

          <h2 className="mt-4 text-xl font-black">
            Votre sac est vide
          </h2>

          <p className="mx-auto mt-2 max-w-lg text-sm text-muted-foreground">
            Aucune dotation habillement ne vous a
            encore été attribuée.
          </p>
        </section>
      ) : (
        <div className="mt-8 space-y-8">
          {spAssignments.length > 0 && (
            <AssignmentSection
              title="Sapeurs-pompiers"
              icon={Truck}
              description="Votre dotation Sapeurs-pompiers."
              assignments={spAssignments}
              onRequest={openRequest}
            />
          )}

          {amicaleAssignments.length >
            0 && (
            <AssignmentSection
              title="Amicale"
              icon={Handshake}
              description="Votre dotation Amicale."
              assignments={
                amicaleAssignments
              }
              onRequest={openRequest}
            />
          )}
        </div>
      )}

      <section className="mt-10">
        <div>
          <h2 className="flex items-center gap-2 text-2xl font-black">
            <Send className="h-6 w-6 text-red-600" />
            Mes demandes
          </h2>

          <p className="mt-1 text-sm text-muted-foreground">
            Suivez vos demandes en cours et retrouvez les demandes terminées
            dans l&apos;historique.
          </p>
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          <button
            type="button"
            onClick={() => setRequestView("active")}
            className={`rounded-2xl border px-5 py-4 text-left transition ${
              requestView === "active"
                ? "border-red-600 bg-red-600 text-white"
                : "border-border bg-card hover:border-red-500"
            }`}
          >
            <div className="flex items-center justify-between gap-3">
              <span className="flex items-center gap-2 font-black">
                <Clock3 className="h-4 w-4" />
                En cours
              </span>
              <span
                className={`rounded-full px-2.5 py-1 text-xs font-black ${
                  requestView === "active"
                    ? "bg-white/20"
                    : "bg-muted"
                }`}
              >
                {activeRequests.length}
              </span>
            </div>
            <p
              className={`mt-1 text-xs ${
                requestView === "active"
                  ? "text-white/80"
                  : "text-muted-foreground"
              }`}
            >
              En attente, prise en compte et traitement.
            </p>
          </button>

          <button
            type="button"
            onClick={() => setRequestView("history")}
            className={`rounded-2xl border px-5 py-4 text-left transition ${
              requestView === "history"
                ? "border-slate-700 bg-slate-800 text-white dark:border-slate-300 dark:bg-slate-100 dark:text-slate-900"
                : "border-border bg-card hover:border-slate-500"
            }`}
          >
            <div className="flex items-center justify-between gap-3">
              <span className="flex items-center gap-2 font-black">
                <History className="h-4 w-4" />
                Historique
              </span>
              <span
                className={`rounded-full px-2.5 py-1 text-xs font-black ${
                  requestView === "history"
                    ? "bg-white/20 dark:bg-black/10"
                    : "bg-muted"
                }`}
              >
                {historicalRequests.length}
              </span>
            </div>
            <p
              className={`mt-1 text-xs ${
                requestView === "history"
                  ? "text-white/80 dark:text-slate-600"
                  : "text-muted-foreground"
              }`}
            >
              Demandes traitées ou refusées.
            </p>
          </button>
        </div>

        {visibleRequests.length === 0 ? (
          <div className="mt-5 rounded-3xl border border-dashed border-border bg-card p-8 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-muted">
              {requestView === "active" ? (
                <Inbox className="h-6 w-6 text-muted-foreground" />
              ) : (
                <Archive className="h-6 w-6 text-muted-foreground" />
              )}
            </div>

            <p className="mt-3 font-black">
              {requestView === "active"
                ? "Aucune demande en cours"
                : "Historique vide"}
            </p>

            <p className="mt-1 text-sm text-muted-foreground">
              {requestView === "active"
                ? "Vos nouvelles demandes apparaîtront ici."
                : "Les demandes traitées ou refusées apparaîtront ici."}
            </p>
          </div>
        ) : (
          <div className="mt-5 space-y-4">
            {visibleRequests.map((request) => (
              <RequestCard
                key={request.id}
                request={request}
              />
            ))}
          </div>
        )}
      </section>

      {selectedAssignment && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/70 p-4 sm:p-8">
          <form
            onSubmit={submitRequest}
            className="w-full max-w-2xl rounded-3xl border border-border bg-card p-5 shadow-2xl sm:p-7"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-black uppercase tracking-widest text-red-600">
                  Demande de changement
                </p>

                <h2 className="mt-2 text-2xl font-black">
                  {relationOne(
                    selectedAssignment.clothing_items
                  )?.name ??
                    "Vêtement"}
                </h2>

                <p className="mt-2 text-sm text-muted-foreground">
                  Taille actuelle :{" "}
                  <strong>
                    {selectedAssignment.size ||
                      "Non renseignée"}
                  </strong>
                  {" · "}
                  Quantité actuelle :{" "}
                  <strong>
                    {
                      selectedAssignment.quantity
                    }
                  </strong>
                </p>
              </div>

              <button
                type="button"
                onClick={closeRequest}
                className="rounded-xl border border-border px-3 py-2 font-black"
              >
                <X className="h-5 w-5" />
                <span className="sr-only">Fermer</span>
              </button>
            </div>

            <label className="mt-7 block text-sm font-black">
              Motif de la demande *
            </label>

            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              {(
                Object.keys(
                  REASON_LABELS
                ) as RequestReason[]
              ).map((value) => (
                <button
                  key={value}
                  type="button"
                  onClick={() =>
                    setReason(value)
                  }
                  className={`rounded-2xl border-2 p-4 text-left transition ${
                    reason === value
                      ? "border-red-600 bg-red-500/10"
                      : "border-border hover:border-slate-400"
                  }`}
                >
                  <span className="flex items-center gap-2 font-black">
                    {value === "taille" && (
                      <Ruler className="h-4 w-4" />
                    )}
                    {value === "usure" && (
                      <Recycle className="h-4 w-4" />
                    )}
                    {value === "deteriore" && (
                      <TriangleAlert className="h-4 w-4" />
                    )}
                    {value === "perdu" && (
                      <CircleHelp className="h-4 w-4" />
                    )}
                    {value === "autre" && (
                      <Pencil className="h-4 w-4" />
                    )}
                    {REASON_LABELS[value]}
                  </span>
                </button>
              ))}
            </div>

            {reason === "taille" && (
              <>
                <label className="mt-6 block text-sm font-black">
                  Taille souhaitée *
                </label>

                <input
                  required
                  value={requestedSize}
                  onChange={(event) =>
                    setRequestedSize(
                      event.target.value
                    )
                  }
                  placeholder="Ex. M, L, XL, 42..."
                  className="mt-2 min-h-12 w-full rounded-xl border border-border bg-background px-4"
                />
              </>
            )}

            <label className="mt-6 block text-sm font-black">
              Quantité concernée *
            </label>

            <input
              required
              type="number"
              min={1}
              max={Math.max(
                1,
                selectedAssignment.quantity
              )}
              value={quantity}
              onChange={(event) =>
                setQuantity(
                  Number(
                    event.target.value
                  )
                )
              }
              className="mt-2 min-h-12 w-full rounded-xl border border-border bg-background px-4"
            />

            <p className="mt-2 text-xs text-muted-foreground">
              Quantité actuellement attribuée :{" "}
              {selectedAssignment.quantity}
            </p>

            <label className="mt-6 block text-sm font-black">
              Commentaire
            </label>

            <textarea
              value={comment}
              onChange={(event) =>
                setComment(
                  event.target.value
                )
              }
              rows={4}
              placeholder="Ajoutez une précision si nécessaire..."
              className="mt-2 w-full rounded-xl border border-border bg-background p-4"
            />

            <div className="mt-7 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={closeRequest}
                disabled={submitting}
                className="rounded-xl border border-border px-5 py-3 font-black disabled:opacity-50"
              >
                Annuler
              </button>

              <button
                type="submit"
                disabled={submitting}
                className="rounded-xl bg-red-600 px-5 py-3 font-black text-white transition hover:bg-red-700 disabled:opacity-50"
              >
                {submitting
                  ? "Envoi..."
                  : "Envoyer la demande"}
              </button>
            </div>
          </form>
        </div>
      )}
    </main>
  );
}

function AssignmentSection({
  title,
  icon,
  description,
  assignments,
  onRequest,
}: {
  title: string;
  icon: LucideIcon;
  description: string;
  assignments: ClothingAssignment[];
  onRequest: (
    assignment: ClothingAssignment
  ) => void;
}) {
  const Icon = icon;

  return (
    <section className="rounded-3xl border border-border bg-card p-5 shadow-sm sm:p-6">
      <div>
        <h2 className="flex items-center gap-2 text-2xl font-black">
          <Icon className="h-6 w-6 text-red-600" />
          {title}
        </h2>

        <p className="mt-1 text-sm text-muted-foreground">
          {description}
        </p>
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {assignments.map(
          (assignment) => {
            const item = relationOne(
              assignment.clothing_items
            );

            return (
              <article
                key={assignment.id}
                className="flex flex-col rounded-2xl border border-border p-5"
              >
                <div className="flex-1">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-muted">
                      <Shirt className="h-5 w-5 text-muted-foreground" />
                    </div>

                    <span className="rounded-full bg-muted px-3 py-1 text-xs font-black">
                      x
                      {
                        assignment.quantity
                      }
                    </span>
                  </div>

                  <h3 className="mt-4 text-lg font-black">
                    {item?.name ??
                      "Vêtement"}
                  </h3>

                  {item?.description && (
                    <p className="mt-1 text-sm text-muted-foreground">
                      {
                        item.description
                      }
                    </p>
                  )}

                  <div className="mt-4 rounded-xl bg-muted/50 p-3">
                    <p className="text-xs font-bold uppercase text-muted-foreground">
                      Taille
                    </p>

                    <p className="mt-1 text-lg font-black">
                      {assignment.size ||
                        "Non renseignée"}
                    </p>
                  </div>

                  {assignment.notes && (
                    <p className="mt-3 flex items-start gap-2 text-sm text-muted-foreground">
                      <MessageSquareText className="mt-0.5 h-4 w-4 shrink-0" />
                      <span>{assignment.notes}</span>
                    </p>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() =>
                    onRequest(
                      assignment
                    )
                  }
                  className="mt-5 w-full rounded-xl border border-red-500/40 px-4 py-3 text-sm font-black text-red-600 transition hover:bg-red-500/10"
                >
                  <span className="flex items-center justify-center gap-2">
                    <RefreshCw className="h-4 w-4" />
                    Demander un changement
                  </span>
                </button>
              </article>
            );
          }
        )}
      </div>
    </section>
  );
}

function RequestCard({
  request,
}: {
  request: ClothingRequest;
}) {
  const item = relationOne(
    request.clothing_items
  );

  const isClosed =
    request.status === "traitee" ||
    request.status === "refusee";

  const StatusIcon = STATUS_ICONS[request.status];

  return (
    <article className="rounded-3xl border border-border bg-card p-5 shadow-sm sm:p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <p className="flex items-center gap-2 text-lg font-black">
            <Shirt className="h-5 w-5 text-red-600" />
            {item?.name ?? "Vêtement"}
          </p>

          <p className="mt-1 text-sm text-muted-foreground">
            {
              REASON_LABELS[
                request.reason
              ]
            }
            {" · "}
            {formatDate(
              request.created_at
            )}
          </p>
        </div>

        <span className="flex w-fit items-center gap-1.5 rounded-full bg-muted px-3 py-1.5 text-xs font-black">
          <StatusIcon className="h-3.5 w-3.5" />
          {STATUS_LABELS[request.status]}
        </span>
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-3">
        <SmallInfo
          label="Taille actuelle"
          value={
            request.current_size ||
            "—"
          }
        />

        <SmallInfo
          label="Taille souhaitée"
          value={
            request.requested_size ||
            "—"
          }
        />

        <SmallInfo
          label="Quantité"
          value={String(
            request.quantity
          )}
        />
      </div>

      {request.user_comment && (
        <div className="mt-4 rounded-2xl border border-border p-4">
          <p className="text-xs font-bold uppercase text-muted-foreground">
            Votre commentaire
          </p>

          <p className="mt-2 whitespace-pre-wrap text-sm">
            {request.user_comment}
          </p>
        </div>
      )}

      {isClosed &&
        request.resolution_comment && (
          <div
            className={`mt-4 rounded-2xl border p-4 ${
              request.status ===
              "traitee"
                ? "border-emerald-500/30 bg-emerald-500/10"
                : "border-red-500/30 bg-red-500/10"
            }`}
          >
            <p className="text-xs font-black uppercase">
              {request.status ===
              "traitee"
                ? "Commentaire de traitement"
                : "Motif du refus"}
            </p>

            <p className="mt-2 whitespace-pre-wrap text-sm">
              {
                request.resolution_comment
              }
            </p>

            {request.handled_at && (
              <p className="mt-2 text-xs opacity-70">
                Mis à jour le{" "}
                {formatDate(
                  request.handled_at
                )}
              </p>
            )}
          </div>
        )}
    </article>
  );
}

function SmallInfo({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-xl bg-muted/50 p-3">
      <p className="text-xs font-bold uppercase text-muted-foreground">
        {label}
      </p>

      <p className="mt-1 font-black">
        {value}
      </p>
    </div>
  );
}