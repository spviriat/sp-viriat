"use client";

import Link from "next/link";
import {
  FormEvent,
  useCallback,
  useEffect,
  useState,
} from "react";

import { supabase } from "@/lib/supabase";

import {
  Ambulance,
  BellRing,
  Boxes,
  CalendarClock,
  ChevronLeft,
  ChevronRight,
  LayoutDashboard,
  Menu,
  Package,
  Pill,
  Tags,
  Truck,
  type LucideIcon,
} from "lucide-react";

type Supplier = {
  id: string;
  name: string;
  address: string | null;
  phone: string | null;
  email: string | null;
  website: string | null;
  contact_name: string | null;
  notes: string | null;
  is_active: boolean;
  reference_count: number;
};

type SuppliersResponse = {
  suppliers?: Supplier[];

  permissions?: {
    canRead: boolean;
    canWrite: boolean;
  };

  error?: string;
};

export default function SuppliersPage() {
  const [
    suppliers,
    setSuppliers,
  ] = useState<Supplier[]>([]);

  const [
    canWrite,
    setCanWrite,
  ] = useState(false);

  const [
    isSidebarOpen,
    setIsSidebarOpen,
  ] = useState(true);

  const [
    isLoading,
    setIsLoading,
  ] = useState(true);

  const [
    isCreating,
    setIsCreating,
  ] = useState(false);

  const [
    showForm,
    setShowForm,
  ] = useState(false);

  const [
    errorMessage,
    setErrorMessage,
  ] = useState("");

  const [
    successMessage,
    setSuccessMessage,
  ] = useState("");

  /*
   * =====================================================
   * FORMULAIRE
   * =====================================================
   */

  const [name, setName] =
    useState("");

  const [address, setAddress] =
    useState("");

  const [phone, setPhone] =
    useState("");

  const [email, setEmail] =
    useState("");

  const [website, setWebsite] =
    useState("");

  const [
    contactName,
    setContactName,
  ] = useState("");

  const [notes, setNotes] =
    useState("");

  /*
   * =====================================================
   * SESSION
   * =====================================================
   */

  const getAccessToken =
    async () => {
      const {
        data: { session },
        error,
      } =
        await supabase.auth.getSession();

      if (
        error ||
        !session?.access_token
      ) {
        return null;
      }

      return session.access_token;
    };

  /*
   * =====================================================
   * CHARGEMENT
   * =====================================================
   */

  const loadSuppliers =
    useCallback(async () => {
      setIsLoading(true);
      setErrorMessage("");

      try {
        const accessToken =
          await getAccessToken();

        if (!accessToken) {
          setErrorMessage(
            "Votre session n'est plus valide."
          );

          return;
        }

        const response =
          await fetch(
            "/api/secourisme/fournisseurs",
            {
              method: "GET",

              headers: {
                Authorization:
                  `Bearer ${accessToken}`,
              },

              cache: "no-store",
            }
          );

        const result =
          (await response.json()) as
            SuppliersResponse;

        if (!response.ok) {
          setErrorMessage(
            result.error ??
              "Impossible de charger les fournisseurs."
          );

          return;
        }

        setSuppliers(
          result.suppliers ?? []
        );

        setCanWrite(
          Boolean(
            result.permissions
              ?.canWrite
          )
        );
      } catch (error) {
        console.error(
          "Erreur chargement fournisseurs :",
          error
        );

        setErrorMessage(
          "Une erreur est survenue lors du chargement des fournisseurs."
        );
      } finally {
        setIsLoading(false);
      }
    }, []);

  useEffect(() => {
    void loadSuppliers();
  }, [loadSuppliers]);

  /*
   * =====================================================
   * CRÉATION
   * =====================================================
   */

  const handleCreate =
    async (
      event:
        FormEvent<HTMLFormElement>
    ) => {
      event.preventDefault();

      setErrorMessage("");
      setSuccessMessage("");

      if (!name.trim()) {
        setErrorMessage(
          "Le nom du fournisseur est obligatoire."
        );

        return;
      }

      setIsCreating(true);

      try {
        const accessToken =
          await getAccessToken();

        if (!accessToken) {
          setErrorMessage(
            "Votre session n'est plus valide."
          );

          return;
        }

        const response =
          await fetch(
            "/api/secourisme/fournisseurs",
            {
              method: "POST",

              headers: {
                "Content-Type":
                  "application/json",

                Authorization:
                  `Bearer ${accessToken}`,
              },

              body: JSON.stringify({
                name,
                address,
                phone,
                email,
                website,
                contactName,
                notes,
              }),
            }
          );

        const result =
          (await response.json()) as
            SuppliersResponse & {
              message?: string;
              supplier?: Supplier;
            };

        if (!response.ok) {
          setErrorMessage(
            result.error ??
              "Impossible de créer le fournisseur."
          );

          return;
        }

        setSuccessMessage(
          result.message ??
            "Fournisseur créé avec succès."
        );

        /*
         * Réinitialisation.
         */

        setName("");
        setAddress("");
        setPhone("");
        setEmail("");
        setWebsite("");
        setContactName("");
        setNotes("");

        setShowForm(false);

        await loadSuppliers();
      } catch (error) {
        console.error(
          "Erreur création fournisseur :",
          error
        );

        setErrorMessage(
          "Une erreur est survenue pendant la création du fournisseur."
        );
      } finally {
        setIsCreating(false);
      }
    };

  /*
   * =====================================================
   * AFFICHAGE
   * =====================================================
   */

  return (
    <div className="app-page">
      <SecourismeSidebar
        open={isSidebarOpen}
        onToggle={() =>
          setIsSidebarOpen((current) => !current)
        }
        active="fournisseurs"
      />

      <div
        className={`transition-[padding] duration-300 ${
          isSidebarOpen ? "lg:pl-72" : "lg:pl-24"
        }`}
      >
        <main className="px-4 py-8 sm:px-6">
          <div className="mx-auto max-w-7xl">

        {/* =================================================
            ENTÊTE
        ================================================= */}

        <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm font-black uppercase tracking-[0.2em] text-red-500">
              Secourisme
            </p>

            <h1 className="mt-2 text-3xl font-black sm:text-4xl">
              Fournisseurs
            </h1>

            <p className="mt-3 max-w-2xl text-muted-foreground">
              Gérez les fournisseurs de
              la pharmacie et leurs
              références de matériel.
            </p>
          </div>

          {canWrite && (
            <button
              type="button"
              onClick={() =>
                setShowForm(
                  (current) =>
                    !current
                )
              }
              className="rounded-2xl bg-red-600 px-5 py-3 font-black text-white transition hover:bg-red-700"
            >
              {showForm
                ? "Fermer"
                : "+ Ajouter un fournisseur"}
            </button>
          )}
        </div>

        {/* =================================================
            MESSAGES
        ================================================= */}

        {errorMessage && (
          <div className="mt-6 rounded-2xl border border-red-400 bg-red-200 p-4 font-bold text-red-900 dark:border-red-800 dark:bg-red-950/50 dark:text-red-300">
            {errorMessage}
          </div>
        )}

        {successMessage && (
          <div className="mt-6 rounded-2xl border border-emerald-400 bg-emerald-200 p-4 font-bold text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300">
            ✅ {successMessage}
          </div>
        )}

        {/* =================================================
            FORMULAIRE
        ================================================= */}

        {canWrite &&
          showForm && (
            <form
              onSubmit={
                handleCreate
              }
              className="mt-8 rounded-3xl border border-border bg-card p-6 shadow-xl sm:p-8"
            >
              <div>
                <h2 className="text-2xl font-black">
                  Nouveau fournisseur
                </h2>

                <p className="mt-2 text-sm text-muted-foreground">
                  Les coordonnées
                  pourront être modifiées
                  ultérieurement.
                </p>
              </div>

              <div className="mt-7 grid gap-5 md:grid-cols-2">

                <label className="block">
                  <span className="text-sm font-bold text-foreground">
                    Nom *
                  </span>

                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(event) =>
                      setName(
                        event.target
                          .value
                      )
                    }
                    placeholder="Ex. Robé Médical"
                    className="app-input mt-2 w-full rounded-2xl px-4 py-3 outline-none transition focus:border-red-500"
                  />
                </label>

                <label className="block">
                  <span className="text-sm font-bold text-foreground">
                    Contact
                  </span>

                  <input
                    type="text"
                    value={
                      contactName
                    }
                    onChange={(event) =>
                      setContactName(
                        event.target
                          .value
                      )
                    }
                    placeholder="Nom du contact"
                    className="app-input mt-2 w-full rounded-2xl px-4 py-3 outline-none transition focus:border-red-500"
                  />
                </label>

                <label className="block">
                  <span className="text-sm font-bold text-foreground">
                    Téléphone
                  </span>

                  <input
                    type="tel"
                    value={phone}
                    onChange={(event) =>
                      setPhone(
                        event.target
                          .value
                      )
                    }
                    placeholder="04 00 00 00 00"
                    className="app-input mt-2 w-full rounded-2xl px-4 py-3 outline-none transition focus:border-red-500"
                  />
                </label>

                <label className="block">
                  <span className="text-sm font-bold text-foreground">
                    E-mail
                  </span>

                  <input
                    type="email"
                    value={email}
                    onChange={(event) =>
                      setEmail(
                        event.target
                          .value
                      )
                    }
                    placeholder="contact@fournisseur.fr"
                    className="app-input mt-2 w-full rounded-2xl px-4 py-3 outline-none transition focus:border-red-500"
                  />
                </label>

                <label className="block md:col-span-2">
                  <span className="text-sm font-bold text-foreground">
                    Adresse
                  </span>

                  <input
                    type="text"
                    value={address}
                    onChange={(event) =>
                      setAddress(
                        event.target
                          .value
                      )
                    }
                    placeholder="Adresse du fournisseur"
                    className="app-input mt-2 w-full rounded-2xl px-4 py-3 outline-none transition focus:border-red-500"
                  />
                </label>

                <label className="block md:col-span-2">
                  <span className="text-sm font-bold text-foreground">
                    Site internet
                  </span>

                  <input
                    type="text"
                    value={website}
                    onChange={(event) =>
                      setWebsite(
                        event.target
                          .value
                      )
                    }
                    placeholder="https://..."
                    className="app-input mt-2 w-full rounded-2xl px-4 py-3 outline-none transition focus:border-red-500"
                  />
                </label>

                <label className="block md:col-span-2">
                  <span className="text-sm font-bold text-foreground">
                    Observations
                  </span>

                  <textarea
                    rows={4}
                    value={notes}
                    onChange={(event) =>
                      setNotes(
                        event.target
                          .value
                      )
                    }
                    placeholder="Informations complémentaires..."
                    className="app-input mt-2 w-full resize-none rounded-2xl px-4 py-3 outline-none transition focus:border-red-500"
                  />
                </label>
              </div>

              <div className="mt-7 flex justify-end">
                <button
                  type="submit"
                  disabled={
                    isCreating
                  }
                  className="rounded-2xl bg-red-600 px-6 py-3 font-black text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {isCreating
                    ? "Création..."
                    : "Créer le fournisseur"}
                </button>
              </div>
            </form>
          )}

        {/* =================================================
            FOURNISSEURS
        ================================================= */}

        <section className="mt-8">
          {isLoading ? (
            <div className="rounded-3xl border border-border bg-card p-10 text-center">
              <div className="mx-auto h-10 w-10 animate-spin rounded-full border-4 border-slate-700 border-t-red-600" />

              <p className="mt-4 font-bold text-muted-foreground">
                Chargement des
                fournisseurs...
              </p>
            </div>
          ) : suppliers.length ===
            0 ? (
            <div className="rounded-3xl border border-dashed border-border bg-surface-soft p-10 text-center">
              <div className="text-4xl">
                🏢
              </div>

              <h2 className="mt-4 text-xl font-black">
                Aucun fournisseur
              </h2>

              <p className="mt-2 text-muted-foreground">
                Aucun fournisseur
                n&apos;est encore
                enregistré dans la
                pharmacie.
              </p>
            </div>
          ) : (
            <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
              {suppliers.map(
                (supplier) => (
                  <Link
                    key={
                      supplier.id
                    }
                    href={`/dashboard/secourisme/fournisseurs/${supplier.id}`}
                    className="group rounded-3xl border border-border bg-card p-6 transition hover:-translate-y-1 hover:border-red-700 hover:shadow-xl"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className="text-xl font-black">
                          {
                            supplier.name
                          }
                        </p>

                        {!supplier.is_active && (
                          <span className="mt-2 inline-block rounded-full border border-border bg-surface-strong px-3 py-1 text-xs font-bold text-muted-foreground">
                            Désactivé
                          </span>
                        )}
                      </div>

                      <div className="rounded-2xl bg-surface-strong px-3 py-2 text-sm font-black text-foreground transition group-hover:bg-red-200 group-hover:text-red-900 dark:group-hover:bg-red-950 dark:group-hover:text-red-300">
                        {
                          supplier.reference_count
                        }{" "}
                        réf.
                      </div>
                    </div>

                    <div className="mt-6 space-y-3 text-sm">
                      {supplier.contact_name && (
                        <p className="text-muted-foreground">
                          👤{" "}
                          {
                            supplier.contact_name
                          }
                        </p>
                      )}

                      {supplier.phone && (
                        <p className="text-muted-foreground">
                          📞{" "}
                          {
                            supplier.phone
                          }
                        </p>
                      )}

                      {supplier.email && (
                        <p className="break-all text-muted-foreground">
                          ✉️{" "}
                          {
                            supplier.email
                          }
                        </p>
                      )}

                      {supplier.address && (
                        <p className="text-muted-foreground">
                          📍{" "}
                          {
                            supplier.address
                          }
                        </p>
                      )}
                    </div>

                    <div className="mt-6 border-t border-border pt-4 text-sm font-black text-red-400">
                      Voir le fournisseur
                      et ses références →
                    </div>
                  </Link>
                )
              )}
            </div>
          )}
        </section>

        {/* =================================================
            RETOUR
        ================================================= */}

        <Link
          href="/dashboard/secourisme"
          className="app-button-secondary mt-8 inline-flex rounded-2xl px-5 py-3 font-bold"
        >
          ← Retour au Secourisme
        </Link>
          </div>
        </main>
      </div>
    </div>
  );
}


