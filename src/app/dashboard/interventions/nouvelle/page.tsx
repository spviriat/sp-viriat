"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  ArrowLeft,
  Building2,
  Check,
  Clock3,
  FileText,
  Flame,
  MapPin,
  Plus,
  Save,
  Shield,
  Trash2,
  Truck,
  UserPlus,
  Users,
} from "lucide-react";

import { supabase } from "@/lib/supabase";

/* =========================================================
   TYPES
========================================================= */

type CategoryKey =
  | "secours_personne"
  | "incendie"
  | "avp"
  | "divers";

type GuardPerson = {
  profile_id: string;
  first_name: string | null;
  last_name: string | null;
  guard_type: string;
};

type Observer = {
  profile_id: string;
  first_name: string | null;
  last_name: string | null;
};

type ProfileOption = {
  id: string;
  first_name: string | null;
  last_name: string | null;
};

type SelectedPerson = {
  profileId: string;
  firstName: string;
  lastName: string;
  roleEngagement: string;
  origine: "garde" | "manuel" | "observateur";
};

type VictimDetail = {
  etat: "" | "indemne" | "blesse_leger" | "blesse_grave" | "decede";
  informations: string;
};

type FormState = {
  numeroCodis: string;
  dateIntervention: string;
  heureBip: string;
  heureDepart: string;
  dateRetour: string;
  heureRetour: string;

  categorie: CategoryKey | "";
  sousType: string;

  adresse: string;
  lieu: string;

  nombreVictimes: number;
  victimesDetails: VictimDetail[];

  moyensExterieurs: string[];
  autreMoyenExterieur: string;
  compteRendu: string;
};

/* =========================================================
   CONFIGURATION
========================================================= */

const interventionTypes: Record<
  CategoryKey,
  {
    label: string;
    icon: typeof Flame;
    subtypes: string[];
  }
> = {
  secours_personne: {
    label: "Secours à personne",
    icon: Users,
    subtypes: [
      "SAP Simple",
      "SAP Grave",
      "ACR",
    ],
  },

  incendie: {
    label: "Incendie",
    icon: Flame,
    subtypes: [
      "Feu d'habitation",
      "Feu industriel",
      "Feu de VL",
      "Feu PL non TMD",
      "Feu PL TMD",
      "Feu de végétation",
      "Feu de poubelle",
      "Feu de cheminée",
      "Autre",
    ],
  },

  avp: {
    label: "Accident voie publique",
    icon: Truck,
    subtypes: [
      "AVP Simple",
      "AVP avec incarcéré",
    ],
  },

  divers: {
    label: "Divers",
    icon: Shield,
    subtypes: [
      "Hyménoptère",
      "Inondation",
      "Manœuvre",
      "Capture d'animaux",
    ],
  },
};

const vehicles = [
  "VPI",
  "FPT",
  "VL",
] as const;

const externalResources = [
  "CSP",
  "SMUR",
  "Forces de l'ordre",
  "Mairie",
  "Autre",
] as const;

/* =========================================================
   HELPERS
========================================================= */

