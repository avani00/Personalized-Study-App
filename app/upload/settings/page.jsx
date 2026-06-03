import StepScreen from "@/app/components/StepScreen";

export default function SettingsPage() {
  return (
    <StepScreen
      breadcrumb={[
        { label: "Home", href: "/" },
        { label: "Upload new", href: "/upload/source" },
        { label: "Settings" },
      ]}
      title="Choose settings"
      subtitle="Step 4 of 6 — Configure how questions are generated."
      blocks={[
        "[ Number of questions (0 = unlimited) placeholder ]",
        "[ Question type selector placeholder — MCQ, short answer, etc. ]",
        "[ Difficulty selector placeholder ]",
      ]}
      actions={[
        { label: "← Back", href: "/upload/topics" },
        { label: "Start questions →", href: "/upload/questions", primary: true },
      ]}
    />
  );
}
