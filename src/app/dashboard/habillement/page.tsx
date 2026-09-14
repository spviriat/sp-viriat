"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { supabase } from "@/lib/supabase";

type Tab = "personnel" | "catalogue" | "demandes" | "restitutions" | "historique";
type ClothingCategory = "sapeurs_pompiers" | "amicale" | "les_deux";
type RequestStatus =
  | "en_attente"
  | "prise_en_compte"
  | "en_cours_traitement"
  | "traitee"
  | "refusee";

type Profile = {
  id: string;
  first_name: string;
  last_name: string;
  grade: string | null;
  phone: string | null;
  access_status: string;
};

type BusinessRoleAssignment = {
  profile_id: string;
  business_roles:
    | { code: string; label: string }
    | { code: string; label: string }[]
    | null;
};

type ClothingItem = {
  id: string;
  name: string;
  category: ClothingCategory;
  description: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
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
  reason: "taille" | "usure" | "deteriore" | "perdu" | "autre";
  current_size: string | null;
  requested_size: string | null;
  quantity: number;
  user_comment: string | null;
  status: RequestStatus;
  resolution_comment: string | null;
  handled_by: string | null;
  handled_at: string | null;
  created_at: string;
  updated_at: string;
  clothing_items?: ClothingItem | ClothingItem[] | null;
};

type RequestHistory = {
  id: string;
  request_id: string;
  previous_status: string | null;
  new_status: string;
  comment: string | null;
  changed_by: string | null;
  created_at: string;
};

type ClothingReturn = {
  id: string;
  profile_id: string | null;
  first_name: string | null;
  last_name: string | null;
  grade: string | null;
  status: "a_restituer" | "en_cours" | "terminee" | "pret_suppression";
  started_at: string;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
};

type ClothingReturnItem = {
  id: string;
  return_id: string;
  clothing_item_id: string | null;
  clothing_name: string;
  size: string | null;
  quantity: number;
  status: "a_restituer" | "rendu" | "non_rendu";
  comment: string | null;
  validated_at: string | null;
  created_at: string;
};

const CATEGORY_LABELS: Record<ClothingCategory, string> = {
  sapeurs_pompiers: "Sapeurs-pompiers",
  amicale: "Amicale",
  les_deux: "Les deux",
};

const STATUS_LABELS: Record<RequestStatus, string> = {
  en_attente: "En attente",
  prise_en_compte: "Prise en compte",
  en_cours_traitement: "En cours de traitement",
  traitee: "Traitée",
  refusee: "Refusée",
};

const STATUS_ICONS: Record<RequestStatus, string> = {
  en_attente: "🟠",
  prise_en_compte: "🔵",
  en_cours_traitement: "🟣",
  traitee: "🟢",
  refusee: "🔴",
};

function relationOne<T>(value: T | T[] | null | undefined): T | null {
  if (!value) return null;
  return Array.isArray(value) ? value[0] ?? null : value;
}

