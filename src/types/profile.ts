export type Profile = {
  id: string;
  first_name: string;
  last_name: string;
  grade: string | null;
  fonction: string | null;
  telephone: string | null;
  avatar_url: string | null;
  role: string;
  access_role: "user" | "admin";
  theme: string;

  matricule: string | null;
  status: string | null;
};