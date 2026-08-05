"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { supabase } from "@/lib/supabase";
import CreateUserDialog from "@/components/admin/CreateUserDialog";

type AccessRole = "user" | "admin";

type BusinessRole = {
  id: number;
  code: string;
  label: string;
};

type UserProfile = {
  id: string;
  first_name: string;
  last_name: string;
  matricule: string | null;
  grade: string | null;
  phone: string | null;
  role: string | null;
  access_role: AccessRole;
  status: string | null;
  business_roles: BusinessRole[];
};

type ProfileBusinessRole = {
  profile_id: string;
  business_role_id: number;
};

type BusinessRoleCategory = {
  title: string;
  icon: string;
  codes: string[];
};

type CurrentRoleAssignment = {
  business_roles:
    | {
        code: string;
      }
    | {
        code: string;
      }[]
    | null;
};

type UpdateUserResponse = {
  message?: string;
  error?: string;
  user?: UserProfile;
};

const USER_MANAGEMENT_ROLES = [
  "chef_centre",
  "adjoint_chef_centre",
];

const BUSINESS_ROLE_CATEGORIES: BusinessRoleCategory[] = [
  {
    title: "Commandement",
    icon: "🚒",
    codes: ["chef_centre", "adjoint_chef_centre"],
  },
  {
    title: "Responsabilités opérationnelles",
    icon: "🧰",
    codes: [
      "responsable_pharmacie",
      "responsable_habillement",
      "responsable_materiel",
    ],
  },
  {
    title: "Corps",
    icon: "👥",
    codes: ["sapeur_pompier", "observateur"],
  },
  {
    title: "Amicale",
    icon: "🤝",
    codes: [
      "president_amicale",
      "president_amicale_anciens",
      "membre_bureau",
      "amicaliste",
    ],
  },
];

const BUSINESS_ROLE_ORDER =
  BUSINESS_ROLE_CATEGORIES.flatMap(
    (category) => category.codes
  );

const sortBusinessRoles = (
  roles: BusinessRole[]
) =>
  [...roles].sort(
    (firstRole, secondRole) => {
      const firstIndex =
        BUSINESS_ROLE_ORDER.indexOf(
          firstRole.code
        );

      const secondIndex =
        BUSINESS_ROLE_ORDER.indexOf(
          secondRole.code
        );

      const safeFirstIndex =
        firstIndex === -1
          ? Number.MAX_SAFE_INTEGER
          : firstIndex;

      const safeSecondIndex =
        secondIndex === -1
          ? Number.MAX_SAFE_INTEGER
          : secondIndex;

      if (
        safeFirstIndex !==
        safeSecondIndex
      ) {
        return (
          safeFirstIndex -
          safeSecondIndex
        );
      }

      return firstRole.label.localeCompare(
        secondRole.label,
        "fr"
      );
    }
  );

function extractBusinessRoleCodes(
  assignments: CurrentRoleAssignment[]
): string[] {
  return assignments.flatMap(
    (assignment) => {
      const roles =
        assignment.business_roles;

      if (!roles) {
        return [];
      }

      if (Array.isArray(roles)) {
        return roles
          .map((role) => role.code)
          .filter(
            (code): code is string =>
              typeof code === "string"
          );
      }

      return typeof roles.code === "string"
        ? [roles.code]
        : [];
    }
  );
}

