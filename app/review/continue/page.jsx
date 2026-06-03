import StepScreen from "@/app/components/StepScreen";

export default function ContinuePage() {
  return (
    <StepScreen
      breadcrumb={[
        { label: "Home", href: "/" },
        { label: "Review old", href: "/review" },
        { label: "Continue" },
      ]}
      title="Continue unfinished session"
      subtitle="Resume a session you didn't finish."
      blocks={["[ Unfinished sessions list placeholder ]"]}
      actions={[
        { label: "← Back", href: "/review" },
        { label: "Resume →", href: "/upload/questions", primary: true },
      ]}
    />
  );
}
