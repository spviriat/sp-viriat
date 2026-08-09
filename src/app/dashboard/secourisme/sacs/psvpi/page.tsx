import RescueBagControl from "@/components/secourisme/sacs/RescueBagControl";

export default function PremierSecoursVpiPage() {
  return (
    <RescueBagControl
      bagCode="ps_vpi"
      homeHref="/dashboard/secourisme"
    />
  );
}