import StepScreen from "@/app/components/StepScreen";

export default function SessionsPage() {
  return (
    <StepScreen
      breadcrumb={[
        { label: "Home", href: "/" },
        { label: "Review old", href: "/review" },
        { label: "Sessions" },
      ]}
      title="Previous topics / sessions"
      subtitle="Browse your past study sessions."
      blocks={["[ List of previous sessions placeholder ]"]}
      actions={[
        { label: "← Back", href: "/review" },
        { label: "Open a session →", href: "/upload/questions", primary: true },
      ]}
    />
  );
}