function SecourismeSidebar({
  open,
  onToggle,
  active,
}: {
  open: boolean;
  onToggle: () => void;
  active:
    | "alertes"
    | "stock"
    | "peremptions"
    | "fournisseurs"
    | "categories";
}) {
  return (
    <aside
      className={`fixed bottom-0 left-0 top-0 z-40 hidden border-r border-sidebar-border bg-sidebar/95 backdrop-blur-xl transition-all duration-300 lg:block ${
        open ? "w-64" : "w-20"
      }`}
    >
      <div className="flex h-full flex-col p-3">
        <div className="mb-5 flex items-center justify-between gap-2">
          {open && (
            <div className="min-w-0 px-2">
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-red-500">
                Secourisme
              </p>
              <p className="mt-1 truncate text-sm font-black text-foreground">
                SP Viriat
              </p>
            </div>
          )}

          <button
            type="button"
            onClick={onToggle}
            className="app-button-secondary flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
          >
            {open ? (
              <ChevronLeft size={18} />
            ) : (
              <ChevronRight size={18} />
            )}
          </button>
        </div>

        <nav className="space-y-5 overflow-y-auto">
          <SidebarSection title="Navigation" open={open}>
            <SidebarLink
              href="/dashboard"
              icon={LayoutDashboard}
              label="Tableau de bord"
              open={open}
            />
            <SidebarLink
              href="/dashboard/secourisme"
              icon={Ambulance}
              label="Accueil Secourisme"
              open={open}
            />
          </SidebarSection>

          <SidebarSection title="Pharmacie" open={open}>
            <SidebarLink
              href="/dashboard/secourisme/alertes"
              icon={BellRing}
              label="Alertes"
              open={open}
              active={active === "alertes"}
            />
            <SidebarLink
              href="/dashboard/secourisme/stock"
              icon={Pill}
              label="Stock pharmacie"
              open={open}
              active={active === "stock"}
            />
            <SidebarLink
              href="/dashboard/secourisme/peremptions"
              icon={CalendarClock}
              label="Péremptions"
              open={open}
              active={active === "peremptions"}
            />
            <SidebarLink
              href="/dashboard/secourisme/fournisseurs"
              icon={Truck}
              label="Fournisseurs"
              open={open}
              active={active === "fournisseurs"}
            />
            <SidebarLink
              href="/dashboard/secourisme/categories"
              icon={Tags}
              label="Catégories"
              open={open}
              active={active === "categories"}
            />
          </SidebarSection>

          <SidebarSection title="Suivi" open={open}>
            <SidebarLink
              href="/dashboard/secourisme/stock"
              icon={Boxes}
              label="Articles"
              open={open}
            />
            <SidebarLink
              href="/dashboard/secourisme/mouvements"
              icon={Package}
              label="Mouvements"
              open={open}
            />
          </SidebarSection>
        </nav>

        <div className="mt-auto pt-4">
          <button
            type="button"
            onClick={onToggle}
            className={`app-button-secondary flex w-full items-center rounded-xl text-sm font-bold ${
              open
                ? "gap-3 px-3 py-2.5"
                : "justify-center px-2 py-2.5"
            }`}
          >
            <Menu size={18} />
            {open && <span>Réduire le menu</span>}
          </button>
        </div>
      </div>
    </aside>
  );
}

