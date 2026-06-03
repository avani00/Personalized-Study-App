import StepScreen from "@/app/components/StepScreen";

export default function SourcePage() {
  return (
    <StepScreen
      breadcrumb={[{ label: "Home", href: "/" }, { label: "Upload new" }]}
      title="Paste text / upload file"
      subtitle="Step 1 of 6 — Add the material you want to study."
      blocks={[
        "[ Paste text area placeholder ]",
        "[ File upload dropzone placeholder — PDF, slides, txt ]",
      ]}
      actions={[
        { label: "Cancel", href: "/" },
        { label: "Preview content →", href: "/upload/preview", primary: true },
      ]}
    />
  );
}