export default function AdminPage() {
  const router = useRouter();

  const [users, setUsers] =
    useState<UserProfile[]>([]);

  const [businessRoles, setBusinessRoles] =
    useState<BusinessRole[]>([]);

  const [selectedUser, setSelectedUser] =
    useState<UserProfile | null>(null);

  const [
    selectedBusinessRoleIds,
    setSelectedBusinessRoleIds,
  ] = useState<number[]>([]);

  const [
    selectedUserEmail,
    setSelectedUserEmail,
  ] = useState("");

  const [
    isLoadingUserEmail,
    setIsLoadingUserEmail,
  ] = useState(false);

  /*
   * =====================================================
   * UTILISATEUR CONNECTÉ
   * =====================================================
   */

  const [
    currentUserId,
    setCurrentUserId,
  ] = useState<string | null>(null);

  const [
    currentUserIsAdmin,
    setCurrentUserIsAdmin,
  ] = useState(false);

  const [
    currentBusinessRoleCodes,
    setCurrentBusinessRoleCodes,
  ] = useState<string[]>([]);

  /*
   * =====================================================
   * MODIFICATION DE L'E-MAIL
   * =====================================================
   */

  const [
    isEmailDialogOpen,
    setIsEmailDialogOpen,
  ] = useState(false);

  const [
    newUserEmail,
    setNewUserEmail,
  ] = useState("");

  const [
    emailConfirmationPassword,
    setEmailConfirmationPassword,
  ] = useState("");

  const [
    isUpdatingEmail,
    setIsUpdatingEmail,
  ] = useState(false);

  const [
    emailUpdateError,
    setEmailUpdateError,
  ] = useState("");

  /*
   * =====================================================
   * ÉTAT GÉNÉRAL
   * =====================================================
   */

  const [isLoading, setIsLoading] =
    useState(true);

  const [isSaving, setIsSaving] =
    useState(false);

  const [
    isCreateDialogOpen,
    setIsCreateDialogOpen,
  ] = useState(false);

  /*
   * =====================================================
   * SUPPRESSION
   * =====================================================
   */

  const [
    isDeleteDialogOpen,
    setIsDeleteDialogOpen,
  ] = useState(false);

  const [
    deleteConfirmation,
    setDeleteConfirmation,
  ] = useState("");

  const [
    isDeleting,
    setIsDeleting,
  ] = useState(false);

  const [
    deleteErrorMessage,
    setDeleteErrorMessage,
  ] = useState("");

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
   * CHARGEMENT DE LA PAGE
   * =====================================================
   */

  useEffect(() => {
    const loadAdminPage = async () => {
      setErrorMessage("");
      setSuccessMessage("");

      const {
        data: { session },
        error: sessionError,
      } =
        await supabase.auth.getSession();

      if (
        sessionError ||
        !session
      ) {
        router.replace("/");
        return;
      }

      setCurrentUserId(
        session.user.id
      );

      /*
       * Profil utilisateur connecté.
       */

      const {
        data: currentProfile,
        error: profileError,
      } = await supabase
        .from("profiles")
        .select("access_role")
        .eq(
          "id",
          session.user.id
        )
        .single();

      if (
        profileError ||
        !currentProfile
      ) {
        console.error(
          "Erreur lors de la vérification du profil :",
          profileError
        );

        router.replace(
          "/dashboard"
        );

        return;
      }

      const isAdmin =
        currentProfile.access_role ===
        "admin";

      setCurrentUserIsAdmin(
        isAdmin
      );

      /*
       * Rôles métier de l'utilisateur connecté.
       */

      const {
        data: currentRoleAssignments,
        error:
          currentRoleAssignmentsError,
      } = await supabase
        .from(
          "profile_business_roles"
        )
        .select(`
          business_roles (
            code
          )
        `)
        .eq(
          "profile_id",
          session.user.id
        );

      if (
        currentRoleAssignmentsError
      ) {
        console.error(
          "Erreur lors de la récupération des rôles métier de l'utilisateur connecté :",
          currentRoleAssignmentsError
        );

        router.replace(
          "/dashboard"
        );

        return;
      }

      const roleCodes =
        extractBusinessRoleCodes(
          (currentRoleAssignments ??
            []) as CurrentRoleAssignment[]
        );

      setCurrentBusinessRoleCodes(
        roleCodes
      );

      /*
       * Autorisation d'accéder à la gestion.
       */

      const canManageUsers =
        isAdmin ||
        roleCodes.some((code) =>
          USER_MANAGEMENT_ROLES.includes(
            code
          )
        );

      if (!canManageUsers) {
        router.replace(
          "/dashboard"
        );

        return;
      }

      /*
       * Chargement des utilisateurs.
       */

      const [
        profilesResult,
        businessRolesResult,
        assignmentsResult,
      ] = await Promise.all([
        supabase
          .from("profiles")
          .select(`
            id,
            first_name,
            last_name,
            matricule,
            grade,
            phone,
            role,
            access_role,
            status
          `)
          .order(
            "last_name",
            {
              ascending: true,
            }
          )
          .order(
            "first_name",
            {
              ascending: true,
            }
          ),

        supabase
          .from(
            "business_roles"
          )
          .select(
            "id, code, label"
          ),

        supabase
          .from(
            "profile_business_roles"
          )
          .select(
            "profile_id, business_role_id"
          ),
      ]);

      if (
        profilesResult.error
      ) {
        console.error(
          "Erreur lors de la récupération des utilisateurs :",
          profilesResult.error
        );

        setErrorMessage(
          "Impossible de récupérer la liste des utilisateurs."
        );

        setIsLoading(false);

        return;
      }

      if (
        businessRolesResult.error
      ) {
        console.error(
          "Erreur lors de la récupération des rôles métier :",
          businessRolesResult.error
        );

        setErrorMessage(
          "Impossible de récupérer les rôles métier."
        );

        setIsLoading(false);

        return;
      }

      if (
        assignmentsResult.error
      ) {
        console.error(
          "Erreur lors de la récupération des attributions de rôles :",
          assignmentsResult.error
        );

        setErrorMessage(
          "Impossible de récupérer les rôles attribués aux utilisateurs."
        );

        setIsLoading(false);

        return;
      }

      const loadedBusinessRoles =
        sortBusinessRoles(
          (businessRolesResult.data ??
            []) as BusinessRole[]
        );

      const assignments =
        (assignmentsResult.data ??
          []) as ProfileBusinessRole[];

      const rolesById = new Map(
        loadedBusinessRoles.map(
          (businessRole) => [
            businessRole.id,
            businessRole,
          ]
        )
      );

      const rolesByProfileId =
        new Map<
          string,
          BusinessRole[]
        >();

      assignments.forEach(
        (assignment) => {
          const businessRole =
            rolesById.get(
              assignment.business_role_id
            );

          if (!businessRole) {
            return;
          }

          const currentRoles =
            rolesByProfileId.get(
              assignment.profile_id
            ) ?? [];

          currentRoles.push(
            businessRole
          );

          rolesByProfileId.set(
            assignment.profile_id,
            currentRoles
          );
        }
      );

      const loadedUsers =
        (
          profilesResult.data ??
          []
        ).map((profile) => ({
          ...profile,

          business_roles:
            sortBusinessRoles(
              rolesByProfileId.get(
                profile.id
              ) ?? []
            ),
        })) as UserProfile[];

      setBusinessRoles(
        loadedBusinessRoles
      );

      setUsers(
        loadedUsers
      );

      setIsLoading(false);
    };

    void loadAdminPage();
  }, [router]);

  /*
   * =====================================================
   * INFORMATIONS SUR LES DROITS COURANTS
   * =====================================================
   */

  const isCommandMember =
    currentBusinessRoleCodes.includes(
      "chef_centre"
    ) ||
    currentBusinessRoleCodes.includes(
      "adjoint_chef_centre"
    );

  const selectedUserIsProtectedAdmin =
    Boolean(
      selectedUser &&
        selectedUser.access_role ===
          "admin" &&
        !currentUserIsAdmin
    );

  const canDeleteSelectedUser =
    Boolean(
      selectedUser &&
        selectedUser.id !==
          currentUserId &&
        (
          currentUserIsAdmin ||
          selectedUser.access_role !==
            "admin"
        )
    );

  const canEditSelectedUser =
    Boolean(
      selectedUser &&
        !selectedUserIsProtectedAdmin
    );

  /*
   * =====================================================
   * OUVERTURE UTILISATEUR
   * =====================================================
   */

  const openEditDialog =
    async (
      user: UserProfile
    ) => {
      setErrorMessage("");
      setSuccessMessage("");

      setDeleteErrorMessage(
        ""
      );

      setDeleteConfirmation(
        ""
      );

      setIsDeleteDialogOpen(
        false
      );

      setIsEmailDialogOpen(
        false
      );

      setNewUserEmail("");

      setEmailConfirmationPassword(
        ""
      );

      setEmailUpdateError(
        ""
      );

      setSelectedUserEmail(
        ""
      );

      setIsLoadingUserEmail(
        true
      );

      setSelectedUser({
        ...user,
        business_roles: [
          ...user.business_roles,
        ],
      });

      setSelectedBusinessRoleIds(
        user.business_roles.map(
          (businessRole) =>
            businessRole.id
        )
      );

      try {
        const {
          data: { session },
          error: sessionError,
        } =
          await supabase.auth.getSession();

        if (
          sessionError ||
          !session?.access_token
        ) {
          setErrorMessage(
            "Votre session a expiré. Veuillez vous reconnecter."
          );

          return;
        }

        const response =
          await fetch(
            `/api/admin/users/${user.id}`,
            {
              method: "GET",

              headers: {
                Authorization:
                  `Bearer ${session.access_token}`,
              },
            }
          );

        const result =
          (await response.json()) as {
            user?: {
              id: string;
              email:
                | string
                | null;
            };

            error?: string;
          };

        if (!response.ok) {
          console.error(
            "Impossible de récupérer l'adresse e-mail :",
            result.error
          );

          setErrorMessage(
            result.error ??
              "Impossible de récupérer l'adresse e-mail de l'utilisateur."
          );

          return;
        }

        setSelectedUserEmail(
          result.user?.email ??
            ""
        );
      } catch (error) {
        console.error(
          "Erreur lors de la récupération de l'adresse e-mail :",
          error
        );

        setErrorMessage(
          "Impossible de récupérer l'adresse e-mail de l'utilisateur."
        );
      } finally {
        setIsLoadingUserEmail(
          false
        );
      }
    };

  /*
   * =====================================================
   * FERMETURE UTILISATEUR
   * =====================================================
   */

  const closeEditDialog =
    () => {
      if (
        isSaving ||
        isDeleting ||
        isUpdatingEmail
      ) {
        return;
      }

      setSelectedUser(null);

      setSelectedBusinessRoleIds(
        []
      );

      setSelectedUserEmail(
        ""
      );

      setIsLoadingUserEmail(
        false
      );

      setIsEmailDialogOpen(
        false
      );

      setNewUserEmail("");

      setEmailConfirmationPassword(
        ""
      );

      setEmailUpdateError(
        ""
      );

      setDeleteConfirmation(
        ""
      );

      setDeleteErrorMessage(
        ""
      );

      setIsDeleteDialogOpen(
        false
      );

      setErrorMessage("");
    };

    /*
   * =====================================================
   * ENREGISTREMENT DU PROFIL
   * =====================================================
   *
   * Toutes les modifications passent par :
   *
   * /api/admin/users/update
   */
const toggleBusinessRole = (
  businessRoleId: number
) => {
  if (
    !selectedUser ||
    selectedUserIsProtectedAdmin ||
    isSaving ||
    isDeleting ||
    isUpdatingEmail
  ) {
    return;
  }

  setSelectedBusinessRoleIds(
    (currentRoleIds) => {
      if (
        currentRoleIds.includes(
          businessRoleId
        )
      ) {
        return currentRoleIds.filter(
          (roleId) =>
            roleId !== businessRoleId
        );
      }

      return [
        ...currentRoleIds,
        businessRoleId,
      ];
    }
  );
};
  const handleSaveUser = async () => {
    if (!selectedUser) {
      return;
    }

    /*
     * Un chef de centre / adjoint ne peut pas
     * modifier un administrateur.
     */
    if (selectedUserIsProtectedAdmin) {
      setErrorMessage(
        "Vous ne pouvez pas modifier un administrateur."
      );

      return;
    }

    const firstName =
      selectedUser.first_name.trim();

    const lastName =
      selectedUser.last_name.trim();

    /*
     * Vérification des champs obligatoires.
     */
    if (!firstName || !lastName) {
      setErrorMessage(
        "Le prénom et le nom sont obligatoires."
      );

      return;
    }

    /*
     * Seul un administrateur peut attribuer
     * access_role = admin.
     */
    if (
      !currentUserIsAdmin &&
      selectedUser.access_role === "admin"
    ) {
      setErrorMessage(
        "Vous n'êtes pas autorisé à attribuer les droits administrateur."
      );

      return;
    }

    setIsSaving(true);
    setErrorMessage("");
    setSuccessMessage("");

    try {
      /*
       * ===============================================
       * Session Supabase
       * ===============================================
       */

      const {
        data: { session },
        error: sessionError,
      } = await supabase.auth.getSession();

      if (
        sessionError ||
        !session?.access_token
      ) {
        setErrorMessage(
          "Votre session a expiré. Veuillez vous reconnecter."
        );

        return;
      }

      /*
       * ===============================================
       * Appel de la route serveur
       * ===============================================
       */

      const response = await fetch(
        "/api/admin/users/update",
        {
          method: "POST",

          headers: {
            "Content-Type":
              "application/json",

            Authorization:
              `Bearer ${session.access_token}`,
          },

          body: JSON.stringify({
            userId:
              selectedUser.id,

            firstName,

            lastName,

            matricule:
              selectedUser.matricule ??
              "",

            grade:
              selectedUser.grade ??
              "",

            phone:
              selectedUser.phone ??
              "",

            accessRole:
              selectedUser.access_role,

            businessRoleIds:
              selectedBusinessRoleIds,
          }),
        }
      );

      /*
       * ===============================================
       * Diagnostic
       * ===============================================
       */

      console.log(
        "UPDATE USER STATUS:",
        response.status
      );

      /*
       * On tente de lire la réponse JSON.
       *
       * Si Next.js ou le serveur renvoie une page HTML
       * ou une réponse vide, on évite de provoquer une
       * seconde erreur avec response.json().
       */

      let result: UpdateUserResponse;

      try {
        result =
          (await response.json()) as UpdateUserResponse;
      } catch (jsonError) {
        console.error(
          "UPDATE USER - Réponse JSON invalide :",
          jsonError
        );

        setErrorMessage(
          `La route de modification a renvoyé une réponse invalide (${response.status}).`
        );

        return;
      }

      console.log(
        "UPDATE USER RESPONSE:",
        result
      );

      /*
       * ===============================================
       * Erreur retournée par l'API
       * ===============================================
       */

      if (!response.ok) {
        console.error(
          "ERREUR API UPDATE USER:",
          response.status,
          result
        );

        setErrorMessage(
          result.error ??
            `Les modifications n'ont pas pu être enregistrées (${response.status}).`
        );

        return;
      }

      /*
       * ===============================================
       * Vérification de la réponse
       * ===============================================
       */

      if (!result.user) {
        console.error(
          "UPDATE USER - utilisateur absent de la réponse :",
          result
        );

        setErrorMessage(
          "La modification a été effectuée, mais la réponse du serveur est incomplète."
        );

        return;
      }

      /*
       * ===============================================
       * Reconstruction de l'utilisateur enregistré
       * ===============================================
       */

      const savedUser: UserProfile = {
        ...result.user,

        business_roles:
          sortBusinessRoles(
            result.user.business_roles ??
              []
          ),
      };

      /*
       * ===============================================
       * Mise à jour de la liste locale
       * ===============================================
       */

      setUsers(
        (currentUsers) =>
          currentUsers
            .map((user) =>
              user.id === savedUser.id
                ? savedUser
                : user
            )
            .sort(
              (
                firstUser,
                secondUser
              ) => {
                const firstFullName =
                  `${firstUser.last_name} ${firstUser.first_name}`.trim();

                const secondFullName =
                  `${secondUser.last_name} ${secondUser.first_name}`.trim();

                return firstFullName.localeCompare(
                  secondFullName,
                  "fr"
                );
              }
            )
      );

      /*
       * ===============================================
       * Fermeture de la fenêtre
       * ===============================================
       */

      setSelectedUser(null);

      setSelectedBusinessRoleIds(
        []
      );

      setSelectedUserEmail(
        ""
      );

      setIsLoadingUserEmail(
        false
      );

      setIsEmailDialogOpen(
        false
      );

      setNewUserEmail(
        ""
      );

      setEmailConfirmationPassword(
        ""
      );

      setEmailUpdateError(
        ""
      );

      setDeleteConfirmation(
        ""
      );

      setDeleteErrorMessage(
        ""
      );

      setIsDeleteDialogOpen(
        false
      );

      /*
       * ===============================================
       * Confirmation
       * ===============================================
       */

      setSuccessMessage(
        result.message ??
          "L'utilisateur a été modifié avec succès."
      );
    } catch (error) {
      /*
       * ===============================================
       * Erreur réseau / JavaScript inattendue
       * ===============================================
       */

      console.error(
        "Erreur lors de la modification de l'utilisateur :",
        error
      );

      setErrorMessage(
        "Une erreur inattendue est survenue pendant la modification."
      );
    } finally {
      /*
       * Ce bloc est maintenant correctement rattaché
       * au try/catch ci-dessus.
       */

      setIsSaving(false);
    }
  };

  const handleUpdateUserEmail =
    async () => {
      if (!selectedUser) {
        return;
      }

      if (
        selectedUser.id ===
        currentUserId
      ) {
        setEmailUpdateError(
          "Vous ne pouvez pas modifier votre propre adresse e-mail depuis l'administration."
        );

        return;
      }

      /*
       * Par sécurité, chef et adjoint ne modifient
       * pas le compte d'un administrateur.
       */

      if (
        selectedUserIsProtectedAdmin
      ) {
        setEmailUpdateError(
          "Vous ne pouvez pas modifier l'adresse e-mail d'un administrateur."
        );

        return;
      }

      const cleanEmail =
        newUserEmail
          .trim()
          .toLowerCase();

      setEmailUpdateError("");

      if (!cleanEmail) {
        setEmailUpdateError(
          "La nouvelle adresse e-mail est obligatoire."
        );

        return;
      }

      const emailPattern =
        /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

      if (
        !emailPattern.test(
          cleanEmail
        )
      ) {
        setEmailUpdateError(
          "L'adresse e-mail n'est pas valide."
        );

        return;
      }

      if (
        cleanEmail ===
        selectedUserEmail
          .trim()
          .toLowerCase()
      ) {
        setEmailUpdateError(
          "Cette adresse e-mail est déjà utilisée pour ce compte."
        );

        return;
      }

      if (
        !emailConfirmationPassword
      ) {
        setEmailUpdateError(
          "Votre mot de passe est obligatoire pour confirmer cette modification."
        );

        return;
      }

      setIsUpdatingEmail(true);

      try {
        const {
          data: { session },
          error: sessionError,
        } =
          await supabase.auth.getSession();

        if (
          sessionError ||
          !session?.access_token
        ) {
          setEmailUpdateError(
            "Votre session a expiré. Veuillez vous reconnecter."
          );

          return;
        }

        const response =
          await fetch(
            `/api/admin/users/${selectedUser.id}`,
            {
              method: "PATCH",

              headers: {
                "Content-Type":
                  "application/json",

                Authorization:
                  `Bearer ${session.access_token}`,
              },

              body: JSON.stringify(
                {
                  email:
                    cleanEmail,

                  password:
                    emailConfirmationPassword,
                }
              ),
            }
          );

        const result =
          (await response.json()) as {
            error?: string;

            message?: string;

            user?: {
              id: string;
              email:
                | string
                | null;
            };
          };

        if (!response.ok) {
          setEmailUpdateError(
            result.error ??
              "Impossible de modifier l'adresse e-mail."
          );

          return;
        }

        const updatedEmail =
          result.user?.email ??
          cleanEmail;

        setSelectedUserEmail(
          updatedEmail
        );

        setNewUserEmail("");

        setEmailConfirmationPassword(
          ""
        );

        setEmailUpdateError(
          ""
        );

        setIsEmailDialogOpen(
          false
        );

        setSuccessMessage(
          result.message ??
            "L'adresse e-mail a été modifiée avec succès."
        );
      } catch (error) {
        console.error(
          "Erreur lors de la modification de l'adresse e-mail :",
          error
        );

        setEmailUpdateError(
          "Une erreur inattendue est survenue pendant la modification."
        );
      } finally {
        setIsUpdatingEmail(
          false
        );
      }
    };

  /*
   * =====================================================
   * SUPPRESSION
   * =====================================================
   */

  const handleDeleteUser =
    async () => {
      if (!selectedUser) {
        return;
      }

      if (
        selectedUser.id ===
        currentUserId
      ) {
        setDeleteErrorMessage(
          "Vous ne pouvez pas supprimer votre propre compte."
        );

        return;
      }

      /*
       * Chef de centre / adjoint :
       * interdiction de supprimer un administrateur.
       */

      if (
        !currentUserIsAdmin &&
        selectedUser.access_role ===
          "admin"
      ) {
        setDeleteErrorMessage(
          "Vous ne pouvez pas supprimer un administrateur."
        );

        return;
      }

      if (
        deleteConfirmation !==
        "SUPPRIMER"
      ) {
        setDeleteErrorMessage(
          'Vous devez écrire exactement "SUPPRIMER".'
        );

        return;
      }

      setIsDeleting(true);

      setDeleteErrorMessage(
        ""
      );

      try {
        const {
          data: { session },
          error: sessionError,
        } =
          await supabase.auth.getSession();

        if (
          sessionError ||
          !session?.access_token
        ) {
          setDeleteErrorMessage(
            "Votre session a expiré. Veuillez vous reconnecter."
          );

          return;
        }

        const response =
          await fetch(
            "/api/admin/users/delete",
            {
              method: "POST",

              headers: {
                "Content-Type":
                  "application/json",

                Authorization:
                  `Bearer ${session.access_token}`,
              },

              body: JSON.stringify(
                {
                  userId:
                    selectedUser.id,
                }
              ),
            }
          );

        const result =
          (await response.json()) as {
            error?: string;
            message?: string;
            deletedUserId?: string;
          };

        if (!response.ok) {
          setDeleteErrorMessage(
            result.error ??
              "Impossible de supprimer l'utilisateur."
          );

          return;
        }

        const deletedUserId =
          selectedUser.id;

        setUsers(
          (currentUsers) =>
            currentUsers.filter(
              (user) =>
                user.id !==
                deletedUserId
            )
        );

        setSelectedUser(null);

        setSelectedBusinessRoleIds(
          []
        );

        setSelectedUserEmail(
          ""
        );

        setIsLoadingUserEmail(
          false
        );

        setIsEmailDialogOpen(
          false
        );

        setNewUserEmail("");

        setEmailConfirmationPassword(
          ""
        );

        setEmailUpdateError(
          ""
        );

        setIsDeleteDialogOpen(
          false
        );

        setDeleteConfirmation(
          ""
        );

        setDeleteErrorMessage(
          ""
        );

        setSuccessMessage(
          result.message ??
            "L'utilisateur a été supprimé définitivement."
        );
      } catch (error) {
        console.error(
          "Erreur lors de la suppression :",
          error
        );

        setDeleteErrorMessage(
          "Une erreur inattendue est survenue pendant la suppression."
        );
      } finally {
        setIsDeleting(false);
      }
    };

  /*
   * =====================================================
   * CHARGEMENT
   * =====================================================
   */

  if (isLoading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-100 dark:bg-slate-950">
        <div className="rounded-3xl bg-white px-8 py-7 text-center shadow-xl dark:bg-slate-900">
          <div className="mx-auto h-9 w-9 animate-spin rounded-full border-4 border-slate-200 border-t-red-600" />

          <p className="mt-4 font-semibold text-slate-700 dark:text-slate-200">
            Chargement de
            l&apos;administration...
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-100 px-4 py-6 text-slate-950 dark:bg-slate-950 dark:text-white sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl">
        {/* =================================================
            EN-TÊTE
        ================================================= */}

        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-bold uppercase tracking-widest text-red-600">
              Administration
            </p>

            <h1 className="mt-2 text-3xl font-black sm:text-4xl">
              Gestion des utilisateurs
            </h1>

            <p className="mt-2 text-slate-600 dark:text-slate-400">
              Gère les informations, les
              droits d&apos;accès et les
              rôles métier des
              utilisateurs.
            </p>

            {!currentUserIsAdmin &&
              isCommandMember && (
                <p className="mt-2 text-sm font-semibold text-blue-600 dark:text-blue-400">
                  Accès commandement —
                  Chef de centre / Adjoint
                  chef de centre
                </p>
              )}
          </div>

          <div className="flex flex-col gap-3 sm:flex-row">
            <button
              type="button"
              onClick={() => {
                setErrorMessage("");
                setSuccessMessage("");

                setIsCreateDialogOpen(
                  true
                );
              }}
              className="inline-flex items-center justify-center rounded-2xl bg-red-600 px-5 py-3 font-bold text-white transition hover:bg-red-700 active:scale-[0.98]"
            >
              + Créer un utilisateur
            </button>

            <Link
              href="/dashboard"
              className="inline-flex items-center justify-center rounded-2xl border border-slate-300 bg-white px-5 py-3 font-bold text-slate-700 transition hover:bg-slate-50 active:scale-[0.98] dark:border-slate-700 dark:bg-slate-900 dark:text-white dark:hover:bg-slate-800"
            >
              ← Retour au tableau de
              bord
            </Link>
          </div>
        </div>

        {errorMessage &&
          !selectedUser && (
            <div className="mt-6 rounded-2xl border border-red-200 bg-red-50 px-5 py-4 font-semibold text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-300">
              {errorMessage}
            </div>
          )}

        {successMessage && (
          <div className="mt-6 rounded-2xl border border-emerald-200 bg-emerald-50 px-5 py-4 font-semibold text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-300">
            {successMessage}
          </div>
        )}

        {/* =================================================
            LISTE
        ================================================= */}

        <section className="mt-8 overflow-hidden rounded-3xl bg-white shadow-sm dark:bg-slate-900">
          <div className="border-b border-slate-200 px-5 py-5 dark:border-slate-800 sm:px-6">
            <h2 className="text-xl font-extrabold">
              Utilisateurs
            </h2>

            <p className="mt-1 text-sm text-slate-500">
              {users.length} utilisateur
              {users.length > 1
                ? "s"
                : ""}
            </p>
          </div>

          {users.length === 0 ? (
            <div className="px-6 py-12 text-center text-slate-500">
              Aucun utilisateur trouvé.
            </div>
          ) : (
            <div className="divide-y divide-slate-200 dark:divide-slate-800">
              {users.map((user) => {
                const fullName =
                  `${user.first_name ?? ""} ${user.last_name ?? ""}`.trim() ||
                  "Utilisateur sans nom";

                const protectedAdmin =
                  !currentUserIsAdmin &&
                  user.access_role ===
                    "admin";

                return (
                  <article
                    key={user.id}
                    className="flex flex-col gap-4 px-5 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-6"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-lg font-extrabold">
                        {fullName}
                      </p>

                      {(user.grade ||
                        user.matricule ||
                        user.phone) && (
                        <div className="mt-1 space-y-1 text-sm text-slate-500 dark:text-slate-400">
                          {(user.grade ||
                            user.matricule) && (
                            <p>
                              {user.grade ||
                                "Grade non renseigné"}

                              {user.matricule
                                ? ` • Matricule ${user.matricule}`
                                : ""}
                            </p>
                          )}

                          {user.phone && (
                            <p>
                              Téléphone :{" "}
                              {user.phone}
                            </p>
                          )}
                        </div>
                      )}

                      <div className="mt-3 flex flex-wrap gap-2">
                        {user
                          .business_roles
                          .length > 0 ? (
                          user.business_roles.map(
                            (
                              businessRole
                            ) => (
                              <span
                                key={
                                  businessRole.id
                                }
                                className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-600 dark:bg-slate-800 dark:text-slate-300"
                              >
                                {
                                  businessRole.label
                                }
                              </span>
                            )
                          )
                        ) : (
                          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                            Aucun rôle métier
                          </span>
                        )}

                        <span
                          className={
                            user.access_role ===
                            "admin"
                              ? "rounded-full bg-red-100 px-3 py-1 text-xs font-bold text-red-700 dark:bg-red-950/40 dark:text-red-300"
                              : "rounded-full bg-blue-100 px-3 py-1 text-xs font-bold text-blue-700 dark:bg-blue-950/40 dark:text-blue-300"
                          }
                        >
                          {user.access_role ===
                          "admin"
                            ? "Administrateur"
                            : "Utilisateur"}
                        </span>

                        {protectedAdmin && (
                          <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-bold text-amber-700 dark:bg-amber-950/40 dark:text-amber-300">
                            🔒 Compte protégé
                          </span>
                        )}
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() =>
                        void openEditDialog(
                          user
                        )
                      }
                      className="shrink-0 rounded-2xl bg-red-600 px-5 py-2.5 font-bold text-white transition hover:bg-red-700 active:scale-[0.98]"
                    >
                      {protectedAdmin
                        ? "👁️ Consulter"
                        : "✏️ Modifier"}
                    </button>
                  </article>
                );
              })}
            </div>
          )}
        </section>
      </div>

      {/* =================================================
          CRÉATION
      ================================================= */}

      {isCreateDialogOpen && (
        <CreateUserDialog
          businessRoles={
            businessRoles
          }
          onClose={() =>
            setIsCreateDialogOpen(
              false
            )
          }
          onCreated={() => {
            setIsCreateDialogOpen(
              false
            );

            setSuccessMessage(
              "Utilisateur créé avec succès."
            );

            window.setTimeout(
              () => {
                window.location.reload();
              },
              800
            );
          }}
        />
      )}

      {/* =================================================
          MODIFICATION UTILISATEUR
      ================================================= */}

      {selectedUser && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          onMouseDown={(event) => {
            if (
              event.target ===
                event.currentTarget &&
              !isDeleteDialogOpen &&
              !isEmailDialogOpen
            ) {
              closeEditDialog();
            }
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="edit-user-title"
            className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-3xl bg-white p-6 shadow-2xl dark:bg-slate-900 sm:p-8"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-bold uppercase tracking-widest text-red-600">
                  Administration
                </p>

                <h2
                  id="edit-user-title"
                  className="mt-2 text-2xl font-black sm:text-3xl"
                >
                  {selectedUserIsProtectedAdmin
                    ? "Consulter l'administrateur"
                    : "Modifier l'utilisateur"}
                </h2>

                <p className="mt-2 text-slate-500 dark:text-slate-400">
                  {selectedUserIsProtectedAdmin
                    ? "Ce compte administrateur est protégé. Seul un administrateur peut le modifier."
                    : "Modifie ses informations, son niveau d'accès et ses rôles métier."}
                </p>
              </div>

              <button
                type="button"
                onClick={
                  closeEditDialog
                }
                disabled={
                  isSaving ||
                  isDeleting ||
                  isUpdatingEmail
                }
                aria-label="Fermer"
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-slate-100 text-2xl font-bold text-slate-600 transition hover:bg-slate-200 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
              >
                ×
              </button>
            </div>

            {selectedUserIsProtectedAdmin && (
              <div className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm font-bold leading-6 text-amber-800 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-300">
                🔒 Compte administrateur
                protégé. Vous pouvez
                consulter ses
                informations mais vous ne
                pouvez ni les modifier ni
                supprimer ce compte.
              </div>
            )}

            {errorMessage && (
              <div className="mt-6 rounded-2xl border border-red-200 bg-red-50 px-5 py-4 font-semibold text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-300">
                {errorMessage}
              </div>
            )}

            {/* =============================================
                INFORMATIONS PERSONNELLES
            ============================================= */}

            <div className="mt-8">
              <h3 className="text-lg font-black">
                Informations personnelles
              </h3>

              <div className="mt-4 grid gap-5 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <span className="text-sm font-bold text-slate-700 dark:text-slate-200">
                    Adresse e-mail
                  </span>

                  <div className="mt-2 flex flex-col gap-3 sm:flex-row">
                    <input
                      type="email"
                      value={
                        isLoadingUserEmail
                          ? "Chargement..."
                          : selectedUserEmail
                      }
                      readOnly
                      disabled={
                        isLoadingUserEmail
                      }
                      className="min-w-0 flex-1 cursor-default rounded-2xl border border-slate-300 bg-slate-100 px-4 py-3 text-slate-600 outline-none disabled:opacity-70 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
                    />

                    {selectedUser.id !==
                      currentUserId &&
                      !selectedUserIsProtectedAdmin && (
                        <button
                          type="button"
                          disabled={
                            isLoadingUserEmail ||
                            isSaving ||
                            isDeleting ||
                            isUpdatingEmail ||
                            !selectedUserEmail
                          }
                          onClick={() => {
                            setNewUserEmail(
                              selectedUserEmail
                            );

                            setEmailConfirmationPassword(
                              ""
                            );

                            setEmailUpdateError(
                              ""
                            );

                            setIsEmailDialogOpen(
                              true
                            );
                          }}
                          className="shrink-0 rounded-2xl border border-slate-300 bg-white px-5 py-3 font-bold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200 dark:hover:bg-slate-800"
                        >
                          ✏️ Modifier
                          l&apos;e-mail
                        </button>
                      )}
                  </div>

                  <span className="mt-2 block text-xs text-slate-500 dark:text-slate-400">
                    L&apos;adresse e-mail
                    est utilisée comme
                    identifiant de
                    connexion.
                  </span>
                </div>

                <label className="block">
                  <span className="text-sm font-bold text-slate-700 dark:text-slate-200">
                    Prénom
                  </span>

                  <input
                    type="text"
                    value={
                      selectedUser.first_name
                    }
                    onChange={(event) =>
                      setSelectedUser({
                        ...selectedUser,

                        first_name:
                          event.target
                            .value,
                      })
                    }
                    disabled={
                      isSaving ||
                      isDeleting ||
                      isUpdatingEmail ||
                      !canEditSelectedUser
                    }
                    className="mt-2 w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 outline-none transition focus:border-red-500 focus:ring-4 focus:ring-red-100 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:opacity-70 dark:border-slate-700 dark:bg-slate-950 dark:disabled:bg-slate-800 dark:focus:ring-red-950"
                  />
                </label>

                <label className="block">
                  <span className="text-sm font-bold text-slate-700 dark:text-slate-200">
                    Nom
                  </span>

                  <input
                    type="text"
                    value={
                      selectedUser.last_name
                    }
                    onChange={(event) =>
                      setSelectedUser({
                        ...selectedUser,

                        last_name:
                          event.target
                            .value,
                      })
                    }
                    disabled={
                      isSaving ||
                      isDeleting ||
                      isUpdatingEmail ||
                      !canEditSelectedUser
                    }
                    className="mt-2 w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 outline-none transition focus:border-red-500 focus:ring-4 focus:ring-red-100 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:opacity-70 dark:border-slate-700 dark:bg-slate-950 dark:disabled:bg-slate-800 dark:focus:ring-red-950"
                  />
                </label>

                <label className="block">
                  <span className="text-sm font-bold text-slate-700 dark:text-slate-200">
                    Matricule
                  </span>

                  <input
                    type="text"
                    value={
                      selectedUser.matricule ??
                      ""
                    }
                    onChange={(event) =>
                      setSelectedUser({
                        ...selectedUser,

                        matricule:
                          event.target
                            .value,
                      })
                    }
                    disabled={
                      isSaving ||
                      isDeleting ||
                      isUpdatingEmail ||
                      !canEditSelectedUser
                    }
                    placeholder="Ex. 123456"
                    className="mt-2 w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 outline-none transition focus:border-red-500 focus:ring-4 focus:ring-red-100 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:opacity-70 dark:border-slate-700 dark:bg-slate-950 dark:disabled:bg-slate-800 dark:focus:ring-red-950"
                  />
                </label>

                <label className="block">
                  <span className="text-sm font-bold text-slate-700 dark:text-slate-200">
                    Grade
                  </span>

                  <input
                    type="text"
                    value={
                      selectedUser.grade ??
                      ""
                    }
                    onChange={(event) =>
                      setSelectedUser({
                        ...selectedUser,

                        grade:
                          event.target
                            .value,
                      })
                    }
                    disabled={
                      isSaving ||
                      isDeleting ||
                      isUpdatingEmail ||
                      !canEditSelectedUser
                    }
                    placeholder="Ex. Caporal"
                    className="mt-2 w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 outline-none transition focus:border-red-500 focus:ring-4 focus:ring-red-100 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:opacity-70 dark:border-slate-700 dark:bg-slate-950 dark:disabled:bg-slate-800 dark:focus:ring-red-950"
                  />
                </label>

                <label className="block sm:col-span-2">
                  <span className="text-sm font-bold text-slate-700 dark:text-slate-200">
                    Téléphone
                  </span>

                  <input
                    type="tel"
                    value={
                      selectedUser.phone ??
                      ""
                    }
                    onChange={(event) =>
                      setSelectedUser({
                        ...selectedUser,

                        phone:
                          event.target
                            .value,
                      })
                    }
                    disabled={
                      isSaving ||
                      isDeleting ||
                      isUpdatingEmail ||
                      !canEditSelectedUser
                    }
                    placeholder="Ex. 06 12 34 56 78"
                    className="mt-2 w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 outline-none transition focus:border-red-500 focus:ring-4 focus:ring-red-100 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:opacity-70 dark:border-slate-700 dark:bg-slate-950 dark:disabled:bg-slate-800 dark:focus:ring-red-950"
                  />
                </label>
              </div>
            </div>

            {/* =============================================
                DROITS D'ACCÈS
            ============================================= */}

            <div className="mt-8 border-t border-slate-200 pt-8 dark:border-slate-800">
              <h3 className="text-lg font-black">
                Droits d&apos;accès
              </h3>

              {currentUserIsAdmin ? (
                <>
                  <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                    Seul un
                    administrateur peut
                    attribuer ou retirer
                    les droits
                    administrateur.
                  </p>

                  <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    <button
                      type="button"
                      disabled={
                        isSaving ||
                        isDeleting ||
                        isUpdatingEmail
                      }
                      onClick={() =>
                        setSelectedUser(
                          {
                            ...selectedUser,

                            access_role:
                              "user",
                          }
                        )
                      }
                      className={
                        selectedUser.access_role ===
                        "user"
                          ? "rounded-2xl border-2 border-blue-600 bg-blue-50 px-5 py-4 text-left text-blue-700 transition disabled:cursor-not-allowed disabled:opacity-60 dark:bg-blue-950/30 dark:text-blue-300"
                          : "rounded-2xl border-2 border-slate-200 px-5 py-4 text-left text-slate-700 transition hover:border-slate-300 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:text-slate-200 dark:hover:border-slate-600"
                      }
                    >
                      <span className="block font-black">
                        Utilisateur
                      </span>

                      <span className="mt-1 block text-sm opacity-80">
                        Accès normal à
                        l&apos;application.
                      </span>
                    </button>

                    <button
                      type="button"
                      disabled={
                        isSaving ||
                        isDeleting ||
                        isUpdatingEmail
                      }
                      onClick={() =>
                        setSelectedUser(
                          {
                            ...selectedUser,

                            access_role:
                              "admin",
                          }
                        )
                      }
                      className={
                        selectedUser.access_role ===
                        "admin"
                          ? "rounded-2xl border-2 border-red-600 bg-red-50 px-5 py-4 text-left text-red-700 transition disabled:cursor-not-allowed disabled:opacity-60 dark:bg-red-950/30 dark:text-red-300"
                          : "rounded-2xl border-2 border-slate-200 px-5 py-4 text-left text-slate-700 transition hover:border-slate-300 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:text-slate-200 dark:hover:border-slate-600"
                      }
                    >
                      <span className="block font-black">
                        Administrateur
                      </span>

                      <span className="mt-1 block text-sm opacity-80">
                        Accès complet à
                        la gestion de
                        l&apos;application.
                      </span>
                    </button>
                  </div>
                </>
              ) : (
                <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-800/50">
                  <p className="text-sm font-bold">
                    Niveau actuel :
                  </p>

                  <p className="mt-1 font-black">
                    {selectedUser.access_role ===
                    "admin"
                      ? "Administrateur"
                      : "Utilisateur"}
                  </p>

                  <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
                    Seul un
                    administrateur peut
                    modifier le niveau
                    d&apos;accès.
                  </p>
                </div>
              )}
            </div>

            {/* =============================================
                RÔLES MÉTIER
            ============================================= */}

            <div className="mt-8 border-t border-slate-200 pt-8 dark:border-slate-800">
              <h3 className="text-lg font-black">
                Rôles métier
              </h3>

              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                Un utilisateur peut
                posséder plusieurs rôles
                métier. Aucun rôle
                n&apos;est attribué par
                défaut et Observateur est
                cumulable avec
                Sapeur-Pompier.
              </p>

              <div className="mt-5 space-y-6">
                {BUSINESS_ROLE_CATEGORIES.map(
                  (category) => {
                    const categoryRoles =
                      category.codes
                        .map((code) =>
                          businessRoles.find(
                            (
                              businessRole
                            ) =>
                              businessRole.code ===
                              code
                          )
                        )
                        .filter(
                          (
                            businessRole
                          ): businessRole is BusinessRole =>
                            Boolean(
                              businessRole
                            )
                        );

                    if (
                      categoryRoles.length ===
                      0
                    ) {
                      return null;
                    }

                    return (
                      <section
                        key={
                          category.title
                        }
                      >
                        <h4 className="flex items-center gap-2 text-sm font-black uppercase tracking-wide text-slate-500 dark:text-slate-400">
                          <span
                            aria-hidden="true"
                          >
                            {
                              category.icon
                            }
                          </span>

                          {
                            category.title
                          }
                        </h4>

                        <div className="mt-3 grid gap-3 sm:grid-cols-2">
                          {categoryRoles.map(
                            (
                              businessRole
                            ) => {
                              const isSelected =
                                selectedBusinessRoleIds.includes(
                                  businessRole.id
                                );

                              return (
                                <label
                                  key={
                                    businessRole.id
                                  }
                                  className={
                                    selectedUserIsProtectedAdmin
                                      ? "flex cursor-not-allowed items-center gap-3 rounded-2xl border-2 border-slate-200 bg-slate-50 px-4 py-3 text-slate-500 opacity-70 dark:border-slate-700 dark:bg-slate-800/50 dark:text-slate-400"
                                      : isSelected
                                        ? "flex cursor-pointer items-center gap-3 rounded-2xl border-2 border-red-600 bg-red-50 px-4 py-3 text-red-700 transition dark:bg-red-950/30 dark:text-red-300"
                                        : "flex cursor-pointer items-center gap-3 rounded-2xl border-2 border-slate-200 px-4 py-3 text-slate-700 transition hover:border-slate-300 dark:border-slate-700 dark:text-slate-200 dark:hover:border-slate-600"
                                  }
                                >
                                  <input
                                    type="checkbox"
                                    checked={
                                      isSelected
                                    }
                                    onChange={() =>
                                      toggleBusinessRole(
                                        businessRole.id
                                      )
                                    }
                                    disabled={
                                      isSaving ||
                                      isDeleting ||
                                      isUpdatingEmail ||
                                      !canEditSelectedUser
                                    }
                                    className="h-5 w-5 shrink-0 accent-red-600 disabled:cursor-not-allowed"
                                  />

                                  <span className="font-bold">
                                    {
                                      businessRole.label
                                    }
                                  </span>
                                </label>
                              );
                            }
                          )}
                        </div>
                      </section>
                    );
                  }
                )}
              </div>
            </div>

            {/* =============================================
                ZONE DE DANGER
            ============================================= */}

            {canDeleteSelectedUser && (
              <div className="mt-10 border-t border-red-200 pt-8 dark:border-red-900/60">
                <div className="rounded-3xl border border-red-300 bg-red-50 p-5 dark:border-red-900 dark:bg-red-950/20 sm:p-6">
                  <p className="text-xs font-black uppercase tracking-widest text-red-600">
                    Zone de danger
                  </p>

                  <h3 className="mt-2 text-lg font-black text-red-700 dark:text-red-300">
                    Supprimer cet
                    utilisateur
                  </h3>

                  <p className="mt-2 text-sm leading-6 text-red-700/80 dark:text-red-300/80">
                    Cette action supprime
                    définitivement le
                    compte, son accès à
                    l&apos;application et
                    ses rôles métier.
                    Cette opération est
                    irréversible.
                  </p>

                  <button
                    type="button"
                    disabled={
                      isSaving ||
                      isDeleting ||
                      isUpdatingEmail
                    }
                    onClick={() => {
                      setDeleteConfirmation(
                        ""
                      );

                      setDeleteErrorMessage(
                        ""
                      );

                      setIsDeleteDialogOpen(
                        true
                      );
                    }}
                    className="mt-5 rounded-2xl border-2 border-red-600 px-5 py-3 font-black text-red-600 transition hover:bg-red-600 hover:text-white active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    🗑️ Supprimer
                    définitivement
                  </button>
                </div>
              </div>
            )}

            {/* =============================================
                BOUTONS
            ============================================= */}

            <div className="mt-8 flex flex-col-reverse gap-3 border-t border-slate-200 pt-6 dark:border-slate-800 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={
                  closeEditDialog
                }
                disabled={
                  isSaving ||
                  isDeleting ||
                  isUpdatingEmail
                }
                className="rounded-2xl border border-slate-300 px-5 py-3 font-bold text-slate-700 transition hover:bg-slate-50 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
              >
                {selectedUserIsProtectedAdmin
                  ? "Fermer"
                  : "Annuler"}
              </button>

              {!selectedUserIsProtectedAdmin && (
                <button
                  type="button"
                  onClick={() =>
                    void handleSaveUser()
                  }
                  disabled={
                    isSaving ||
                    isDeleting ||
                    isUpdatingEmail
                  }
                  className="rounded-2xl bg-red-600 px-6 py-3 font-bold text-white transition hover:bg-red-700 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isSaving
                    ? "Enregistrement..."
                    : "Enregistrer"}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* =================================================
          MODIFICATION DE L'ADRESSE E-MAIL
      ================================================= */}

      {isEmailDialogOpen &&
        selectedUser && (
          <div
            className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 p-4"
            onMouseDown={(
              event
            ) => {
              if (
                event.target ===
                  event.currentTarget &&
                !isUpdatingEmail
              ) {
                setIsEmailDialogOpen(
                  false
                );

                setNewUserEmail("");

                setEmailConfirmationPassword(
                  ""
                );

                setEmailUpdateError(
                  ""
                );
              }
            }}
          >
            <div
              role="dialog"
              aria-modal="true"
              aria-labelledby="edit-email-title"
              className="w-full max-w-lg rounded-3xl bg-white p-6 shadow-2xl dark:bg-slate-900 sm:p-8"
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-100 text-2xl dark:bg-blue-950/40">
                    ✉️
                  </div>

                  <p className="mt-5 text-sm font-black uppercase tracking-widest text-red-600">
                    Action sensible
                  </p>

                  <h2
                    id="edit-email-title"
                    className="mt-2 text-2xl font-black"
                  >
                    Modifier
                    l&apos;adresse e-mail
                  </h2>

                  <p className="mt-2 text-slate-500 dark:text-slate-400">
                    {
                      selectedUser.first_name
                    }{" "}
                    {
                      selectedUser.last_name
                    }
                  </p>
                </div>

                <button
                  type="button"
                  disabled={
                    isUpdatingEmail
                  }
                  onClick={() => {
                    setIsEmailDialogOpen(
                      false
                    );

                    setNewUserEmail(
                      ""
                    );

                    setEmailConfirmationPassword(
                      ""
                    );

                    setEmailUpdateError(
                      ""
                    );
                  }}
                  aria-label="Fermer"
                  className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-slate-100 text-2xl font-bold text-slate-600 transition hover:bg-slate-200 disabled:opacity-50 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
                >
                  ×
                </button>
              </div>

              <div className="mt-7 rounded-2xl bg-slate-50 p-4 dark:bg-slate-800/60">
                <p className="text-xs font-black uppercase tracking-widest text-slate-500">
                  Adresse actuelle
                </p>

                <p className="mt-1 break-all font-bold">
                  {selectedUserEmail}
                </p>
              </div>

              <div className="mt-6 space-y-5">
                <label className="block">
                  <span className="text-sm font-bold text-slate-700 dark:text-slate-200">
                    Nouvelle adresse
                    e-mail
                  </span>

                  <input
                    type="email"
                    value={
                      newUserEmail
                    }
                    onChange={(
                      event
                    ) => {
                      setNewUserEmail(
                        event.target.value
                      );

                      setEmailUpdateError(
                        ""
                      );
                    }}
                    disabled={
                      isUpdatingEmail
                    }
                    autoComplete="off"
                    placeholder="nouvelle.adresse@exemple.fr"
                    className="mt-2 w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 outline-none transition focus:border-red-500 focus:ring-4 focus:ring-red-100 disabled:opacity-60 dark:border-slate-700 dark:bg-slate-950 dark:focus:ring-red-950"
                  />
                </label>

                <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-900 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-200">
                  <strong>
                    Confirmation requise.
                  </strong>{" "}
                  Saisissez votre propre
                  mot de passe SP Viriat
                  pour confirmer cette
                  action.
                </div>

                <label className="block">
                  <span className="text-sm font-bold text-slate-700 dark:text-slate-200">
                    Votre mot de passe
                  </span>

                  <input
                    type="password"
                    value={
                      emailConfirmationPassword
                    }
                    onChange={(
                      event
                    ) => {
                      setEmailConfirmationPassword(
                        event.target
                          .value
                      );

                      setEmailUpdateError(
                        ""
                      );
                    }}
                    disabled={
                      isUpdatingEmail
                    }
                    autoComplete="current-password"
                    placeholder="Votre mot de passe"
                    className="mt-2 w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 outline-none transition focus:border-red-500 focus:ring-4 focus:ring-red-100 disabled:opacity-60 dark:border-slate-700 dark:bg-slate-950 dark:focus:ring-red-950"
                  />
                </label>
              </div>

              {emailUpdateError && (
                <div
                  role="alert"
                  className="mt-5 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-300"
                >
                  {
                    emailUpdateError
                  }
                </div>
              )}

              <div className="mt-7 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  disabled={
                    isUpdatingEmail
                  }
                  onClick={() => {
                    setIsEmailDialogOpen(
                      false
                    );

                    setNewUserEmail(
                      ""
                    );

                    setEmailConfirmationPassword(
                      ""
                    );

                    setEmailUpdateError(
                      ""
                    );
                  }}
                  className="rounded-2xl border border-slate-300 px-5 py-3 font-bold text-slate-700 transition hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
                >
                  Annuler
                </button>

                <button
                  type="button"
                  disabled={
                    isUpdatingEmail ||
                    !newUserEmail.trim() ||
                    !emailConfirmationPassword
                  }
                  onClick={() =>
                    void handleUpdateUserEmail()
                  }
                  className="rounded-2xl bg-red-600 px-6 py-3 font-black text-white transition hover:bg-red-700 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {isUpdatingEmail
                    ? "Modification..."
                    : "Confirmer la modification"}
                </button>
              </div>
            </div>
          </div>
        )}

      {/* =================================================
          SUPPRESSION
      ================================================= */}

      {isDeleteDialogOpen &&
        selectedUser && (
          <div
            className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 p-4"
            onMouseDown={(
              event
            ) => {
              if (
                event.target ===
                  event.currentTarget &&
                !isDeleting
              ) {
                setIsDeleteDialogOpen(
                  false
                );

                setDeleteConfirmation(
                  ""
                );

                setDeleteErrorMessage(
                  ""
                );
              }
            }}
          >
            <div
              role="alertdialog"
              aria-modal="true"
              className="w-full max-w-lg rounded-3xl bg-white p-6 shadow-2xl dark:bg-slate-900 sm:p-8"
            >
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-red-100 text-2xl dark:bg-red-950/40">
                ⚠️
              </div>

              <p className="mt-5 text-sm font-black uppercase tracking-widest text-red-600">
                Suppression définitive
              </p>

              <h2 className="mt-2 text-2xl font-black">
                Supprimer{" "}
                {
                  selectedUser.first_name
                }{" "}
                {
                  selectedUser.last_name
                }{" "}
                ?
              </h2>

              <p className="mt-4 leading-7 text-slate-600 dark:text-slate-400">
                Cette action est
                irréversible. Le compte
                ne pourra plus se
                connecter à SP Viriat.
              </p>

              {!currentUserIsAdmin && (
                <p className="mt-3 text-sm font-semibold text-slate-500 dark:text-slate-400">
                  Un chef de centre ou un
                  adjoint ne peut pas
                  supprimer un compte
                  administrateur.
                </p>
              )}

              <p className="mt-5 text-sm font-bold">
                Pour confirmer, écrivez
                exactement :
              </p>

              <div className="mt-2 rounded-2xl bg-slate-100 px-4 py-3 text-center font-mono text-lg font-black tracking-widest text-red-600 dark:bg-slate-800">
                SUPPRIMER
              </div>

              <input
                type="text"
                value={
                  deleteConfirmation
                }
                onChange={(
                  event
                ) => {
                  setDeleteConfirmation(
                    event.target.value
                  );

                  setDeleteErrorMessage(
                    ""
                  );
                }}
                disabled={
                  isDeleting
                }
                autoComplete="off"
                placeholder="SUPPRIMER"
                className="mt-4 w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 font-bold outline-none transition focus:border-red-600 focus:ring-4 focus:ring-red-100 disabled:opacity-60 dark:border-slate-700 dark:bg-slate-950 dark:focus:ring-red-950"
              />

              {deleteErrorMessage && (
                <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-300">
                  {
                    deleteErrorMessage
                  }
                </div>
              )}

              <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  disabled={
                    isDeleting
                  }
                  onClick={() => {
                    setIsDeleteDialogOpen(
                      false
                    );

                    setDeleteConfirmation(
                      ""
                    );

                    setDeleteErrorMessage(
                      ""
                    );
                  }}
                  className="rounded-2xl border border-slate-300 px-5 py-3 font-bold transition hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:hover:bg-slate-800"
                >
                  Annuler
                </button>

                <button
                  type="button"
                  disabled={
                    isDeleting ||
                    deleteConfirmation !==
                      "SUPPRIMER"
                  }
                  onClick={() =>
                    void handleDeleteUser()
                  }
                  className="rounded-2xl bg-red-600 px-6 py-3 font-black text-white transition hover:bg-red-700 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {isDeleting
                    ? "Suppression..."
                    : "Supprimer définitivement"}
                </button>
              </div>
            </div>
          </div>
        )}
    </main>
  );
}