function SidebarSection({
  title,
  open,
  children,
}: {
  title: string;
  open: boolean;
  children: React.ReactNode;
}) {
  return (
    <section>
      {open && (
        <p className="mb-2 px-3 text-[10px] font-black uppercase tracking-[0.16em] text-muted-foreground">
          {title}
        </p>
      )}
      <div className="space-y-1">{children}</div>
    </section>
  );
}

function SidebarLink({
  href,
  icon,
  label,
  open,
  active = false,
}: {
  href: string;
  icon: LucideIcon;
  label: string;
  open: boolean;
  active?: boolean;
}) {
  const Icon = icon;

  return (
    <Link
      href={href}
      title={!open ? label : undefined}
      className={`flex min-h-11 items-center rounded-xl text-sm font-bold transition ${
        open ? "gap-3 px-3" : "justify-center px-2"
      } ${
        active
          ? "border border-red-300 bg-red-100 text-red-800 dark:border-red-900/70 dark:bg-red-950/40 dark:text-red-300"
          : "text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
      }`}
    >
      <span
        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${
          active
            ? "bg-red-200 text-red-800 dark:bg-red-950/70 dark:text-red-300"
            : "bg-sidebar-accent text-muted-foreground"
        }`}
      >
        <Icon size={18} strokeWidth={1.9} />
      </span>

      {open && <span className="truncate">{label}</span>}
    </Link>
  );
}