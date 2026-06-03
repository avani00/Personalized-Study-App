import StepScreen from "@/app/components/StepScreen";

export default function PreviewPage() {
  return (
    <StepScreen
      breadcrumb={[
        { label: "Home", href: "/" },
        { label: "Upload new", href: "/upload/source" },
        { label: "Preview" },
      ]}
      title="Preview content"
      subtitle="Step 2 of 6 — Confirm the parsed content looks right."
      blocks={["[ Extracted / parsed content preview placeholder ]"]}
      actions={[
        { label: "← Back", href: "/upload/source" },
        { label: "Choose topics →", href: "/upload/topics", primary: true },
      ]}
    />
  );
}
