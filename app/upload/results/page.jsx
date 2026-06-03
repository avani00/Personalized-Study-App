import StepScreen from "@/app/components/StepScreen";

export default function ResultsPage() {
  return (
    <StepScreen
      breadcrumb={[
        { label: "Home", href: "/" },
        { label: "Upload new", href: "/upload/source" },
        { label: "Results" },
      ]}
      title="Results / review mistakes"
      subtitle="Step 6 of 6 — See how you did and decide what's next."
      blocks={[
        "[ Score summary placeholder ]",
        "[ Weak topics breakdown placeholder ]",
      ]}
      actions={[
        { label: "Retry missed", href: "/upload/questions" },
        { label: "Change settings", href: "/upload/settings" },
        { label: "Done → Home", href: "/", primary: true },
      ]}
    />
  );
}