function today() {
  const now = new Date();

  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function currentTime() {
  const now = new Date();

  return `${String(now.getHours()).padStart(2, "0")}:${String(
    now.getMinutes()
  ).padStart(2, "0")}`;
}

function displayName(
  firstName: string | null,
  lastName: string | null
) {
  const value = `${firstName ?? ""} ${lastName ?? ""}`.trim();

  return value || "Pompier";
}

function getGuardRoleLabel(type: string) {
  if (type === "first_departure") {
    return "premier_depart";
  }

  if (type === "second_departure") {
    return "deuxieme_depart";
  }

  return "equipier";
}

/* =========================================================
   PAGE
========================================================= */

export default function NewInterventionPage() {
  const router = useRouter();

  const [userId, setUserId] = useState<string | null>(null);
  const [isObserver, setIsObserver] = useState(false);
  const [accessChecked, setAccessChecked] = useState(false);

  const [form, setForm] = useState<FormState>({
    numeroCodis: "",
    dateIntervention: today(),
    heureBip: currentTime(),
    heureDepart: currentTime(),
    dateRetour: today(),
    heureRetour: "",

    categorie: "",
    sousType: "",

    adresse: "",
    lieu: "",

    nombreVictimes: 0,
    victimesDetails: [],

    moyensExterieurs: [],
    autreMoyenExterieur: "",
    compteRendu: "",
  });

  const [selectedVehicles, setSelectedVehicles] = useState<string[]>([]);

  const [personnel, setPersonnel] = useState<SelectedPerson[]>([]);

  const [profiles, setProfiles] = useState<ProfileOption[]>([]);

  const [manualProfileId, setManualProfileId] = useState("");

  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingGuard, setIsLoadingGuard] = useState(false);
  const [isLoadingObserver, setIsLoadingObserver] = useState(false);

  const [isSaving, setIsSaving] = useState(false);

  const [errorMessage, setErrorMessage] = useState("");
  const [guardMessage, setGuardMessage] = useState("");

  const [confirmValidation, setConfirmValidation] = useState(false);

  /* =======================================================
     AUTH + PROFILS
  ======================================================= */

  useEffect(() => {
    const load = async () => {
      setIsLoading(true);

      try {
        const {
          data: { session },
          error,
        } = await supabase.auth.getSession();

        if (error || !session) {
          router.replace("/");
          return;
        }

        setUserId(session.user.id);

        // Vérifie si l'utilisateur possède le rôle métier Observateur.
        const { data: businessRoleRows, error: businessRoleError } =
          await supabase
            .from("profile_business_roles")
            .select(
              `
              business_roles (
                code
              )
            `
            )
            .eq("profile_id", session.user.id);

        if (businessRoleError) {
          throw new Error(
            businessRoleError.message ||
              "Impossible de vérifier les droits d'accès."
          );
        }

        const roleCodes = (businessRoleRows ?? [])
          .map((row: any) => {
            const role = Array.isArray(row.business_roles)
              ? row.business_roles[0]
              : row.business_roles;

            return role?.code ?? null;
          })
          .filter(Boolean);

        const observer = roleCodes.includes("observateur");

        setIsObserver(observer);
        setAccessChecked(true);

        if (observer) {
          return;
        }

        /*
         * Liste des pompiers pour l'ajout manuel.
         *
         * Si ta table profiles contient des comptes autres que
         * les pompiers, on pourra ensuite ajouter un filtre.
         */
        const profilesResult = await supabase
          .from("profiles")
          .select("id, first_name, last_name")
          .order("last_name", { ascending: true });

        if (profilesResult.error) {
          console.error(
            "Erreur chargement profils :",
            profilesResult.error
          );
        } else {
          setProfiles(
            (profilesResult.data ?? []) as ProfileOption[]
          );
        }
      } finally {
        setIsLoading(false);
      }
    };

    void load();
  }, [router]);

  /* =======================================================
     FORM
  ======================================================= */

  const updateForm = <K extends keyof FormState>(
    key: K,
    value: FormState[K]
  ) => {
    setForm((previous) => ({
      ...previous,
      [key]: value,
    }));
  };

  const updateVictimCount = (count: number) => {
    const safeCount = Math.max(0, Math.floor(count || 0));

    setForm((previous) => {
      const nextVictims = Array.from(
        { length: safeCount },
        (_, index) =>
          previous.victimesDetails[index] ?? {
            etat: "",
            informations: "",
          }
      );

      return {
        ...previous,
        nombreVictimes: safeCount,
        victimesDetails: nextVictims,
      };
    });
  };

  const updateVictim = (
    index: number,
    patch: Partial<VictimDetail>
  ) => {
    setForm((previous) => ({
      ...previous,
      victimesDetails: previous.victimesDetails.map(
        (victim, victimIndex) =>
          victimIndex === index
            ? { ...victim, ...patch }
            : victim
      ),
    }));
  };

  const selectedCategory = useMemo(() => {
    if (!form.categorie) {
      return null;
    }

    return interventionTypes[form.categorie];
  }, [form.categorie]);

  const changeInterventionDate = (value: string) => {
    setForm((previous) => ({
      ...previous,
      dateIntervention: value,
      // À la création, le retour reste le même jour par défaut.
      // Si l'utilisateur avait encore la même date de retour que l'ancienne
      // date d'intervention, on la décale avec la nouvelle date.
      dateRetour:
        !previous.dateRetour ||
        previous.dateRetour === previous.dateIntervention
          ? value
          : previous.dateRetour,
    }));
  };

  /* =======================================================
     PERSONNEL DE GARDE AUTOMATIQUE
  ======================================================= */

  const loadGuardPersonnel = useCallback(async () => {
    if (
      !form.dateIntervention ||
      !form.heureDepart ||
      !form.categorie
    ) {
      setPersonnel((current) =>
        current.filter((person) => person.origine !== "garde")
      );

      setGuardMessage("");
      return;
    }

    setIsLoadingGuard(true);
    setGuardMessage("");

    try {
      const { data, error } = await supabase.rpc(
        "get_intervention_guard_personnel",
        {
          intervention_date: form.dateIntervention,
          intervention_time: `${form.heureDepart}:00`,
          intervention_category: form.categorie,
        }
      );

      if (error) {
        throw error;
      }

      const guardPeople = (data ?? []) as GuardPerson[];

      const automaticPersonnel: SelectedPerson[] = guardPeople.map(
        (person) => ({
          profileId: person.profile_id,
          firstName: person.first_name ?? "",
          lastName: person.last_name ?? "",
          roleEngagement: getGuardRoleLabel(person.guard_type),
          origine: "garde",
        })
      );

      /*
       * On remplace uniquement le personnel automatique.
       * Les ajouts manuels et l'observateur sont conservés.
       */
      setPersonnel((current) => {
        const manuallyAdded = current.filter(
          (person) => person.origine !== "garde"
        );

        const manualIds = new Set(
          manuallyAdded.map((person) => person.profileId)
        );

        return [
          ...automaticPersonnel.filter(
            (person) => !manualIds.has(person.profileId)
          ),
          ...manuallyAdded,
        ];
      });

      if (automaticPersonnel.length === 0) {
        const hour = Number(form.heureDepart.slice(0, 2));

        if (hour >= 7 && hour < 19) {
          setGuardMessage(
            "Intervention en journée : aucun pompier n'est ajouté automatiquement."
          );
        } else {
          setGuardMessage(
            "Aucun personnel de garde trouvé pour ce départ."
          );
        }
      } else {
        setGuardMessage(
          `${automaticPersonnel.length} pompier${
            automaticPersonnel.length > 1 ? "s" : ""
          } ajouté${
            automaticPersonnel.length > 1 ? "s" : ""
          } automatiquement depuis la garde.`
        );
      }
    } catch (error) {
      console.error("Erreur personnel garde :", error);

      setGuardMessage(
        "Impossible de récupérer automatiquement le personnel de garde."
      );
    } finally {
      setIsLoadingGuard(false);
    }
  }, [
    form.categorie,
    form.dateIntervention,
    form.heureDepart,
  ]);

  useEffect(() => {
    void loadGuardPersonnel();
  }, [loadGuardPersonnel]);

  /* =======================================================
     OBSERVATEUR
  ======================================================= */

  const addObserver = async () => {
    if (!form.dateIntervention || !form.heureDepart) {
      return;
    }

    setIsLoadingObserver(true);
    setErrorMessage("");

    try {
      const { data, error } = await supabase.rpc(
        "get_intervention_observer",
        {
          intervention_date: form.dateIntervention,
          intervention_time: `${form.heureDepart}:00`,
        }
      );

      if (error) {
        throw error;
      }

      const rows = (data ?? []) as Observer[];

      if (rows.length === 0) {
        setErrorMessage(
          "Aucun observateur prévu pour cette garde."
        );
        return;
      }

      const observer = rows[0];

      setPersonnel((current) => {
        if (
          current.some(
            (person) => person.profileId === observer.profile_id
          )
        ) {
          return current;
        }

        return [
          ...current,
          {
            profileId: observer.profile_id,
            firstName: observer.first_name ?? "",
            lastName: observer.last_name ?? "",
            roleEngagement: "observateur",
            origine: "observateur",
          },
        ];
      });
    } catch (error) {
      console.error("Erreur observateur :", error);

      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Impossible d'ajouter l'observateur."
      );
    } finally {
      setIsLoadingObserver(false);
    }
  };

  /* =======================================================
     AJOUT MANUEL
  ======================================================= */

  const addManualPerson = () => {
    if (!manualProfileId) {
      return;
    }

    const profile = profiles.find(
      (item) => item.id === manualProfileId
    );

    if (!profile) {
      return;
    }

    setPersonnel((current) => {
      if (
        current.some(
          (person) => person.profileId === profile.id
        )
      ) {
        return current;
      }

      return [
        ...current,
        {
          profileId: profile.id,
          firstName: profile.first_name ?? "",
          lastName: profile.last_name ?? "",
          roleEngagement: "equipier",
          origine: "manuel",
        },
      ];
    });

    setManualProfileId("");
  };

  const removePerson = (profileId: string) => {
    setPersonnel((current) =>
      current.filter(
        (person) => person.profileId !== profileId
      )
    );
  };

  const changePersonRole = (
    profileId: string,
    role: string
  ) => {
    setPersonnel((current) =>
      current.map((person) =>
        person.profileId === profileId
          ? {
              ...person,
              roleEngagement: role,
            }
          : person
      )
    );
  };

  /* =======================================================
     VÉHICULES
  ======================================================= */

  const toggleVehicle = (vehicle: string) => {
    setSelectedVehicles((current) =>
      current.includes(vehicle)
        ? current.filter((item) => item !== vehicle)
        : [...current, vehicle]
    );
  };

  const toggleExternalResource = (resource: string) => {
    setForm((previous) => {
      const selected = previous.moyensExterieurs.includes(resource);
      return {
        ...previous,
        moyensExterieurs: selected
          ? previous.moyensExterieurs.filter((item) => item !== resource)
          : [...previous.moyensExterieurs, resource],
        autreMoyenExterieur: resource === "Autre" && selected ? "" : previous.autreMoyenExterieur,
      };
    });
  };

  /* =======================================================
     VALIDATION DU FORMULAIRE
  ======================================================= */

  const validateForm = () => {
    if (!form.dateIntervention) {
      return "La date de l'intervention est obligatoire.";
    }

    if (!form.heureBip) {
      return "L'heure de bip est obligatoire.";
    }

    if (!form.heureDepart) {
      return "L'heure de départ est obligatoire.";
    }

    if (form.heureRetour && !form.dateRetour) {
      return "La date de retour est obligatoire si une heure de retour est renseignée.";
    }

    if (
      form.dateRetour &&
      form.dateIntervention &&
      form.dateRetour < form.dateIntervention
    ) {
      return "La date de retour ne peut pas être antérieure à la date de l'intervention.";
    }

    if (!form.categorie) {
      return "Sélectionne le type d'intervention.";
    }

    if (!form.sousType) {
      return "Sélectionne le motif de l'intervention.";
    }

    return null;
  };

  /* =======================================================
     ENREGISTREMENT
  ======================================================= */

  const saveIntervention = async (
    status: "brouillon" | "terminee"
  ) => {
    if (!userId || isSaving) {
      return;
    }

    if (isObserver) {
      setErrorMessage(
        "Les observateurs ne peuvent pas créer de fiche d'intervention."
      );
      setConfirmValidation(false);
      return;
    }

    const validationError = validateForm();

    if (validationError) {
      setErrorMessage(validationError);
      setConfirmValidation(false);
      return;
    }

    setIsSaving(true);
    setErrorMessage("");

    try {
      /*
       * 1. Création de la fiche principale.
       *
       * numero_interne n'est PAS envoyé :
       * le trigger Supabase le génère automatiquement.
       */
      const { data: intervention, error: interventionError } =
        await supabase
          .from("interventions")
          .insert({
            numero_codis:
              form.numeroCodis.trim() || null,

            date_intervention: form.dateIntervention,
            heure_bip: form.heureBip || null,
            heure_depart: form.heureDepart,

            date_retour:
              form.heureRetour
                ? form.dateRetour || form.dateIntervention
                : null,

            heure_retour:
              form.heureRetour || null,

            categorie: form.categorie,
            sous_type: form.sousType,

            adresse:
              form.adresse.trim() || null,

            lieu:
              form.lieu.trim() || null,

            nombre_victimes:
              form.nombreVictimes,

            // On conserve également un résumé lisible dans l'ancien champ texte.
            informations_victimes:
              form.victimesDetails.length
                ? form.victimesDetails
                    .map((victim, index) => {
                      const stateLabels: Record<string, string> = {
                        indemne: "Indemne",
                        blesse_leger: "Blessé léger",
                        blesse_grave: "Blessé grave",
                        decede: "Décédé",
                      };

                      const state =
                        stateLabels[victim.etat] || "État non renseigné";
                      const information =
                        victim.informations.trim();

                      return `Victime ${index + 1} — ${state}${
                        information ? ` : ${information}` : ""
                      }`;
                    })
                    .join("\n")
                : null,

            victimes_details:
              form.victimesDetails,

            moyens_exterieurs:
              form.moyensExterieurs.length
                ? form.moyensExterieurs.map((resource) =>
                    resource === "Autre" && form.autreMoyenExterieur.trim()
                      ? `Autre : ${form.autreMoyenExterieur.trim()}`
                      : resource
                  ).join(", ")
                : null,

            compte_rendu:
              form.compteRendu.trim() || null,

            statut: status,

            created_by: userId,

            validated_by:
              status === "terminee" ? userId : null,

            validated_at:
              status === "terminee"
                ? new Date().toISOString()
                : null,
          })
          .select("id, numero_interne")
          .single();

      if (interventionError || !intervention) {
        throw new Error(
          interventionError?.message ||
            "Impossible de créer l'intervention."
        );
      }

      const interventionId = intervention.id;

      /*
       * 2. Personnel engagé
       */
      if (personnel.length > 0) {
  const personnelRows = personnel.map((person) => ({
    intervention_id: interventionId,
    profile_id: person.profileId,
    role_engagement: person.roleEngagement,
    origine: person.origine,
  }));

  console.log("PERSONNEL À ENREGISTRER :", personnel);
  console.log("PERSONNEL ROWS :", personnelRows);

  const { error: personnelError } = await supabase
    .from("intervention_personnel")
    .insert(personnelRows);

  if (personnelError) {
    throw new Error(
      `La fiche a été créée mais le personnel n'a pas pu être enregistré : ${personnelError.message}`
    );
  }
}

      /*
       * 3. Engins
       */
      if (selectedVehicles.length > 0) {
        const { error: vehicleError } = await supabase
          .from("intervention_engins")
          .insert(
            selectedVehicles.map((vehicle) => ({
              intervention_id: interventionId,
              nom_engin: vehicle,
            }))
          );

        if (vehicleError) {
          throw new Error(
            `La fiche a été créée mais les engins n'ont pas pu être enregistrés : ${vehicleError.message}`
          );
        }
      }

      router.push("/dashboard/interventions");
      router.refresh();
    } catch (error) {
      console.error(
        "Erreur création intervention :",
        error
      );

      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Impossible d'enregistrer l'intervention."
      );

      setConfirmValidation(false);
    } finally {
      setIsSaving(false);
    }
  };

  /* =======================================================
     LOADING
  ======================================================= */

  if (isLoading || !accessChecked) {
    return (
      <div className="app-page flex min-h-screen items-center justify-center">
        <div className="text-center">
          <div className="mx-auto h-10 w-10 animate-spin rounded-full border-4 border-border border-t-red-600" />

          <p className="mt-4 text-sm text-muted-foreground">
            Préparation de la fiche...
          </p>
        </div>
      </div>
    );
  }

  /* =======================================================
     ACCÈS OBSERVATEUR
  ======================================================= */

  if (isObserver) {
    return (
      <div className="app-page min-h-screen">
        <main className="mx-auto flex min-h-[70vh] w-full max-w-3xl items-center justify-center p-4 sm:p-6">
          <section className="w-full rounded-3xl border border-red-500/30 bg-card p-6 text-center shadow-sm sm:p-10">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-red-500/10 text-red-500">
              <Shield size={26} />
            </div>

            <p className="mt-5 text-xs font-black uppercase tracking-[0.2em] text-red-500">
              Accès restreint
            </p>

            <h1 className="mt-2 text-2xl font-black sm:text-3xl">
              Création de fiche non autorisée
            </h1>

            <p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-muted-foreground">
              Les observateurs peuvent consulter l&apos;historique des
              interventions, mais ne peuvent pas créer, enregistrer ou valider
              une fiche d&apos;intervention.
            </p>

            <button
              type="button"
              onClick={() => router.replace("/dashboard/interventions")}
              className="mt-6 inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-red-600 px-5 text-sm font-black text-white transition hover:bg-red-700"
            >
              <ArrowLeft size={18} />
              Retour aux interventions
            </button>
          </section>
        </main>
      </div>
    );
  }

  /* =======================================================
     RENDER
  ======================================================= */

  return (
    <div className="app-page min-h-screen">
      <main className="mx-auto w-full max-w-7xl p-4 pb-32 sm:p-6 lg:p-8">
        {/* HEADER */}

        <header>
          <button
            type="button"
            onClick={() =>
              router.push("/dashboard/interventions")
            }
            className="inline-flex items-center gap-2 text-sm font-black text-muted-foreground transition hover:text-foreground"
          >
            <ArrowLeft size={17} />
            Interventions
          </button>

          <div className="mt-5">
            <p className="text-xs font-black uppercase tracking-[0.2em] text-red-500">
              Nouvelle fiche
            </p>

            <h1 className="mt-2 text-3xl font-black sm:text-4xl">
              Nouvelle intervention
            </h1>

            <p className="mt-2 text-sm text-muted-foreground">
              Renseigne les informations opérationnelles de
              l&apos;intervention.
            </p>
          </div>
        </header>

        {/* ERREUR */}

        {errorMessage && (
          <div className="mt-6 flex items-start gap-3 rounded-2xl border border-red-400 bg-red-100 p-4 text-red-900 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
            <AlertTriangle
              size={20}
              className="mt-0.5 shrink-0"
            />

            <p className="text-sm font-bold">
              {errorMessage}
            </p>
          </div>
        )}

        <div className="mt-7 overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
          {/* =================================================
              INFORMATIONS
          ================================================= */}

          <FormSection
            icon={FileText}
            eyebrow="Informations"
            title="Intervention"
          >
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
              <Field label="N° inter CODIS">
                <input
                  value={form.numeroCodis}
                  onChange={(event) =>
                    updateForm(
                      "numeroCodis",
                      event.target.value
                    )
                  }
                  placeholder="Ex : 24567"
                  className="app-input"
                />
              </Field>

              <Field
                label="Date"
                required
              >
                <input
                  type="date"
                  value={form.dateIntervention}
                  onChange={(event) =>
                    changeInterventionDate(event.target.value)
                  }
                  className="app-input"
                />
              </Field>

              <Field
                label="Heure de bip"
                required
              >
                <input
                  type="time"
                  value={form.heureBip}
                  onChange={(event) =>
                    updateForm(
                      "heureBip",
                      event.target.value
                    )
                  }
                  className="app-input"
                />
              </Field>

              <Field
                label="Heure départ"
                required
              >
                <input
                  type="time"
                  value={form.heureDepart}
                  onChange={(event) =>
                    updateForm(
                      "heureDepart",
                      event.target.value
                    )
                  }
                  className="app-input"
                />
              </Field>

              <Field label="Date retour">
                <input
                  type="date"
                  min={form.dateIntervention || undefined}
                  value={form.dateRetour}
                  onChange={(event) =>
                    updateForm(
                      "dateRetour",
                      event.target.value
                    )
                  }
                  className="app-input"
                />
              </Field>

              <Field label="Heure retour">
                <input
                  type="time"
                  value={form.heureRetour}
                  onChange={(event) =>
                    updateForm(
                      "heureRetour",
                      event.target.value
                    )
                  }
                  className="app-input"
                />
              </Field>
            </div>
          </FormSection>

          {/* =================================================
              TYPE
          ================================================= */}

          <FormSection
            icon={Flame}
            eyebrow="Nature"
            title="Type d'intervention"
          >
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {(
                Object.entries(interventionTypes) as [
                  CategoryKey,
                  (typeof interventionTypes)[CategoryKey]
                ][]
              ).map(([key, category]) => {
                const Icon = category.icon;

                const selected =
                  form.categorie === key;

                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => {
                      const nextCategory =
                        form.categorie === key ? "" : key;

                      updateForm("categorie", nextCategory);
                      updateForm("sousType", "");
                    }}
                    className={`rounded-2xl border p-4 text-left transition ${
                      selected
                        ? "border-red-500 bg-red-500/10"
                        : "border-border bg-surface hover:bg-surface-strong"
                    }`}
                  >
                    <div
                      className={`flex h-10 w-10 items-center justify-center rounded-xl ${
                        selected
                          ? "bg-red-600 text-white"
                          : "bg-surface-strong text-muted-foreground"
                      }`}
                    >
                      <Icon size={19} />
                    </div>

                    <p className="mt-3 text-sm font-black">
                      {category.label}
                    </p>

                    {selected && (
                      <div className="mt-2 flex items-center gap-1 text-xs font-black text-red-500">
                        <Check size={14} />
                        Sélectionné
                      </div>
                    )}
                  </button>
                );
              })}
            </div>

            {selectedCategory && (
  <div className="mt-5 border-t border-border pt-5">
    <div className="mb-3 flex items-center justify-between">
      <div>
        <p className="text-[11px] font-black uppercase tracking-[0.16em] text-red-500">
          Motif de l&apos;intervention
        </p>

        <p className="mt-1 text-xs text-muted-foreground">
          Sélectionne le motif correspondant
        </p>
      </div>

      {form.sousType && (
        <div className="flex items-center gap-1.5 rounded-lg bg-red-500/10 px-3 py-1.5 text-xs font-black text-red-500">
          <Check size={14} />
          Sélectionné
        </div>
      )}
    </div>

    <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
      {selectedCategory.subtypes.map((subtype) => {
        const selected = form.sousType === subtype;

        return (
          <button
            key={subtype}
            type="button"
            onClick={() =>
              updateForm(
                "sousType",
                selected ? "" : subtype
              )
            }
            className={`group flex min-h-14 items-center gap-3 rounded-xl border px-4 text-left transition-all ${
              selected
                ? "border-red-500 bg-red-500/10 shadow-[0_0_0_1px_rgba(239,68,68,0.15)]"
                : "border-border bg-surface hover:border-red-500/40 hover:bg-surface-strong"
            }`}
          >
            <span
              className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-md border transition ${
                selected
                  ? "border-red-500 bg-red-600 text-white"
                  : "border-border bg-background group-hover:border-red-500/50"
              }`}
            >
              {selected && <Check size={15} strokeWidth={3} />}
            </span>

            <span
              className={`text-sm font-bold ${
                selected
                  ? "text-foreground"
                  : "text-muted-foreground"
              }`}
            >
              {subtype}
            </span>
          </button>
        );
      })}
    </div>
  </div>
)}
          </FormSection>

          {/* =================================================
              LIEU
          ================================================= */}

          <FormSection
            icon={MapPin}
            eyebrow="Localisation"
            title="Lieu de l'intervention"
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Adresse">
                <input
                  value={form.adresse}
                  onChange={(event) =>
                    updateForm(
                      "adresse",
                      event.target.value
                    )
                  }
                  placeholder="Adresse de l'intervention"
                  className="app-input"
                />
              </Field>

              <Field label="Lieu / précision">
                <input
                  value={form.lieu}
                  onChange={(event) =>
                    updateForm(
                      "lieu",
                      event.target.value
                    )
                  }
                  placeholder="Appartement, entreprise, route..."
                  className="app-input"
                />
              </Field>
            </div>
          </FormSection>

          {/* =================================================
              ENGINS
          ================================================= */}

          <FormSection
            icon={Truck}
            eyebrow="Moyens"
            title="Engins engagés"
          >
            <div className="grid grid-cols-3 gap-3">
              {vehicles.map((vehicle) => {
                const selected =
                  selectedVehicles.includes(vehicle);

                return (
                  <button
                    key={vehicle}
                    type="button"
                    onClick={() =>
                      toggleVehicle(vehicle)
                    }
                    className={`min-h-20 rounded-2xl border text-center transition ${
                      selected
                        ? "border-red-500 bg-red-500/10 text-red-500"
                        : "border-border bg-surface hover:bg-surface-strong"
                    }`}
                  >
                    <Truck
                      size={20}
                      className="mx-auto"
                    />

                    <span className="mt-2 block text-sm font-black">
                      {vehicle}
                    </span>
                  </button>
                );
              })}
            </div>
          </FormSection>

          {/* =================================================
              PERSONNEL
          ================================================= */}

          <FormSection
            icon={Users}
            eyebrow="Équipage"
            title="Pompiers engagés"
          >
            {isLoadingGuard && (
              <div className="mb-4 rounded-xl bg-surface-strong px-4 py-3 text-sm font-bold text-muted-foreground">
                Recherche du personnel de garde...
              </div>
            )}

            {!isLoadingGuard && guardMessage && (
              <div className="mb-4 rounded-xl border border-border bg-surface px-4 py-3 text-sm text-muted-foreground">
                {guardMessage}
              </div>
            )}

            {personnel.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-border p-6 text-center">
                <Users
                  size={25}
                  className="mx-auto text-muted-foreground"
                />

                <p className="mt-3 font-black">
                  Aucun pompier engagé
                </p>

                <p className="mt-1 text-xs text-muted-foreground">
                  Ajoute manuellement le personnel si
                  nécessaire.
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {personnel.map((person) => (
                  <div
                    key={person.profileId}
                    className="flex flex-col gap-3 rounded-2xl border border-border bg-surface p-3 sm:flex-row sm:items-center"
                  >
                    <div className="flex min-w-0 flex-1 items-center gap-3">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-surface-strong font-black">
                        {(person.firstName[0] ?? "") +
                          (person.lastName[0] ?? "")}
                      </div>

                      <div className="min-w-0">
                        <p className="truncate text-sm font-black">
                          {displayName(
                            person.firstName,
                            person.lastName
                          )}
                        </p>

                        <p className="text-xs text-muted-foreground">
                          {person.origine === "garde"
                            ? "Ajouté depuis la garde"
                            : person.origine ===
                                "observateur"
                              ? "Observateur de garde"
                              : "Ajout manuel"}
                        </p>
                      </div>
                    </div>

                    <div className="flex gap-2">
                      <select
                        value={person.roleEngagement}
                        onChange={(event) =>
                          changePersonRole(
                            person.profileId,
                            event.target.value
                          )
                        }
                        className="app-input min-w-0 flex-1 sm:w-40"
                      >
                        <option value="premier_depart">
                          1er départ
                        </option>

                        <option value="deuxieme_depart">
                          2e départ
                        </option>

                        <option value="equipier">
                          Équipier
                        </option>

                        <option value="chef_agres">
                          Chef d&apos;agrès
                        </option>

                        <option value="conducteur">
                          Conducteur
                        </option>

                        <option value="observateur">
                          Observateur
                        </option>
                      </select>

                      <button
                        type="button"
                        onClick={() =>
                          removePerson(person.profileId)
                        }
                        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-red-300 text-red-600 transition hover:bg-red-500/10 dark:border-red-900"
                        aria-label="Retirer le pompier"
                      >
                        <Trash2 size={17} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="mt-5 grid gap-3 lg:grid-cols-[1fr_auto_auto]">
              <select
                value={manualProfileId}
                onChange={(event) =>
                  setManualProfileId(
                    event.target.value
                  )
                }
                className="app-input"
              >
                <option value="">
                  Ajouter un pompier...
                </option>

                {profiles
                  .filter(
                    (profile) =>
                      !personnel.some(
                        (person) =>
                          person.profileId ===
                          profile.id
                      )
                  )
                  .map((profile) => (
                    <option
                      key={profile.id}
                      value={profile.id}
                    >
                      {displayName(
                        profile.first_name,
                        profile.last_name
                      )}
                    </option>
                  ))}
              </select>

              <button
                type="button"
                disabled={!manualProfileId}
                onClick={addManualPerson}
                className="app-button-secondary inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-4 text-sm font-black disabled:opacity-40"
              >
                <UserPlus size={17} />
                Ajouter
              </button>

              <button
                type="button"
                disabled={isLoadingObserver}
                onClick={() => void addObserver()}
                className="app-button-secondary inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-4 text-sm font-black disabled:opacity-50"
              >
                <Plus size={17} />

                {isLoadingObserver
                  ? "Recherche..."
                  : "Ajouter l'observateur"}
              </button>
            </div>
          </FormSection>

          {/* =================================================
              VICTIMES
          ================================================= */}

          <FormSection
            icon={Users}
            eyebrow="Personnes"
            title="Victimes / personnes impliquées"
          >
            <div className="max-w-[220px]">
              <Field label="Nombre de victimes">
                <input
                  type="number"
                  min={0}
                  value={form.nombreVictimes}
                  onChange={(event) =>
                    updateVictimCount(
                      Number(event.target.value)
                    )
                  }
                  className="app-input"
                />
              </Field>
            </div>

            {form.nombreVictimes > 0 && (
              <div className="mt-5 grid gap-4">
                {form.victimesDetails.map((victim, index) => (
                  <div
                    key={index}
                    className="rounded-2xl border border-border bg-background/40 p-4 sm:p-5"
                  >
                    <div className="mb-4 flex items-center justify-between gap-3">
                      <p className="text-sm font-black uppercase tracking-wider">
                        Victime {index + 1}
                      </p>

                      {victim.etat && (
                        <span className="rounded-full border border-border px-3 py-1 text-xs font-bold text-muted-foreground">
                          État renseigné
                        </span>
                      )}
                    </div>

                    <div>
                      <p className="mb-2 text-xs font-black uppercase tracking-wider text-muted-foreground">
                        État de la victime
                      </p>

                      <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
                        {[
                          {
                            value: "indemne",
                            label: "🟢 Indemne",
                          },
                          {
                            value: "blesse_leger",
                            label: "🟡 Blessé léger",
                          },
                          {
                            value: "blesse_grave",
                            label: "🔴 Blessé grave",
                          },
                          {
                            value: "decede",
                            label: "⚫ Décédé",
                          },
                        ].map((option) => {
                          const selected =
                            victim.etat === option.value;

                          return (
                            <button
                              key={option.value}
                              type="button"
                              onClick={() =>
                                updateVictim(index, {
                                  etat: selected
                                    ? ""
                                    : (option.value as VictimDetail["etat"]),
                                })
                              }
                              className={`min-h-11 rounded-xl border px-3 py-2 text-sm font-bold transition active:scale-[0.98] ${
                                selected
                                  ? "border-red-500 bg-red-500/10 text-foreground ring-1 ring-red-500/30"
                                  : "border-border bg-card text-muted-foreground hover:border-red-500/50 hover:text-foreground"
                              }`}
                            >
                              {option.label}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    <div className="mt-4">
                      <Field label="Informations">
                        <textarea
                          value={victim.informations}
                          onChange={(event) =>
                            updateVictim(index, {
                              informations:
                                event.target.value,
                            })
                          }
                          rows={3}
                          placeholder={`Informations complémentaires concernant la victime ${index + 1}...`}
                          className="app-input min-h-[110px] w-full resize-y"
                        />
                      </Field>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </FormSection>

          {/* =================================================
              MOYENS EXTÉRIEURS
          ================================================= */}

          <FormSection icon={Building2} eyebrow="Renforts" title="Moyens extérieurs">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
              {externalResources.map((resource) => {
                const selected = form.moyensExterieurs.includes(resource);
                return (
                  <button key={resource} type="button" onClick={() => toggleExternalResource(resource)}
                    className={`flex min-h-14 items-center gap-3 rounded-xl border px-4 text-left transition ${selected ? "border-red-500 bg-red-500/10" : "border-border bg-surface hover:bg-surface-strong"}`}>
                    <span className={`flex h-6 w-6 items-center justify-center rounded-md border ${selected ? "border-red-500 bg-red-600 text-white" : "border-border"}`}>
                      {selected && <Check size={15} />}
                    </span>
                    <span className="text-sm font-black">{resource}</span>
                  </button>
                );
              })}
            </div>
            {form.moyensExterieurs.includes("Autre") && (
              <div className="mt-4">
                <Field label="Préciser l'autre moyen extérieur">
                  <input value={form.autreMoyenExterieur}
                    onChange={(event) => updateForm("autreMoyenExterieur", event.target.value)}
                    placeholder="Ex : GRDF, Enedis, service des eaux..." className="app-input" />
                </Field>
              </div>
            )}
          </FormSection>

          {/* =================================================
              COMPTE RENDU
          ================================================= */}

          <FormSection
            icon={FileText}
            eyebrow="Rapport"
            title="Compte-rendu"
          >
            <textarea
              value={form.compteRendu}
              onChange={(event) =>
                updateForm(
                  "compteRendu",
                  event.target.value
                )
              }
              rows={8}
              placeholder="Déroulement de l'intervention, actions réalisées, éléments importants..."
              className="app-input resize-y"
            />
          </FormSection>
        </div>
      </main>

      {/* =====================================================
          BARRE ACTIONS
      ===================================================== */}

      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background/95 p-3 backdrop-blur lg:left-[var(--sidebar-width,0px)]">
        <div className="mx-auto flex w-full max-w-6xl flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button
            type="button"
            disabled={isSaving}
            onClick={() =>
              void saveIntervention("brouillon")
            }
            className="app-button-secondary inline-flex min-h-12 items-center justify-center gap-2 rounded-xl px-5 text-sm font-black disabled:opacity-50"
          >
            <Save size={18} />

            {isSaving
              ? "Enregistrement..."
              : "Enregistrer le brouillon"}
          </button>

          <button
            type="button"
            disabled={isSaving}
            onClick={() => {
              const error = validateForm();

              if (error) {
                setErrorMessage(error);
                return;
              }

              setErrorMessage("");
              setConfirmValidation(true);
            }}
            className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-red-600 px-5 text-sm font-black text-white transition hover:bg-red-700 disabled:opacity-50"
          >
            <Check size={18} />
            Valider l&apos;intervention
          </button>
        </div>
      </div>

      {/* =====================================================
          CONFIRMATION VALIDATION
      ===================================================== */}

      {confirmValidation && (
        <div
          className="fixed inset-0 z-[100] flex items-end justify-center bg-black/70 sm:items-center sm:p-6"
          role="dialog"
          aria-modal="true"
        >
          <button
            type="button"
            aria-label="Fermer"
            className="absolute inset-0"
            onClick={() => {
              if (!isSaving) {
                setConfirmValidation(false);
              }
            }}
          />

          <div className="relative z-10 w-full rounded-t-3xl border border-red-400 bg-card p-6 shadow-2xl sm:max-w-lg sm:rounded-3xl">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-red-100 text-red-700 dark:bg-red-950/50 dark:text-red-300">
              <AlertTriangle size={23} />
            </div>

            <h2 className="mt-5 text-xl font-black">
              Valider cette intervention ?
            </h2>

            <p className="mt-3 text-sm leading-6 text-muted-foreground">
              Une fois validée, la fiche sera considérée
              comme terminée et tu ne pourras plus la
              modifier. Le commandement conservera la
              possibilité de la consulter et de la corriger.
            </p>

            <div className="mt-4 rounded-2xl border border-border bg-surface p-4">
              <p className="font-black">
                {form.sousType}
              </p>

              <div className="mt-2 flex flex-wrap gap-3 text-xs font-bold text-muted-foreground">
                <span>{form.dateIntervention}</span>

                <span>
                  <Clock3
                    size={13}
                    className="mr-1 inline"
                  />
                  Bip {form.heureBip}
                </span>

                <span>
                  Départ {form.heureDepart}
                </span>

                {form.heureRetour && (
                  <span>
                    Retour {form.dateRetour} à {form.heureRetour}
                  </span>
                )}

                <span>
                  {personnel.length} pompier
                  {personnel.length > 1 ? "s" : ""}
                </span>

                <span>
                  {selectedVehicles.length} engin
                  {selectedVehicles.length > 1
                    ? "s"
                    : ""}
                </span>
              </div>
            </div>

            <div className="mt-6 grid gap-2 sm:grid-cols-2">
              <button
                type="button"
                disabled={isSaving}
                onClick={() =>
                  setConfirmValidation(false)
                }
                className="app-button-secondary min-h-12 rounded-xl px-4 text-sm font-black disabled:opacity-50"
              >
                Retour à la fiche
              </button>

              <button
                type="button"
                disabled={isSaving}
                onClick={() =>
                  void saveIntervention("terminee")
                }
                className="min-h-12 rounded-xl bg-red-600 px-4 text-sm font-black text-white transition hover:bg-red-700 disabled:opacity-50"
              >
                {isSaving
                  ? "Validation..."
                  : "Confirmer la validation"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* =========================================================
   COMPOSANTS
========================================================= */

function FormSection({
  icon: Icon,
  eyebrow,
  title,
  children,
}: {
  icon: typeof FileText;
  eyebrow: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="border-b border-border last:border-b-0">
      <div className="flex items-center gap-3 px-4 pb-2 pt-5 sm:px-6">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-red-100 text-red-700 dark:bg-red-950/50 dark:text-red-300">
          <Icon size={20} />
        </div>

        <div>
          <p className="text-xs font-black uppercase tracking-[0.18em] text-red-500">
            {eyebrow}
          </p>

          <h2 className="mt-1 text-lg font-black sm:text-xl">
            {title}
          </h2>
        </div>
      </div>

      <div className="px-4 pb-5 pt-3 sm:px-6 sm:pb-6">
        {children}
      </div>
    </section>
  );
}

function Field({
  label,
  required = false,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-xs font-black uppercase tracking-[0.08em] text-muted-foreground">
        {label}

        {required && (
          <span className="ml-1 text-red-500">
            *
          </span>
        )}
      </span>

      {children}
    </label>
  );
}