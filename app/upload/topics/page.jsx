import StepScreen from "@/app/components/StepScreen";

export default function TopicsPage() {
  return (
    <StepScreen
      breadcrumb={[
        { label: "Home", href: "/" },
        { label: "Upload new", href: "/upload/source" },
        { label: "Topics" },
      ]}
      title="Choose topics"
      subtitle="Step 3 of 6 — Select which detected topics to include."
      blocks={["[ Detected topics checklist placeholder ]"]}
      actions={[
        { label: "← Back", href: "/upload/preview" },
        { label: "Choose settings →", href: "/upload/settings", primary: true },
      ]}
    />
  );
}