function fullName(profile?: Profile | null) {
  if (!profile) return "Utilisateur";
  return `${profile.first_name ?? ""} ${profile.last_name ?? ""}`.trim();
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("fr-FR", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

export default function HabillementPage() {
  const router = useRouter();

  const [tab, setTab] = useState<Tab>("personnel");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [authorized, setAuthorized] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [roleCodesByProfile, setRoleCodesByProfile] = useState<
    Record<string, string[]>
  >({});
  const [items, setItems] = useState<ClothingItem[]>([]);
  const [requests, setRequests] = useState<ClothingRequest[]>([]);

  const [search, setSearch] = useState("");
  const [historyAgentFilter, setHistoryAgentFilter] = useState("");
  const [selectedProfile, setSelectedProfile] = useState<Profile | null>(null);
  const [assignments, setAssignments] = useState<ClothingAssignment[]>([]);
  const [assignmentItemId, setAssignmentItemId] = useState("");
  const [assignmentSize, setAssignmentSize] = useState("");
  const [assignmentQuantity, setAssignmentQuantity] = useState(1);
  const [assignmentNotes, setAssignmentNotes] = useState("");

  const [catalogueOpen, setCatalogueOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<ClothingItem | null>(null);
  const [itemName, setItemName] = useState("");
  const [itemCategory, setItemCategory] =
    useState<ClothingCategory>("sapeurs_pompiers");
  const [itemDescription, setItemDescription] = useState("");

  const [selectedRequest, setSelectedRequest] =
    useState<ClothingRequest | null>(null);
  const [requestStatus, setRequestStatus] =
    useState<RequestStatus>("en_attente");
  const [resolutionComment, setResolutionComment] = useState("");
  const [requestHistory, setRequestHistory] = useState<RequestHistory[]>([]);

  const [returns, setReturns] = useState<ClothingReturn[]>([]);
  const [selectedReturn, setSelectedReturn] = useState<ClothingReturn | null>(null);
  const [returnItems, setReturnItems] = useState<ClothingReturnItem[]>([]);
  const [returnComment, setReturnComment] = useState("");
  const [returnItemBeingHandled, setReturnItemBeingHandled] =
    useState<ClothingReturnItem | null>(null);
  const [returnDecision, setReturnDecision] =
    useState<"rendu" | "non_rendu">("rendu");

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

      setCurrentUserId(session.user.id);

      const { data: canManage, error: permissionError } =
        await supabase.rpc("can_manage_clothing");

      if (permissionError) throw permissionError;

      if (!canManage) {
        setAuthorized(false);
        setLoading(false);
        return;
      }

      setAuthorized(true);
      await Promise.all([
        loadPersonnel(),
        loadCatalogue(),
        loadRequests(),
        loadReturns(),
      ]);
    } catch (error) {
      console.error("Initialisation habillement :", error);
      setErrorMessage(
        "Impossible de charger le module habillement."
      );
    } finally {
      setLoading(false);
    }
  }

  async function loadPersonnel() {
    const [profilesResult, rolesResult] = await Promise.all([
      supabase
        .from("profiles")
        .select(
          "id, first_name, last_name, grade, phone, access_status"
        )
        .eq("access_status", "active")
        .order("last_name")
        .order("first_name"),
      supabase
        .from("profile_business_roles")
        .select(
          "profile_id, business_roles(code, label)"
        ),
    ]);

    if (profilesResult.error) throw profilesResult.error;
    if (rolesResult.error) throw rolesResult.error;

    const roleMap: Record<string, string[]> = {};

    for (const assignment of (rolesResult.data ??
      []) as BusinessRoleAssignment[]) {
      const rawRoles = assignment.business_roles;
      const roles = Array.isArray(rawRoles)
        ? rawRoles
        : rawRoles
          ? [rawRoles]
          : [];

      roleMap[assignment.profile_id] = [
        ...(roleMap[assignment.profile_id] ?? []),
        ...roles.map((role) => role.code),
      ];
    }

    setRoleCodesByProfile(roleMap);

    // Le module concerne les SP et/ou les amicalistes.
    const eligible = ((profilesResult.data ?? []) as Profile[]).filter(
      (profile) => {
        const codes = roleMap[profile.id] ?? [];
        return (
          codes.includes("sapeur_pompier") ||
          codes.includes("amicaliste")
        );
      }
    );

    setProfiles(eligible);
  }

  async function loadCatalogue() {
    const { data, error } = await supabase
      .from("clothing_items")
      .select("*")
      .order("is_active", { ascending: false })
      .order("name");

    if (error) throw error;
    setItems((data ?? []) as ClothingItem[]);
  }

  async function loadRequests() {
    const { data, error } = await supabase
      .from("clothing_requests")
      .select(
        `
          *,
          clothing_items (
            id,
            name,
            category,
            description,
            is_active,
            created_at,
            updated_at
          )
        `
      )
      .order("created_at", { ascending: false });

    if (error) throw error;
    setRequests((data ?? []) as ClothingRequest[]);
  }

  async function loadReturns() {
    const { data, error } = await supabase
      .from("clothing_returns")
      .select("*")
      .in("status", ["a_restituer", "en_cours", "pret_suppression"])
      .order("started_at", { ascending: true });

    if (error) throw error;
    setReturns((data ?? []) as ClothingReturn[]);
  }

  async function openReturn(clothingReturn: ClothingReturn) {
    setSelectedReturn(clothingReturn);
    setReturnItems([]);
    setReturnItemBeingHandled(null);
    setReturnComment("");
    setErrorMessage("");
    setSuccessMessage("");

    const { data, error } = await supabase
      .from("clothing_return_items")
      .select("*")
      .eq("return_id", clothingReturn.id)
      .order("created_at", { ascending: true });

    if (error) {
      console.error(error);
      setErrorMessage("Impossible de charger les vêtements à restituer.");
      return;
    }

    setReturnItems((data ?? []) as ClothingReturnItem[]);
  }

  function prepareReturnDecision(
    item: ClothingReturnItem,
    decision: "rendu" | "non_rendu"
  ) {
    setReturnItemBeingHandled(item);
    setReturnDecision(decision);
    setReturnComment("");
  }

  async function finalizeReturn(clothingReturn: ClothingReturn) {
    setSaving(true);
    setErrorMessage("");
    setSuccessMessage("");

    try {
      const {
        data: { session },
        error: sessionError,
      } = await supabase.auth.getSession();

      if (sessionError || !session?.access_token) {
        throw new Error(
          "Votre session a expiré. Veuillez vous reconnecter."
        );
      }

      const response = await fetch(
        `/api/habillement/restitutions/${clothingReturn.id}/finalize`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${session.access_token}`,
          },
        }
      );

      const result = (await response.json()) as {
        error?: string;
        message?: string;
      };

      if (!response.ok) {
        throw new Error(
          result.error ??
            "Impossible de finaliser la suppression du compte."
        );
      }

      setSelectedReturn(null);
      setReturnItems([]);
      setReturnItemBeingHandled(null);
      setReturnComment("");
      setSuccessMessage(
        result.message ??
          "Restitution terminée et compte supprimé définitivement."
      );

      await Promise.all([
        loadReturns(),
        loadPersonnel(),
      ]);
    } catch (error) {
      console.error("Finalisation restitution :", error);
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Impossible de finaliser la suppression du compte."
      );

      // On conserve le dossier visible en "prêt à supprimer" afin
      // que le responsable puisse relancer la finalisation.
      await loadReturns();
    } finally {
      setSaving(false);
    }
  }

  async function validateReturnItem() {
    if (!selectedReturn || !returnItemBeingHandled) return;

    if (returnDecision === "non_rendu" && !returnComment.trim()) {
      setErrorMessage(
        "Un commentaire est obligatoire pour déclarer un vêtement non rendu."
      );
      return;
    }

    setSaving(true);
    setErrorMessage("");
    setSuccessMessage("");

    try {
      const { error } = await supabase.rpc(
        "validate_clothing_return_item",
        {
          target_item_id: returnItemBeingHandled.id,
          new_status: returnDecision,
          return_comment: returnComment.trim() || null,
        }
      );

      if (error) throw error;

      setReturnItemBeingHandled(null);
      setReturnComment("");

      const { data: refreshedReturn, error: returnError } = await supabase
        .from("clothing_returns")
        .select("*")
        .eq("id", selectedReturn.id)
        .single();

      if (returnError) throw returnError;

      const updatedReturn = refreshedReturn as ClothingReturn;

      if (updatedReturn.status === "pret_suppression") {
        setSelectedReturn(updatedReturn);
        setReturnItems([]);
        setSuccessMessage(
          "Restitution terminée. Suppression définitive du compte en cours..."
        );
        await finalizeReturn(updatedReturn);
      } else {
        setSelectedReturn(updatedReturn);
        await openReturn(updatedReturn);
        await loadReturns();
        setSuccessMessage("Restitution enregistrée.");
      }
    } catch (error) {
      console.error("Validation restitution :", error);
      setErrorMessage("Impossible d'enregistrer cette restitution.");
    } finally {
      setSaving(false);
    }
  }

  async function openProfile(profile: Profile) {
    setSelectedProfile(profile);
    setAssignments([]);
    setErrorMessage("");
    setSuccessMessage("");

    const { data, error } = await supabase
      .from("clothing_assignments")
      .select(
        `
          *,
          clothing_items (
            id,
            name,
            category,
            description,
            is_active,
            created_at,
            updated_at
          )
        `
      )
      .eq("profile_id", profile.id)
      .order("assigned_at");

    if (error) {
      console.error(error);
      setErrorMessage("Impossible de charger la dotation.");
      return;
    }

    setAssignments((data ?? []) as ClothingAssignment[]);
  }

  async function saveAssignment(event: FormEvent) {
    event.preventDefault();
    if (!selectedProfile || !assignmentItemId) return;

    setSaving(true);
    setErrorMessage("");
    setSuccessMessage("");

    try {
      const { error } = await supabase
        .from("clothing_assignments")
        .upsert(
          {
            profile_id: selectedProfile.id,
            clothing_item_id: assignmentItemId,
            size: assignmentSize.trim() || null,
            quantity: Math.max(0, assignmentQuantity),
            notes: assignmentNotes.trim() || null,
            assigned_by: currentUserId,
            updated_at: new Date().toISOString(),
          },
          {
            onConflict: "profile_id,clothing_item_id",
          }
        );

      if (error) throw error;

      setAssignmentItemId("");
      setAssignmentSize("");
      setAssignmentQuantity(1);
      setAssignmentNotes("");
      setSuccessMessage("Dotation enregistrée.");
      await openProfile(selectedProfile);
    } catch (error) {
      console.error(error);
      setErrorMessage("Impossible d'enregistrer la dotation.");
    } finally {
      setSaving(false);
    }
  }

  async function removeAssignment(assignment: ClothingAssignment) {
    if (!selectedProfile) return;
    if (!window.confirm("Retirer ce vêtement de la dotation ?")) return;

    const { error } = await supabase
      .from("clothing_assignments")
      .delete()
      .eq("id", assignment.id);

    if (error) {
      setErrorMessage("Impossible de retirer ce vêtement.");
      return;
    }

    setSuccessMessage("Vêtement retiré de la dotation.");
    await openProfile(selectedProfile);
  }

  function openCreateItem() {
    setEditingItem(null);
    setItemName("");
    setItemCategory("sapeurs_pompiers");
    setItemDescription("");
    setCatalogueOpen(true);
  }

  function openEditItem(item: ClothingItem) {
    setEditingItem(item);
    setItemName(item.name);
    setItemCategory(item.category);
    setItemDescription(item.description ?? "");
    setCatalogueOpen(true);
  }

  async function saveItem(event: FormEvent) {
    event.preventDefault();
    if (!itemName.trim()) return;

    setSaving(true);
    setErrorMessage("");

    const payload = {
      name: itemName.trim(),
      category: itemCategory,
      description: itemDescription.trim() || null,
      updated_at: new Date().toISOString(),
    };

    const result = editingItem
      ? await supabase
          .from("clothing_items")
          .update(payload)
          .eq("id", editingItem.id)
      : await supabase.from("clothing_items").insert(payload);

    setSaving(false);

    if (result.error) {
      console.error(result.error);
      setErrorMessage("Impossible d'enregistrer le vêtement.");
      return;
    }

    setCatalogueOpen(false);
    setSuccessMessage(
      editingItem ? "Vêtement modifié." : "Vêtement ajouté au catalogue."
    );
    await loadCatalogue();
  }

  async function toggleItem(item: ClothingItem) {
    const { error } = await supabase
      .from("clothing_items")
      .update({
        is_active: !item.is_active,
        updated_at: new Date().toISOString(),
      })
      .eq("id", item.id);

    if (error) {
      setErrorMessage("Impossible de modifier le vêtement.");
      return;
    }

    await loadCatalogue();
  }

  async function deleteItem(item: ClothingItem) {
    const confirmed = window.confirm(
      `Supprimer définitivement "${item.name}" du catalogue ?\n\nCette action n'est possible que si ce vêtement n'est utilisé dans aucune dotation ou demande.`
    );

    if (!confirmed) return;

    setSaving(true);
    setErrorMessage("");
    setSuccessMessage("");

    try {
      const [assignmentsResult, requestsResult] = await Promise.all([
        supabase
          .from("clothing_assignments")
          .select("id", { count: "exact", head: true })
          .eq("clothing_item_id", item.id),
        supabase
          .from("clothing_requests")
          .select("id", { count: "exact", head: true })
          .eq("clothing_item_id", item.id),
      ]);

      if (assignmentsResult.error) throw assignmentsResult.error;
      if (requestsResult.error) throw requestsResult.error;

      const assignmentCount = assignmentsResult.count ?? 0;
      const requestCount = requestsResult.count ?? 0;

      if (assignmentCount > 0 || requestCount > 0) {
        setErrorMessage(
          `Impossible de supprimer "${item.name}" : ce vêtement est encore lié à ${
            assignmentCount > 0
              ? `${assignmentCount} dotation${assignmentCount > 1 ? "s" : ""}`
              : ""
          }${
            assignmentCount > 0 && requestCount > 0 ? " et " : ""
          }${
            requestCount > 0
              ? `${requestCount} demande${requestCount > 1 ? "s" : ""}`
              : ""
          }. Retirez d'abord les dotations concernées. Pour conserver l'historique des demandes, vous pouvez simplement désactiver le vêtement.`
        );
        return;
      }

      const { error } = await supabase
        .from("clothing_items")
        .delete()
        .eq("id", item.id);

      if (error) throw error;

      setSuccessMessage(`"${item.name}" a été supprimé du catalogue.`);
      await loadCatalogue();
    } catch (error) {
      console.error("Suppression vêtement :", error);
      setErrorMessage(
        "Impossible de supprimer ce vêtement. Vérifiez qu'il n'est lié à aucune dotation ou demande."
      );
    } finally {
      setSaving(false);
    }
  }

  async function openRequest(request: ClothingRequest) {
    setSelectedRequest(request);
    setRequestStatus(request.status);
    setResolutionComment(request.resolution_comment ?? "");
    setRequestHistory([]);

    const { data, error } = await supabase
      .from("clothing_request_history")
      .select("*")
      .eq("request_id", request.id)
      .order("created_at", { ascending: true });

    if (!error) {
      setRequestHistory((data ?? []) as RequestHistory[]);
    }
  }

  async function saveRequestStatus() {
    if (!selectedRequest) return;

    if (
      (requestStatus === "traitee" ||
        requestStatus === "refusee") &&
      !resolutionComment.trim()
    ) {
      setErrorMessage(
        requestStatus === "traitee"
          ? "Un commentaire de traitement est demandé pour clôturer la demande."
          : "Merci d'indiquer la raison du refus."
      );
      return;
    }

    setSaving(true);
    setErrorMessage("");
    setSuccessMessage("");

    try {
      const previousStatus = selectedRequest.status;
      const now = new Date().toISOString();
      const isClosed =
        requestStatus === "traitee" || requestStatus === "refusee";

      const { error: updateError } = await supabase
        .from("clothing_requests")
        .update({
          status: requestStatus,
          resolution_comment:
            resolutionComment.trim() || null,
          handled_by: currentUserId,
          handled_at: isClosed ? now : null,
          updated_at: now,
        })
        .eq("id", selectedRequest.id);

      if (updateError) throw updateError;

      if (
        previousStatus !== requestStatus ||
        resolutionComment.trim() !==
          (selectedRequest.resolution_comment ?? "")
      ) {
        const { error: historyError } = await supabase
          .from("clothing_request_history")
          .insert({
            request_id: selectedRequest.id,
            previous_status: previousStatus,
            new_status: requestStatus,
            comment: resolutionComment.trim() || null,
            changed_by: currentUserId,
          });

        if (historyError) throw historyError;
      }

      setSelectedRequest(null);
      setSuccessMessage("Demande mise à jour.");
      await loadRequests();
    } catch (error) {
      console.error(error);
      setErrorMessage("Impossible de mettre à jour la demande.");
    } finally {
      setSaving(false);
    }
  }

  const filteredProfiles = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return profiles;

    return profiles.filter((profile) =>
      `${profile.first_name} ${profile.last_name} ${profile.grade ?? ""}`
        .toLowerCase()
        .includes(query)
    );
  }, [profiles, search]);

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

  const filteredHistoricalRequests = useMemo(() => {
    if (!historyAgentFilter) return historicalRequests;

    return historicalRequests.filter(
      (request) => request.profile_id === historyAgentFilter
    );
  }, [historicalRequests, historyAgentFilter]);

  const requestCounts = useMemo(() => {
    const counts: Record<RequestStatus, number> = {
      en_attente: 0,
      prise_en_compte: 0,
      en_cours_traitement: 0,
      traitee: 0,
      refusee: 0,
    };

    for (const request of requests) counts[request.status] += 1;
    return counts;
  }, [requests]);

  function profileRoles(profileId: string) {
    const codes = roleCodesByProfile[profileId] ?? [];
    const labels: string[] = [];
    if (codes.includes("sapeur_pompier")) labels.push("🚒 Sapeur-pompier");
    if (codes.includes("amicaliste")) labels.push("🤝 Amicaliste");
    return labels;
  }

  function itemAllowedForProfile(item: ClothingItem, profileId: string) {
    const codes = roleCodesByProfile[profileId] ?? [];
    if (item.category === "les_deux") return true;
    if (item.category === "sapeurs_pompiers")
      return codes.includes("sapeur_pompier");
    return codes.includes("amicaliste");
  }

  if (loading) {
    return (
      <main className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
        <p className="text-sm text-muted-foreground">
          Chargement du module habillement...
        </p>
      </main>
    );
  }

  if (!authorized) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-16 text-center sm:px-6">
        <div className="rounded-3xl border border-border bg-card p-8">
          <div className="text-4xl">🔒</div>
          <h1 className="mt-4 text-2xl font-black">Accès refusé</h1>
          <p className="mt-2 text-muted-foreground">
            Vous n&apos;avez pas l&apos;autorisation de gérer l&apos;habillement.
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
      <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-black uppercase tracking-[0.2em] text-red-600">
            Habillement
          </p>
          <h1 className="mt-2 text-3xl font-black sm:text-4xl">
            Gestion de l&apos;habillement
          </h1>
          <p className="mt-2 text-muted-foreground">
            Gérez les dotations, le catalogue et les demandes de changement.
          </p>
        </div>
      </div>

      {(errorMessage || successMessage) && (
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

      <div className="mt-8 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        {[
          ["personnel", "👥", "Personnel"],
          ["catalogue", "📦", "Catalogue"],
          ["demandes", "📨", "Demandes"],
          ["restitutions", "📦", "Restitutions"],
          ["historique", "📚", "Historique"],
        ].map(([value, icon, label]) => (
          <button
            key={value}
            type="button"
            onClick={() => setTab(value as Tab)}
            className={`rounded-2xl border px-5 py-4 text-left font-black transition ${
              tab === value
                ? "border-red-600 bg-red-600 text-white"
                : "border-border bg-card hover:border-red-500"
            }`}
          >
            <span className="mr-2">{icon}</span>
            {label}
            {value === "demandes" && activeRequests.length > 0 && (
              <span className="ml-2 rounded-full bg-white/20 px-2 py-0.5 text-xs">
                {activeRequests.length}
              </span>
            )}
            {value === "restitutions" && returns.length > 0 && (
              <span className="ml-2 rounded-full bg-white/20 px-2 py-0.5 text-xs">
                {returns.length}
              </span>
            )}
            {value === "historique" && historicalRequests.length > 0 && (
              <span className="ml-2 rounded-full bg-white/20 px-2 py-0.5 text-xs">
                {historicalRequests.length}
              </span>
            )}
          </button>
        ))}
      </div>

      {tab === "personnel" && (
        <section className="mt-6">
          <div className="rounded-3xl border border-border bg-card p-5 sm:p-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-xl font-black">Personnel</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Sapeurs-pompiers et amicalistes actifs.
                </p>
              </div>
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="🔎 Rechercher un nom ou un grade..."
                className="min-h-12 w-full rounded-xl border border-border bg-background px-4 outline-none focus:border-red-500 sm:max-w-md"
              />
            </div>

            <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {filteredProfiles.map((profile) => (
                <button
                  key={profile.id}
                  type="button"
                  onClick={() => void openProfile(profile)}
                  className="rounded-2xl border border-border p-5 text-left transition hover:border-red-500 hover:bg-muted/30"
                >
                  <p className="text-lg font-black">{fullName(profile)}</p>
                  {profile.grade && (
                    <p className="mt-1 text-sm text-red-600">{profile.grade}</p>
                  )}
                  <div className="mt-3 flex flex-wrap gap-2">
                    {profileRoles(profile.id).map((label) => (
                      <span
                        key={label}
                        className="rounded-full bg-muted px-3 py-1 text-xs font-bold"
                      >
                        {label}
                      </span>
                    ))}
                  </div>
                  <p className="mt-4 text-sm font-bold text-muted-foreground">
                    Voir la dotation →
                  </p>
                </button>
              ))}
            </div>

            {filteredProfiles.length === 0 && (
              <p className="mt-8 text-center text-sm text-muted-foreground">
                Aucun personnel correspondant.
              </p>
            )}
          </div>
        </section>
      )}

      {tab === "catalogue" && (
        <section className="mt-6 rounded-3xl border border-border bg-card p-5 sm:p-6">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h2 className="text-xl font-black">Catalogue</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Créez les vêtements disponibles à la dotation.
              </p>
            </div>
            <button
              type="button"
              onClick={openCreateItem}
              className="rounded-xl bg-red-600 px-4 py-3 text-sm font-black text-white hover:bg-red-700"
            >
              + Ajouter
            </button>
          </div>

          <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {items.map((item) => (
              <article
                key={item.id}
                className={`rounded-2xl border border-border p-5 ${
                  !item.is_active ? "opacity-55" : ""
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <span className="text-2xl">👕</span>
                    <h3 className="mt-2 text-lg font-black">{item.name}</h3>
                    <p className="mt-1 text-xs font-bold uppercase text-red-600">
                      {CATEGORY_LABELS[item.category]}
                    </p>
                  </div>
                  <span className="rounded-full bg-muted px-2 py-1 text-xs font-bold">
                    {item.is_active ? "Actif" : "Inactif"}
                  </span>
                </div>
                {item.description && (
                  <p className="mt-3 text-sm text-muted-foreground">
                    {item.description}
                  </p>
                )}
                <div className="mt-5 flex gap-2">
                  <button
                    type="button"
                    onClick={() => openEditItem(item)}
                    className="rounded-xl border border-border px-3 py-2 text-sm font-bold"
                  >
                    ✏️ Modifier
                  </button>
                  <button
                    type="button"
                    onClick={() => void toggleItem(item)}
                    className="rounded-xl border border-border px-3 py-2 text-sm font-bold"
                  >
                    {item.is_active ? "Désactiver" : "Réactiver"}
                  </button>
                  <button
                    type="button"
                    onClick={() => void deleteItem(item)}
                    disabled={saving}
                    className="rounded-xl border border-red-500/30 px-3 py-2 text-sm font-bold text-red-600 transition hover:bg-red-500/10 disabled:opacity-50"
                  >
                    🗑️ Supprimer
                  </button>
                </div>
              </article>
            ))}
          </div>

          {items.length === 0 && (
            <div className="mt-6 rounded-2xl border border-dashed border-border p-8 text-center">
              <div className="text-3xl">📦</div>
              <p className="mt-2 font-black">Catalogue vide</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Ajoutez votre premier vêtement.
              </p>
            </div>
          )}
        </section>
      )}

      {tab === "demandes" && (
        <section className="mt-6">
          <div className="grid gap-3 sm:grid-cols-3">
            {(["en_attente", "prise_en_compte", "en_cours_traitement"] as RequestStatus[]).map((status) => (
              <div
                key={status}
                className="rounded-2xl border border-border bg-card p-4"
              >
                <p className="text-sm font-bold text-muted-foreground">
                  {STATUS_ICONS[status]} {STATUS_LABELS[status]}
                </p>
                <p className="mt-2 text-2xl font-black">
                  {requestCounts[status]}
                </p>
              </div>
            ))}
          </div>

          <div className="mt-5 overflow-hidden rounded-3xl border border-border bg-card">
            {activeRequests.length === 0 ? (
              <div className="p-10 text-center">
                <div className="text-3xl">📨</div>
                <p className="mt-2 font-black">Aucune demande en cours</p>
              </div>
            ) : (
              <div className="divide-y divide-border">
                {activeRequests.map((request) => {
                  const profile = profiles.find(
                    (candidate) => candidate.id === request.profile_id
                  );
                  const item = relationOne(request.clothing_items);

                  return (
                    <button
                      key={request.id}
                      type="button"
                      onClick={() => void openRequest(request)}
                      className="flex w-full flex-col gap-3 p-5 text-left transition hover:bg-muted/30 sm:flex-row sm:items-center"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="font-black">
                          {fullName(profile)}
                        </p>
                        <p className="mt-1 text-sm text-muted-foreground">
                          {item?.name ?? "Vêtement"} ·{" "}
                          {request.reason.replaceAll("_", " ")}
                        </p>
                      </div>
                      <span className="rounded-full bg-muted px-3 py-1.5 text-xs font-black">
                        {STATUS_ICONS[request.status]}{" "}
                        {STATUS_LABELS[request.status]}
                      </span>
                      <span className="text-sm text-muted-foreground">
                        {formatDateTime(request.created_at)}
                      </span>
                      <span className="text-xl">›</span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </section>
      )}


      {tab === "restitutions" && (
        <section className="mt-6">
          <div className="rounded-3xl border border-border bg-card p-5 sm:p-6">
            <div>
              <h2 className="text-xl font-black">📦 Restitutions à effectuer</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Les comptes ci-dessous sont bloqués jusqu&apos;à la clôture de leur dotation.
              </p>
            </div>

            {returns.length === 0 ? (
              <div className="mt-6 rounded-2xl border border-dashed border-border p-10 text-center">
                <div className="text-3xl">✅</div>
                <p className="mt-2 font-black">Aucune restitution en attente</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Aucun départ ne nécessite actuellement de restitution habillement.
                </p>
              </div>
            ) : (
              <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {returns.map((clothingReturn) => (
                  <button
                    key={clothingReturn.id}
                    type="button"
                    onClick={() => void openReturn(clothingReturn)}
                    className="rounded-2xl border border-border p-5 text-left transition hover:border-red-500 hover:bg-muted/30"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-lg font-black">
                          {`${clothingReturn.first_name ?? ""} ${clothingReturn.last_name ?? ""}`.trim() ||
                            "Ancien utilisateur"}
                        </p>
                        {clothingReturn.grade && (
                          <p className="mt-1 text-sm text-red-600">
                            {clothingReturn.grade}
                          </p>
                        )}
                      </div>
                      <span
                        className={`rounded-full px-3 py-1 text-xs font-black ${
                          clothingReturn.status === "pret_suppression"
                            ? "bg-emerald-500/10 text-emerald-600"
                            : "bg-amber-500/10 text-amber-600"
                        }`}
                      >
                        {clothingReturn.status === "a_restituer"
                          ? "À restituer"
                          : clothingReturn.status === "pret_suppression"
                            ? "Prêt à supprimer"
                            : "En cours"}
                      </span>
                    </div>

                    <p className="mt-4 text-sm text-muted-foreground">
                      Départ lancé le {formatDateTime(clothingReturn.started_at)}
                    </p>
                    {clothingReturn.status === "pret_suppression" ? (
                      <button
                        type="button"
                        disabled={saving}
                        onClick={(event) => {
                          event.stopPropagation();
                          void finalizeReturn(clothingReturn);
                        }}
                        className="mt-3 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-black text-white disabled:opacity-50"
                      >
                        {saving
                          ? "Finalisation..."
                          : "Finaliser la suppression du compte"}
                      </button>
                    ) : (
                      <p className="mt-3 text-sm font-black text-red-600">
                        Gérer la restitution →
                      </p>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>
        </section>
      )}


      {tab === "historique" && (
        <section className="mt-6">
          <div className="mb-5 rounded-3xl border border-border bg-card p-5 sm:p-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <h2 className="text-xl font-black">📚 Historique des demandes</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Filtrez les demandes terminées par agent.
                </p>
              </div>

              <div className="w-full sm:max-w-sm">
                <label className="mb-2 block text-xs font-black uppercase tracking-wider text-muted-foreground">
                  Agent
                </label>
                <select
                  value={historyAgentFilter}
                  onChange={(event) => setHistoryAgentFilter(event.target.value)}
                  className="min-h-12 w-full rounded-xl border border-border bg-background px-4"
                >
                  <option value="">Tous les agents</option>
                  {profiles
                    .slice()
                    .sort((a, b) =>
                      fullName(a).localeCompare(fullName(b), "fr")
                    )
                    .map((profile) => (
                      <option key={profile.id} value={profile.id}>
                        {fullName(profile)}
                        {profile.grade ? ` — ${profile.grade}` : ""}
                      </option>
                    ))}
                </select>
              </div>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            {(["traitee", "refusee"] as RequestStatus[]).map((status) => (
              <div
                key={status}
                className="rounded-2xl border border-border bg-card p-4"
              >
                <p className="text-sm font-bold text-muted-foreground">
                  {STATUS_ICONS[status]} {STATUS_LABELS[status]}
                </p>
                <p className="mt-2 text-2xl font-black">
                  {requestCounts[status]}
                </p>
              </div>
            ))}
          </div>

          <div className="mt-5 overflow-hidden rounded-3xl border border-border bg-card">
            {filteredHistoricalRequests.length === 0 ? (
              <div className="p-10 text-center">
                <div className="text-3xl">📚</div>
                <p className="mt-2 font-black">
                  {historyAgentFilter
                    ? "Aucune demande terminée pour cet agent"
                    : "Historique vide"}
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Les demandes traitées ou refusées apparaîtront ici.
                </p>
              </div>
            ) : (
              <div className="divide-y divide-border">
                {filteredHistoricalRequests.map((request) => {
                  const profile = profiles.find(
                    (candidate) => candidate.id === request.profile_id
                  );
                  const item = relationOne(request.clothing_items);

                  return (
                    <button
                      key={request.id}
                      type="button"
                      onClick={() => void openRequest(request)}
                      className="flex w-full flex-col gap-3 p-5 text-left transition hover:bg-muted/30 sm:flex-row sm:items-center"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="font-black">
                          {fullName(profile)}
                        </p>
                        <p className="mt-1 text-sm text-muted-foreground">
                          {item?.name ?? "Vêtement"} ·{" "}
                          {request.reason.replaceAll("_", " ")}
                        </p>
                        {request.resolution_comment && (
                          <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">
                            💬 {request.resolution_comment}
                          </p>
                        )}
                      </div>

                      <span className="rounded-full bg-muted px-3 py-1.5 text-xs font-black">
                        {STATUS_ICONS[request.status]}{" "}
                        {STATUS_LABELS[request.status]}
                      </span>

                      <span className="text-sm text-muted-foreground">
                        {formatDateTime(request.handled_at ?? request.updated_at)}
                      </span>

                      <span className="text-xl">›</span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </section>
      )}

      {selectedReturn && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/70 p-4 sm:p-8">
          <div className="w-full max-w-4xl rounded-3xl border border-border bg-card p-5 shadow-2xl sm:p-7">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-black uppercase tracking-widest text-red-600">
                  Restitution habillement
                </p>
                <h2 className="mt-2 text-2xl font-black">
                  {`${selectedReturn.first_name ?? ""} ${selectedReturn.last_name ?? ""}`.trim() ||
                    "Ancien utilisateur"}
                </h2>
                {selectedReturn.grade && (
                  <p className="mt-1 text-sm text-muted-foreground">
                    {selectedReturn.grade}
                  </p>
                )}
              </div>
              <button
                type="button"
                onClick={() => {
                  setSelectedReturn(null);
                  setReturnItemBeingHandled(null);
                }}
                className="rounded-xl border border-border px-4 py-2 font-black"
              >
                ✕
              </button>
            </div>

            <div className="mt-6 rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4">
              <p className="font-black text-amber-700 dark:text-amber-300">
                🔒 Compte utilisateur bloqué
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                Confirmez chaque élément. Un commentaire est obligatoire pour un vêtement non rendu.
              </p>
            </div>

            <div className="mt-6 space-y-3">
              {returnItems.map((item) => (
                <div
                  key={item.id}
                  className="rounded-2xl border border-border p-4"
                >
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
                    <div className="min-w-0 flex-1">
                      <p className="font-black">👕 {item.clothing_name}</p>
                      <p className="mt-1 text-sm text-muted-foreground">
                        Taille : <strong>{item.size || "—"}</strong> · Quantité :{" "}
                        <strong>{item.quantity}</strong>
                      </p>
                      {item.comment && (
                        <p className="mt-2 text-sm text-muted-foreground">
                          💬 {item.comment}
                        </p>
                      )}
                    </div>

                    {item.status === "a_restituer" ? (
                      <div className="flex shrink-0 gap-2">
                        <button
                          type="button"
                          onClick={() => prepareReturnDecision(item, "rendu")}
                          className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-black text-white"
                        >
                          ✅ Rendu
                        </button>
                        <button
                          type="button"
                          onClick={() => prepareReturnDecision(item, "non_rendu")}
                          className="rounded-xl border border-red-500/40 px-4 py-2 text-sm font-black text-red-600"
                        >
                          ⚠️ Non rendu
                        </button>
                      </div>
                    ) : (
                      <span
                        className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-black ${
                          item.status === "rendu"
                            ? "bg-emerald-500/10 text-emerald-600"
                            : "bg-red-500/10 text-red-600"
                        }`}
                      >
                        {item.status === "rendu" ? "✅ Rendu" : "⚠️ Non rendu"}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {returnItemBeingHandled && (
              <div className="mt-6 rounded-2xl border border-border bg-muted/20 p-5">
                <h3 className="font-black">
                  {returnDecision === "rendu"
                    ? "✅ Confirmer le retour"
                    : "⚠️ Déclarer non rendu"}
                </h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  {returnItemBeingHandled.clothing_name} · Taille{" "}
                  {returnItemBeingHandled.size || "—"} · x
                  {returnItemBeingHandled.quantity}
                </p>

                <label className="mt-4 block text-sm font-black">
                  {returnDecision === "non_rendu"
                    ? "Commentaire obligatoire *"
                    : "Commentaire facultatif"}
                </label>
                <textarea
                  value={returnComment}
                  onChange={(event) => setReturnComment(event.target.value)}
                  rows={3}
                  placeholder={
                    returnDecision === "non_rendu"
                      ? "Ex. vêtement perdu, non restitué..."
                      : "Ex. restitution complète, bon état..."
                  }
                  className="mt-2 w-full rounded-xl border border-border bg-background p-4"
                />

                <div className="mt-4 flex justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      setReturnItemBeingHandled(null);
                      setReturnComment("");
                    }}
                    className="rounded-xl border border-border px-4 py-2 font-black"
                  >
                    Annuler
                  </button>
                  <button
                    type="button"
                    onClick={() => void validateReturnItem()}
                    disabled={saving}
                    className={`rounded-xl px-4 py-2 font-black text-white disabled:opacity-50 ${
                      returnDecision === "rendu"
                        ? "bg-emerald-600"
                        : "bg-red-600"
                    }`}
                  >
                    {saving ? "Enregistrement..." : "Confirmer"}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}


      {selectedProfile && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/70 p-4 sm:p-8">
          <div className="w-full max-w-4xl rounded-3xl border border-border bg-card p-5 shadow-2xl sm:p-7">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-black uppercase tracking-widest text-red-600">
                  Dotation
                </p>
                <h2 className="mt-2 text-2xl font-black">
                  {fullName(selectedProfile)}
                </h2>
                <div className="mt-2 flex flex-wrap gap-2">
                  {profileRoles(selectedProfile.id).map((label) => (
                    <span
                      key={label}
                      className="rounded-full bg-muted px-3 py-1 text-xs font-bold"
                    >
                      {label}
                    </span>
                  ))}
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedProfile(null)}
                className="rounded-xl border border-border px-4 py-2 font-black"
              >
                ✕
              </button>
            </div>

            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              {assignments.map((assignment) => {
                const item = relationOne(assignment.clothing_items);
                return (
                  <div
                    key={assignment.id}
                    className="rounded-2xl border border-border p-4"
                  >
                    <div className="flex justify-between gap-3">
                      <div>
                        <p className="font-black">
                          👕 {item?.name ?? "Vêtement"}
                        </p>
                        <p className="mt-2 text-sm">
                          Taille :{" "}
                          <strong>{assignment.size || "—"}</strong>
                        </p>
                        <p className="mt-1 text-sm">
                          Quantité : <strong>{assignment.quantity}</strong>
                        </p>
                        {assignment.notes && (
                          <p className="mt-2 text-sm text-muted-foreground">
                            {assignment.notes}
                          </p>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={() => void removeAssignment(assignment)}
                        className="h-10 rounded-xl border border-red-500/30 px-3 text-red-600"
                      >
                        🗑️
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            {assignments.length === 0 && (
              <p className="mt-6 rounded-2xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
                Aucune dotation enregistrée.
              </p>
            )}

            <form
              onSubmit={saveAssignment}
              className="mt-7 border-t border-border pt-6"
            >
              <h3 className="font-black">Ajouter / modifier une dotation</h3>

              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <select
                  required
                  value={assignmentItemId}
                  onChange={(event) =>
                    setAssignmentItemId(event.target.value)
                  }
                  className="min-h-12 rounded-xl border border-border bg-background px-4"
                >
                  <option value="">Choisir un vêtement</option>
                  {items
                    .filter(
                      (item) =>
                        item.is_active &&
                        itemAllowedForProfile(item, selectedProfile.id)
                    )
                    .map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.name} — {CATEGORY_LABELS[item.category]}
                      </option>
                    ))}
                </select>

                <input
                  value={assignmentSize}
                  onChange={(event) => setAssignmentSize(event.target.value)}
                  placeholder="Taille (ex. M, L, 42...)"
                  className="min-h-12 rounded-xl border border-border bg-background px-4"
                />

                <input
                  type="number"
                  min={0}
                  value={assignmentQuantity}
                  onChange={(event) =>
                    setAssignmentQuantity(Number(event.target.value))
                  }
                  placeholder="Quantité"
                  className="min-h-12 rounded-xl border border-border bg-background px-4"
                />

                <input
                  value={assignmentNotes}
                  onChange={(event) => setAssignmentNotes(event.target.value)}
                  placeholder="Note facultative"
                  className="min-h-12 rounded-xl border border-border bg-background px-4"
                />
              </div>

              <button
                type="submit"
                disabled={saving}
                className="mt-4 rounded-xl bg-red-600 px-5 py-3 font-black text-white disabled:opacity-50"
              >
                {saving ? "Enregistrement..." : "Enregistrer la dotation"}
              </button>
            </form>
          </div>
        </div>
      )}

      {catalogueOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <form
            onSubmit={saveItem}
            className="w-full max-w-xl rounded-3xl border border-border bg-card p-6 shadow-2xl"
          >
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs font-black uppercase tracking-widest text-red-600">
                  Catalogue
                </p>
                <h2 className="mt-2 text-2xl font-black">
                  {editingItem ? "Modifier le vêtement" : "Ajouter un vêtement"}
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setCatalogueOpen(false)}
                className="rounded-xl border border-border px-3 py-2"
              >
                ✕
              </button>
            </div>

            <label className="mt-6 block text-sm font-black">Nom *</label>
            <input
              required
              value={itemName}
              onChange={(event) => setItemName(event.target.value)}
              placeholder="Ex. Polo SP"
              className="mt-2 min-h-12 w-full rounded-xl border border-border bg-background px-4"
            />

            <label className="mt-5 block text-sm font-black">Catégorie *</label>
            <div className="mt-2 grid gap-2 sm:grid-cols-3">
              {(
                [
                  ["sapeurs_pompiers", "🚒", "Sapeurs-pompiers"],
                  ["amicale", "🤝", "Amicale"],
                  ["les_deux", "🚒🤝", "Les deux"],
                ] as const
              ).map(([value, icon, label]) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setItemCategory(value)}
                  className={`rounded-xl border p-3 text-left text-sm font-bold ${
                    itemCategory === value
                      ? "border-red-600 bg-red-500/10"
                      : "border-border"
                  }`}
                >
                  <span className="block text-xl">{icon}</span>
                  <span className="mt-1 block">{label}</span>
                </button>
              ))}
            </div>

            <label className="mt-5 block text-sm font-black">Description</label>
            <textarea
              value={itemDescription}
              onChange={(event) => setItemDescription(event.target.value)}
              rows={4}
              placeholder="Description facultative..."
              className="mt-2 w-full rounded-xl border border-border bg-background p-4"
            />

            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setCatalogueOpen(false)}
                className="rounded-xl border border-border px-5 py-3 font-black"
              >
                Annuler
              </button>
              <button
                type="submit"
                disabled={saving}
                className="rounded-xl bg-red-600 px-5 py-3 font-black text-white disabled:opacity-50"
              >
                Enregistrer
              </button>
            </div>
          </form>
        </div>
      )}

      {selectedRequest && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/70 p-4 sm:p-8">
          <div className="w-full max-w-3xl rounded-3xl border border-border bg-card p-6 shadow-2xl">
            <div className="flex justify-between gap-4">
              <div>
                <p className="text-xs font-black uppercase tracking-widest text-red-600">
                  Demande habillement
                </p>
                <h2 className="mt-2 text-2xl font-black">
                  {relationOne(selectedRequest.clothing_items)?.name ??
                    "Vêtement"}
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setSelectedRequest(null)}
                className="rounded-xl border border-border px-3 py-2"
              >
                ✕
              </button>
            </div>

            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              <Info label="Motif" value={selectedRequest.reason} />
              <Info
                label="Quantité"
                value={String(selectedRequest.quantity)}
              />
              <Info
                label="Taille actuelle"
                value={selectedRequest.current_size || "—"}
              />
              <Info
                label="Taille souhaitée"
                value={selectedRequest.requested_size || "—"}
              />
            </div>

            {selectedRequest.user_comment && (
              <div className="mt-4 rounded-2xl border border-border p-4">
                <p className="text-xs font-bold uppercase text-muted-foreground">
                  Commentaire du demandeur
                </p>
                <p className="mt-2 whitespace-pre-wrap">
                  {selectedRequest.user_comment}
                </p>
              </div>
            )}

            <label className="mt-6 block text-sm font-black">Statut</label>
            <select
              value={requestStatus}
              onChange={(event) =>
                setRequestStatus(event.target.value as RequestStatus)
              }
              className="mt-2 min-h-12 w-full rounded-xl border border-border bg-background px-4"
            >
              {(Object.keys(STATUS_LABELS) as RequestStatus[]).map((status) => (
                <option key={status} value={status}>
                  {STATUS_ICONS[status]} {STATUS_LABELS[status]}
                </option>
              ))}
            </select>

            <label className="mt-5 block text-sm font-black">
              {requestStatus === "traitee"
                ? "Commentaire de traitement *"
                : requestStatus === "refusee"
                  ? "Motif du refus *"
                  : "Commentaire du responsable"}
            </label>
            <textarea
              value={resolutionComment}
              onChange={(event) =>
                setResolutionComment(event.target.value)
              }
              rows={4}
              placeholder="Ex. Pantalon remplacé par une taille 42 et remis le..."
              className="mt-2 w-full rounded-xl border border-border bg-background p-4"
            />

            <div className="mt-6 border-t border-border pt-5">
              <h3 className="font-black">Historique</h3>
              {requestHistory.length === 0 ? (
                <p className="mt-3 text-sm text-muted-foreground">
                  Aucun changement enregistré.
                </p>
              ) : (
                <div className="mt-3 space-y-3">
                  {requestHistory.map((history) => (
                    <div
                      key={history.id}
                      className="rounded-xl bg-muted/40 p-3 text-sm"
                    >
                      <p className="font-bold">
                        {history.previous_status
                          ? `${history.previous_status} → `
                          : ""}
                        {history.new_status}
                      </p>
                      {history.comment && (
                        <p className="mt-1 text-muted-foreground">
                          {history.comment}
                        </p>
                      )}
                      <p className="mt-1 text-xs text-muted-foreground">
                        {formatDateTime(history.created_at)}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setSelectedRequest(null)}
                className="rounded-xl border border-border px-5 py-3 font-black"
              >
                Fermer
              </button>
              <button
                type="button"
                onClick={() => void saveRequestStatus()}
                disabled={saving}
                className="rounded-xl bg-red-600 px-5 py-3 font-black text-white disabled:opacity-50"
              >
                {saving ? "Enregistrement..." : "Enregistrer"}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

function Info({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-2xl border border-border p-4">
      <p className="text-xs font-bold uppercase text-muted-foreground">
        {label}
      </p>
      <p className="mt-1 font-black capitalize">
        {value.replaceAll("_", " ")}
      </p>
    </div>
  );
}