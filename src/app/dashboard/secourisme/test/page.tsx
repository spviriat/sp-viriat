"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

export default function TestSecourismePage() {
  const [result, setResult] = useState("");

  useEffect(() => {
    async function test() {
      const {
        data: {
          session,
        },
      } = await supabase.auth.getSession();

      if (!session) {
        setResult("Pas de session connectée");
        return;
      }

      const response = await fetch(
        "/api/secourisme/categories",
        {
          headers: {
            Authorization:
              `Bearer ${session.access_token}`,
          },
        }
      );

      const data =
        await response.json();

      setResult(
        JSON.stringify(
          data,
          null,
          2
        )
      );
    }

    test();
  }, []);

  return (
    <main className="p-10">
      <h1 className="text-2xl font-bold">
        Test API Secourisme
      </h1>

      <pre className="mt-5 rounded bg-black p-5 text-white">
        {result}
      </pre>
    </main>
  );
}